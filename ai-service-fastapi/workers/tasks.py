import os
import time
import boto3
import traceback
from boto3.dynamodb.conditions import Key
from celery import shared_task
from asgiref.sync import async_to_sync
from channels_redis.core import RedisChannelLayer
from services.query_service import QueryService
from services.ticket_service import TicketService

query_service  = None
ticket_service = TicketService()


def get_query_service():
    global query_service
    if not query_service:
        query_service = QueryService()
    return query_service


def _get_dynamo_table():
    dynamodb = boto3.resource(
        "dynamodb",
        region_name=os.getenv("AWS_REGION", "ap-south-1"),
        endpoint_url=os.getenv("DYNAMODB_URL"),
    )
    return dynamodb.Table(os.getenv("DYNAMODB_MESSAGES_TABLE", "AionChatMessages"))


def fetch_history_from_dynamo(session_id: str, limit: int = 20) -> str:
    try:
        table    = _get_dynamo_table()
        response = table.query(
            KeyConditionExpression=Key("session_id").eq(session_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        items = [m for m in response.get("Items", []) if m.get("role") in ("user", "ai")]
        items.reverse()
        history_str = "\n".join(
            f"{m['role'].capitalize()}: {m['content']}" for m in items
        )
        return history_str[-3000:] if len(history_str) > 3000 else history_str
    except Exception as e:
        print(f"[Worker] fetch_history error: {e}")
        return ""


def get_session_topic(session_id: str) -> str:
    try:
        table    = _get_dynamo_table()
        response = table.query(
            KeyConditionExpression=Key("session_id").eq(session_id),
            ScanIndexForward=True,
            Limit=10,
        )
        for item in response.get("Items", []):
            if item.get("role") in ("user", "ai"):
                return item.get("topic", "New Chat")
        return "New Chat"
    except Exception as e:
        print(f"[Worker] get_session_topic error: {e}")
        return "New Chat"


def save_ai_message(
    session_id: str,
    content: str,
    user_email: str,
    sources: list,
    topic: str,
    status: str = None,
):
    """
    Saves AI message to AionChatMessages.
    Ticket data is now in AionTickets — nothing ticket-specific goes here.
    """
    try:
        table = _get_dynamo_table()
        item  = {
            "session_id": str(session_id),
            "timestamp":  str(time.time_ns()),
            "user_email": user_email,
            "topic":      topic,
            "role":       "ai",
            "content":    content,
            "sources":    sources or [],
        }
        if status:
            item["status"] = status  # e.g. "ticket_created" — for UI badge only
        table.put_item(Item=item)
        print(f"[Worker] AI message saved for session {session_id}")
    except Exception as e:
        print(f"[Worker] save_ai_message error: {e}")


@shared_task(name="process_rag_query", bind=True, max_retries=2, queue="rag")
def process_rag_query(
    self,
    text: str,
    collection_name: str,
    session_id: str,
    user_data: dict = None,
):
    q_service  = get_query_service()
    user_email = (user_data or {}).get("email", "")

    try:
        history         = fetch_history_from_dynamo(session_id)
        existing_ticket = ticket_service.session_has_ticket(session_id)  # clean GSI query
        topic           = get_session_topic(session_id)

        final_response = q_service.get_response(
            query=text,
            session_id=session_id,
            user_metadata=user_data,
            collection_name=collection_name,
            chat_history=history,
            has_existing_ticket=existing_ticket,
        )

        answer     = final_response.get("answer", "")
        sources    = final_response.get("sources", [])
        status     = final_response.get("status")
        ticket_key = final_response.get("ticket_key") if status == "ticket_created" else None

        # Save chat message — no ticket_key, just status badge
        save_ai_message(
            session_id=session_id,
            content=answer,
            user_email=user_email,
            sources=sources,
            topic=topic,
            status=status,
        )

        # Write ticket to AionTickets if one was just created
        if status == "ticket_created" and ticket_key:
            ticket_service.create_ticket(
                ticket_key=ticket_key,
                user_email=user_email,
                session_id=session_id,
                topic=topic,
                summary=final_response.get("summary", ""),
                description=text[:300],
            )

        payload = {
            "type":       "new_message",
            "role":       "ai",
            "content":    answer,
            "sources":    sources,
            "session_id": session_id,
            "status":     status,
            "ticket_key": ticket_key,  # frontend uses this to trigger sidebar refresh
        }

    except Exception as e:
        print(f"[Worker] RAG error [{session_id}]: {e}")
        traceback.print_exc()
        try:
            raise self.retry(exc=e, countdown=5)
        except self.MaxRetriesExceededError:
            payload = {
                "type":       "new_message",
                "role":       "ai",
                "content":    "I encountered an error processing your request. Please try again.",
                "sources":    [],
                "session_id": session_id,
            }

    redis_url     = os.getenv("REDIS_URL", "redis://redis:6379/0")
    channel_layer = RedisChannelLayer(hosts=[redis_url])
    async_to_sync(channel_layer.group_send)(
        f"chat_{session_id}",
        {"type": "ai_response_handler", "payload": payload},
    )