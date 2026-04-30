import json
import httpx
from django.conf import settings
from asgiref.sync import sync_to_async  # CRITICAL for bridging sync boto3 to async Django
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import ChatSession
from .services.dynamo_service import DynamoMessageService


dynamo_db = DynamoMessageService()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        self.session_id = str(self.scope["url_route"]["kwargs"]["session_id"])

        # 1. Auth check (PostgreSQL)
        if not self.user or self.user.is_anonymous or not await self.is_session_owner():
            await self.close(code=4003)
            return

        self.room_group_name = f"chat_{self.session_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # 2. Load and send Chat History from DynamoDB
        history = await sync_to_async(dynamo_db.get_session_history)(self.session_id)
        if history:
            await self.send(text_data=json.dumps({
                "type": "history",
                "messages": history
            }))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_text = data.get("message")
        if not message_text: return

        # 3. Save User Message to DynamoDB (Run in thread to prevent blocking)
        await sync_to_async(dynamo_db.save_message)(self.session_id, "user", message_text)

        # 4. Request Answer from AI Brain (FastAPI)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://ai-service:8001/query",
                    json={"text": message_text, "collection_name": "enterprise_docs"},
                    headers={"X-Internal-API-Key": settings.INTERNAL_API_KEY}, 
                    timeout=45.0
                )
                response.raise_for_status()
                ai_data = response.json()
                ai_answer = ai_data.get("answer")
                sources = ai_data.get("sources", [])
        except Exception as e:
            print(f"Failed to reach AI service: {e}")
            ai_answer = "System error: Unable to reach the AI engine."
            sources = []

        # 5. Save AI Response to DynamoDB (Run in thread)
        await sync_to_async(dynamo_db.save_message)(self.session_id, "ai", ai_answer, sources=sources)

        # 6. Push to User
        await self.send(text_data=json.dumps({
            "type": "new_message",
            "role": "ai", 
            "content": ai_answer,
            "sources": sources,
            "session_id": self.session_id
        }))

    @database_sync_to_async
    def is_session_owner(self):
        return ChatSession.objects.filter(id=self.session_id, user=self.user).exists()