import asyncio
import json
import os
from datetime import datetime, timezone

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .services.dynamo_service import DynamoMessageService

dynamo_db = DynamoMessageService()

_kafka_producer = None


def _get_kafka_producer():
    global _kafka_producer
    if _kafka_producer is None:
        try:
            from confluent_kafka import Producer as KafkaProducer

            _kafka_producer = KafkaProducer(
                {
                    "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP", "kafka:9092"),
                    "socket.timeout.ms": 3000,
                }
            )
        except Exception as e:
            print(f"[Kafka] Producer init failed: {e}")
    return _kafka_producer


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        try:
            self.session_id = str(self.scope["url_route"]["kwargs"]["session_id"])
            self.user = self.scope.get("user")
            self.room_group_name = f"chat_{self.session_id}"

            if not self.user or not self.user.is_authenticated:
                await self.close(code=4001)
                return

            self.user_email = self.user.email

            history = await sync_to_async(dynamo_db.get_messages)(self.session_id)

            if history:
                self.is_new_session = False
                self.session_topic = await sync_to_async(dynamo_db.get_session_topic)(
                    self.session_id
                )
            else:
                self.is_new_session = True
                self.session_topic = None

            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()

            await self.send(
                text_data=json.dumps(
                    {
                        "type": "chat_history",
                        "messages": history or [],
                    }
                )
            )

        except Exception as e:
            print(f"[WS] Connect error: {e}")
            try:
                await self.close(code=1011)
            except Exception:
                pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_text = data.get("message")
            if not message_text:
                return

            if self.is_new_session:
                self.session_topic = " ".join(message_text.split()[:6])
                self.is_new_session = False

            user_metadata = {
                "email": self.user_email,
                "full_name": f"{getattr(self.user, 'first_name', '')} {getattr(self.user, 'last_name', '')}".strip(),
            }

            await sync_to_async(dynamo_db.save_message)(
                self.session_id,
                "user",
                message_text,
                user_email=self.user_email,
                topic=self.session_topic,
            )

            # Tell frontend the real topic so sidebar updates optimistically
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "sidebar_update",
                        "session_id": self.session_id,
                        "topic": self.session_topic,
                    }
                )
            )

            producer = _get_kafka_producer()
            if producer:
                try:
                    producer.produce(
                        "chat.messages.all",
                        key=self.session_id,
                        value=json.dumps(
                            {
                                "session_id": self.session_id,
                                "role": "user",
                                "user_email": self.user_email,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                    )
                    producer.poll(0)
                except Exception as ke:
                    print(f"[Kafka] produce error: {ke}")

            asyncio.create_task(self._dispatch_rag_task(message_text, user_metadata))

        except Exception as e:
            print(f"[Consumer] receive error: {e}")

    async def _dispatch_rag_task(self, message_text: str, user_metadata: dict):
        try:
            from workers.celery_app import app as django_celery

            await sync_to_async(django_celery.send_task)(
                "process_rag_query",
                args=[message_text, "enterprise_docs", self.session_id, user_metadata],
                queue="rag",
            )
        except Exception as e:
            print(f"[Celery] CRITICAL — failed to dispatch: {e}")

    async def ai_response_handler(self, event):
        """
        Worker already saved the message — just forward to the WebSocket client.
        DO NOT save here; multiple connections = multiple saves = duplicates.
        """
        payload = event["payload"]
        await self.send(
            text_data=json.dumps(
                {
                    "type": "new_message",
                    "role": "ai",
                    "content": payload["content"],
                    "status": payload.get("status"),
                }
            )
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        print(f"[Consumer] Disconnected: {close_code}")
