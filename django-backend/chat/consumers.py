import json
import asyncio
from django.conf import settings
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import ChatSession
from .services.dynamo_service import DynamoMessageService
import os
from datetime import datetime, timezone

_kafka_producer = None

def _get_kafka_producer():
    global _kafka_producer
    if _kafka_producer is None:
        try:
            from confluent_kafka import Producer as KafkaProducer
            _kafka_producer = KafkaProducer({
                "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP", "kafka:9092"),
                "socket.timeout.ms": 3000,
            })
        except Exception as e:
            print(f"[Kafka] Producer init failed (non-critical): {e}")
    return _kafka_producer

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
        print(f"--- AUTH DEBUG ---")
        print(f"User: {self.user}")
        print(f"Is Authenticated: {self.user.is_authenticated if self.user else 'No User Object'}")
        
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

        
            producer = _get_kafka_producer()
            if producer:
                try:
                    producer.produce(
                        "chat.messages.all",
                        key=self.session_id,
                        value=json.dumps({
                            "session_id": self.session_id,
                            "role": "user",
                            "user_email": user_metadata.get("email", "anonymous"),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        })
                    )
                    producer.poll(0)
                except Exception as ke:
                    print(f"[Kafka] user message produce error: {ke}")
            # 3. Start RAG Task
            #  asyncio.create_task  - socket stays open while the AI thinks
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