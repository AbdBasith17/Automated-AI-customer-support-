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
        self.session_id = str(self.scope["url_route"]["kwargs"]["session_id"])
        self.user = self.scope.get("user")
        self.room_group_name = f"chat_{self.session_id}"

        print(f"--- WebSocket Connecting: {self.session_id} ---")

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        
        history = await sync_to_async(dynamo_db.get_messages)(self.session_id)
    
        if history:
            await self.send(text_data=json.dumps({
                "type": "chat_history",
                "messages": history
            })) 
    async def receive(self, text_data):
        print(f"--- Raw Data Received: {text_data} ---")
        
        try:
            data = json.loads(text_data)
            message_text = data.get("message")
            
            if not message_text:
                return

            # 1. Get Metadata
            user_metadata = {
                "email": getattr(self.user, 'email', 'anonymous'),
                "full_name": f"{getattr(self.user, 'first_name', '')} {getattr(self.user, 'last_name', '')}".strip()
            }

            # 2. Save to Dynamo
            await sync_to_async(dynamo_db.save_message)(self.session_id, "user", message_text)
            print("Saved to DynamoDB")

            # 3. Start RAG Task
            # We use asyncio.create_task so the socket stays open while the AI thinks
            asyncio.create_task(self._dispatch_rag_task(message_text, user_metadata))
            print("Task Dispatched to Celery")

        except Exception as e:
            print(f"Error in receive: {e}")

    #accepts  (self, message_text, user_metadata)
    async def _dispatch_rag_task(self, message_text: str, user_metadata: dict):
        try:
            from workers.celery_app import app as django_celery
            
            # This triggers the task in your aion-ai-worker
            await sync_to_async(django_celery.send_task)(
                "process_rag_query",
                args=[
                    message_text, 
                    "enterprise_docs", 
                    self.session_id, 
                    user_metadata
                ],
                queue="rag"
            )
        except Exception as e:
            print(f"CRITICAL: Failed to send task to Redis: {e}")

    async def ai_response_handler(self, event):
        """
        This is called by the Worker via the Channel Layer
        """
        payload = event["payload"]
        print(f"AI Response received for session {self.session_id}")
        
        # Save AI response to history
        await sync_to_async(dynamo_db.save_message)(
            self.session_id, "ai", payload["content"], sources=payload.get("sources", [])
        )
        
        # Send to Frontend
        await self.send(text_data=json.dumps(payload))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"--- WebSocket Disconnected: {close_code} ---")