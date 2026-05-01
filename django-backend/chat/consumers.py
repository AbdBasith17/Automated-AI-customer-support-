import json
import asyncio
from django.conf import settings
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import ChatSession
from .services.dynamo_service import DynamoMessageService

dynamo_db = DynamoMessageService()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        self.session_id = str(self.scope["url_route"]["kwargs"]["session_id"])

        if not self.user or self.user.is_anonymous or not await self.is_session_owner():
            await self.close(code=4003)
            return

        self.room_group_name = f"chat_{self.session_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

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
        if not message_text:
            return

        # 1. Save user message to DynamoDB
        await sync_to_async(dynamo_db.save_message)(self.session_id, "user", message_text)

        # 2. Dispatch directly to ai-worker via Celery — no FastAPI hop
        asyncio.create_task(self._dispatch_rag_task(message_text))

    async def _get_user_metadata(self):
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            return None
        
        
        return {
            "email": user.email,
            "full_name": f"{user.first_name} {user.last_name}".strip()
        }

    async def _dispatch_rag_task(self, message_text: str):
        """
        Drop task directly into Redis queue for aion-ai-worker.
        Includes user metadata so the AI can personalize the support
        and provide details for the Jira ticket.
        """
        try:
            # 1. Prepare the metadata
            user_data = await self._get_user_metadata()

            from workers.celery_app import app as django_celery
            
           
            await sync_to_async(django_celery.send_task)(
                "process_rag_query",
                args=[
                    message_text, 
                    "enterprise_docs", 
                    self.session_id, 
                    user_data  
                ],
                queue="rag"
            )
        except Exception as e:
            print(f"Failed to dispatch RAG task for session {self.session_id}: {e}")
            await self.send(text_data=json.dumps({
                "type": "new_message",
                "role": "ai",
                "content": "System error: Unable to reach the AI engine.",
                "sources": [],
                "session_id": self.session_id
            }))


    async def ai_response_handler(self, event):
        """Triggered by ai-worker pushing to Redis channel layer."""
        payload = event["payload"]

        # Save AI response to DynamoDB
        await sync_to_async(dynamo_db.save_message)(
            self.session_id,
            "ai",
            payload["content"],
            sources=payload.get("sources", [])
        )

        # Send to user WebSocket
        await self.send(text_data=json.dumps(payload))

    @database_sync_to_async
    def is_session_owner(self):
        return ChatSession.objects.filter(id=self.session_id, user=self.user).exists()