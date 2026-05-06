import os
import boto3
from boto3.dynamodb.conditions import Key
from celery import shared_task
from asgiref.sync import async_to_sync
from channels_redis.core import RedisChannelLayer
from services.query_service import QueryService

query_service = None

def get_query_service():
    global query_service
    if not query_service:
        query_service = QueryService()
    return query_service

def fetch_history_from_dynamo(session_id: str, limit: int = 20) -> str:
    try:
        dynamodb = boto3.resource(
            'dynamodb',
            region_name=os.getenv("AWS_REGION", "ap-south-1"),
            endpoint_url=os.getenv("DYNAMODB_URL")
        )
        table = dynamodb.Table(os.getenv("DYNAMODB_MESSAGES_TABLE", "AionChatMessages"))
        response = table.query(
            KeyConditionExpression=Key('session_id').eq(session_id),
            ScanIndexForward=False,
            Limit=limit
        )
        messages = response.get('Items', [])
        messages.reverse()
        return "\n".join([
            f"{m['role'].capitalize()}: {m['content']}"
            for m in messages
        ])
    
        return messages
    except Exception as e:
        print(f"DynamoDB Fetch Error: {e}")
        return ""


@shared_task(name="process_rag_query", bind=True, max_retries=2, queue="rag")
def process_rag_query(self, text: str, collection_name: str, session_id: str, user_data: dict = None):
    q_service = get_query_service()
    
    try:
        
        history = fetch_history_from_dynamo(session_id)

        # Call service with the user_data
        final_response = q_service.get_response(
            query=text,
            session_id=session_id,
            user_metadata=user_data, 
            collection_name=collection_name,
            chat_history=history
        )

        payload = {
            "type": "new_message",
            "role": "ai",
            "content": final_response.get("answer"),
            "sources": final_response.get("sources", []),
            "session_id": session_id,
            "status": final_response.get("status")
        }

    except Exception as e:
        print(f"Worker RAG Error [{session_id}]: {e}")
        # Retry before giving up
        try:
            raise self.retry(exc=e, countdown=5)
        except self.MaxRetriesExceededError:
            payload = {
                "type": "new_message",
                "role": "ai",
                "content": "I encountered an error processing your request.",
                "sources": [],
                "session_id": session_id
            }

    # Push result to Django Channels via Redis
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    channel_layer = RedisChannelLayer(hosts=[redis_url])

    async_to_sync(channel_layer.group_send)(
        f"chat_{session_id}",
        {
            "type": "ai_response_handler",
            "payload": payload
        }
    )