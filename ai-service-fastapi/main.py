import os
import traceback
import asyncio
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any

import time
import boto3
from asgiref.sync import async_to_sync


from fastapi import FastAPI, HTTPException, Depends ,APIRouter, Request
from channels_redis.core import RedisChannelLayer

from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from dotenv import load_dotenv
from starlette.status import HTTP_403_FORBIDDEN

from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from services.vector_service import VectorService

vector_service: VectorService | None = None
executor = ThreadPoolExecutor(max_workers=4)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global vector_service
    try:
        print("--- INITIALIZING AI SERVICES ---")
        vector_service = VectorService()
        print("VectorService initialized successfully")
    except Exception as e:
        print(f"CRITICAL: VectorService initialization failed: {e}")
        traceback.print_exc()
    yield
    executor.shutdown(wait=True)

app = FastAPI(title="Aion AI Service - Ingestion Engine", lifespan=lifespan)

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
        return {"status": "degraded", "detail": "VectorService failed to initialize"}
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
        return {"status": "success", "chunks_created": chunk_count, "file": data.s3_key}
    except Exception as e:
        print(f"!!! INGESTION ERROR [{data.s3_key}]: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
router = APIRouter()

def save_resolution_to_dynamo(session_id: str, content: str):
    try:
        # Note: We use the environment variables available to FastAPI
        dynamodb = boto3.resource(
            'dynamodb',
            region_name=os.getenv("AWS_REGION", "ap-south-1")
        )
        table = dynamodb.Table(os.getenv("DYNAMODB_MESSAGES_TABLE", "AionChatMessages"))
        
        table.put_item(
            Item={
                'session_id': str(session_id),
                'timestamp': str(time.time_ns()), # Matching your Django precision
                'role': 'ai',
                'content': content,
                'status': 'ticket_resolved',
                'sources': []
            }
        )
        print(f"DEBUG: Saved resolution for {session_id} to DynamoDB")
    except Exception as e:
        print(f"FastAPI DynamoDB Error: {e}")

@router.post("/webhook/ticket-update")
async def ticket_resolved_notification(request: Request):
    data = await request.json()
    session_id = data.get("session_id")
    ticket_key = data.get("ticket_key")
    
    content = f"✅ **Update:** Your support ticket **{ticket_key}** has been resolved! Our team has finished the review."


    save_resolution_to_dynamo(session_id, content)


    redis_url = os.getenv("REDIS_URL", "redis://aion-redis:6379/0")
    channel_layer = RedisChannelLayer(hosts=[redis_url])

    payload = {
        "type": "ai_message",
        "role": "ai",
        "content": content,
        "session_id": session_id,
        "status": "ticket_resolved"
    }

    
    await channel_layer.group_send(
        f"chat_{session_id}",
        {
            "type": "ai_response_handler", 
            "payload": payload
        }
    )
    
    return {"status": "pushed_to_ui_and_saved"}



class TokenRegistration(BaseModel):
    session_id: str  
    fcm_token: str


@router.post("/register-token")
async def register_fcm_token(data: TokenRegistration):
    try:
       
        dynamodb = boto3.resource(
            'dynamodb', 
            region_name="ap-south-1",
            
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
        )
        table = dynamodb.Table("AionUserTokens")
        
        table.put_item(
            Item={
                'session_id': data.session_id,
                'fcm_token': data.fcm_token,
                'updated_at': str(int(time.time()))
            }
        )
        return {"message": "Token registered successfully"}
    except Exception as e:
        
        print(f"DYNAMODB ERROR: {e}") 
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

app.include_router(router)