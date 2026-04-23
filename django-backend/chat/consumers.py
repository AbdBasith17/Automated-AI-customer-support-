import asyncio
import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import ChatMessage, ChatSession

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]

    
        if not self.user or self.user.is_anonymous:
            await self.accept()
            await self.close(code=4001)  # 4001 = Unauthorized 
            return

        if not await self.is_session_owner():
            await self.accept()
            await self.close(code=4003)  # 4003 = Forbidden
            return

        self.room_group_name = f"chat_{self.session_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_text = data.get("message")

        if not message_text:
            return

        
        await self.save_message(self.session_id, "user", message_text)

        
        await asyncio.sleep(0.5)
        ai_response = f"I received your message: '{message_text}'. (Brain Linking in Progress!)"

        
        await self.save_message(self.session_id, "ai", ai_response)

       
        await self.send(text_data=json.dumps({
            "role": "ai", 
            "content": ai_response,
            "session_id": self.session_id
        }))

    @database_sync_to_async
    def is_session_owner(self):
        """Verifies that the chat session exists and belongs to the authenticated user."""
        return ChatSession.objects.filter(id=self.session_id, user=self.user).exists()

    @database_sync_to_async
    def save_message(self, session_id, role, content):
        """Saves messages to PostgreSQL."""
        try:
            session = ChatSession.objects.get(id=session_id)
            return ChatMessage.objects.create(session=session, role=role, content=content)
        except ChatSession.DoesNotExist:
            # This should technically not happen due to is_session_owner check
            pass