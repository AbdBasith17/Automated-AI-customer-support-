import os
import json
import time
import traceback
import asyncio
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any
from datetime import datetime, timezone

import boto3
from asgiref.sync import async_to_sync

from fastapi import FastAPI, HTTPException, Depends, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from dotenv import load_dotenv
from starlette.status import HTTP_403_FORBIDDEN
from channels_redis.core import RedisChannelLayer
from confluent_kafka import Producer as KafkaProducer

load_dotenv()

from services.vector_service import VectorService
from services.cache_service import CacheService
from workers.kafka_consumer import start_kafka_consumer

vector_service: VectorService | None = None
executor = ThreadPoolExecutor(max_workers=4)

# Module-level Kafka producer — shared across requests
kafka_producer = KafkaProducer({
    "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP", "kafka:9092"),
    "socket.timeout.ms": 5000,
    "delivery.timeout.ms": 10000,
})


@asynccontextmanager
async def lifespan(app: FastAPI):
    global vector_service
    try:
        print("--- INITIALIZING AI SERVICES ---")
        vector_service = VectorService()
        print("VectorService initialized")

        # Start Kafka consumer background thread
        cache = CacheService()
        start_kafka_consumer(cache.client)   # cache.client — matches CacheService
        print("Kafka consumer started")

    except Exception as e:
        print(f"CRITICAL: Startup failed: {e}")
        traceback.print_exc()
    yield
    executor.shutdown(wait=True)


app = FastAPI(title="Aion AI Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY_NAME = "X-Internal-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


async def verify_internal_key(header_value: str = Depends(api_key_header)):
    if header_value and header_value == os.getenv("INTERNAL_API_KEY"):
        return header_value
    raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Access Denied")


class IngestRequest(BaseModel):
    s3_key: str
    bucket_name: str
    collection_name: str
    doc_metadata: Dict[str, Any] = {}


@app.get("/health")
async def health():
    if vector_service is None:
        return {"status": "degraded", "detail": "VectorService not initialized"}
    try:
        vector_service.chroma_client.heartbeat()
        return {"status": "healthy", "components": {"chromadb": "connected"}}
    except Exception as e:
        return {"status": "degraded", "components": {"chromadb": f"unreachable: {e}"}}


@app.post("/ingest")
async def ingest_document(
    data: IngestRequest,
    authenticated: str = Depends(verify_internal_key)
):
    print(f"--- INGEST REQUEST: {data.s3_key} ---")
    if vector_service is None:
        raise HTTPException(status_code=503, detail="VectorService not initialized")
    try:
        chunk_count = await asyncio.get_event_loop().run_in_executor(
            executor,
            lambda: vector_service.process_from_s3(
                s3_key=data.s3_key,
                bucket=data.bucket_name,
                collection_name=data.collection_name,
                doc_metadata=data.doc_metadata
            )
        )

        # Produce cache invalidation event after successful ingestion
        try:
            kafka_producer.produce(
                "cache.invalidate",
                key=data.collection_name,
                value=json.dumps({
                    "collection": data.collection_name,
                    "source": data.s3_key,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
            )
            kafka_producer.poll(0)
        except Exception as ke:
            print(f"[Kafka] cache.invalidate produce error: {ke}")

        return {"status": "success", "chunks_created": chunk_count, "file": data.s3_key}

    except Exception as e:
        print(f"!!! INGESTION ERROR [{data.s3_key}]: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Existing router (webhook + register-token) ─────────────────────────────
router = APIRouter()


def save_resolution_to_dynamo(session_id: str, content: str):
    try:
        dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "ap-south-1"))
        table = dynamodb.Table(os.getenv("DYNAMODB_MESSAGES_TABLE", "AionChatMessages"))
        table.put_item(Item={
            "session_id": str(session_id),
            "timestamp": str(time.time_ns()),
            "role": "ai",
            "content": content,
            "status": "ticket_resolved",
            "sources": [],
        })
    except Exception as e:
        print(f"FastAPI DynamoDB Error: {e}")


@router.post("/webhook/ticket-update")
async def ticket_resolved_notification(request: Request):
    data = await request.json()
    session_id = data.get("session_id")
    ticket_key = data.get("ticket_key")
    # Grab details from Jira/n8n if available, otherwise use a fallback
    resolution_notes = data.get("resolution_notes", "The technical team has completed the fix.")

    # --- THE "HUMANIZING" STEP ---
    # We use a quick prompt to turn the Jira status into a natural message
    human_content = query_service.generate_resolution_announcement(
        ticket_key=ticket_key,
        notes=resolution_notes
    )

    # Save the AI-generated version to Dynamo so it's in the chat history
    save_resolution_to_dynamo(session_id, human_content)

    # Push the AI-generated message to the UI
    redis_url = os.getenv("REDIS_URL", "redis://aion-redis:6379/0")
    channel_layer = RedisChannelLayer(hosts=[redis_url])
    
    await channel_layer.group_send(
        f"chat_{session_id}",
        {
            "type": "ai_response_handler", 
            "payload": {
                "type": "ai_message", 
                "role": "ai",
                "content": human_content,
                "session_id": session_id, 
                "status": "ticket_resolved"
            }
        }
    )
    return {"status": "personalized_notification_sent"}


class TokenRegistration(BaseModel):
    session_id: str
    fcm_token: str


@router.post("/register-token")
async def register_fcm_token(data: TokenRegistration):
    try:
        dynamodb = boto3.resource(
            "dynamodb", region_name="ap-south-1",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        table = dynamodb.Table("AionUserTokens")
        table.put_item(Item={
            "session_id": data.session_id,
            "fcm_token": data.fcm_token,
            "updated_at": str(int(time.time())),
        })
        return {"message": "Token registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


app.include_router(router)

# ── Analytics router ────────────────────────────────────────────────────────
from api.v1.endpoints.analytics import router as analytics_router
app.include_router(analytics_router)