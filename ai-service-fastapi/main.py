import os
import traceback
import asyncio
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from dotenv import load_dotenv
from starlette.status import HTTP_403_FORBIDDEN

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