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

# CRITICAL: Load env before importing services that use them
load_dotenv()

from services.vector_service import VectorService
from services.query_service import QueryService

# Global service instances
query_service: QueryService | None = None
vector_service: VectorService | None = None

# Keep the executor! PyMuPDF and LLM calls are CPU/IO bound.
# 4 workers is a sweet spot for most small-to-medium containers.
executor = ThreadPoolExecutor(max_workers=4)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global vector_service, query_service
    try:
        print("---  INITIALIZING AI SERVICES ---")
        vector_service = VectorService()
        query_service = QueryService()
        print("AI Services (Vector & Query) initialized successfully")
    except Exception as e:
        print(f" CRITICAL: Service initialization failed: {e}")
        traceback.print_exc()
    
    yield
    
    print("--- SHUTTING DOWN ---")
    executor.shutdown(wait=True)

app = FastAPI(
    title="Aion AI Service - Lean RAG Engine",
    description="FastAPI service for PDF/Docx ingestion and Groq-powered RAG",
    lifespan=lifespan
)

# --- SECURITY ---
API_KEY_NAME = "X-Internal-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def verify_internal_key(header_value: str = Depends(api_key_header)):
    expected_key = os.getenv("INTERNAL_API_KEY")
    if header_value and header_value == expected_key:
        return header_value
    raise HTTPException(
        status_code=HTTP_403_FORBIDDEN, 
        detail="Access Denied: Invalid Internal Key"
    )

# --- SCHEMAS ---
class IngestRequest(BaseModel):
    s3_key: str
    bucket_name: str
    collection_name: str
    doc_metadata: Dict[str, Any] = {}

class QueryRequest(BaseModel):
    text: str
    collection_name: str = "enterprise_docs"

# --- ENDPOINTS ---

@app.get("/health")
async def health():
    """Checks the health of ChromaDB and AI initialization."""
    status = {"status": "healthy", "components": {}}
    
    if vector_service is None or query_service is None:
        return {"status": "degraded", "detail": "Core services failed to initialize - check server logs"}

    try:
        vector_service.chroma_client.heartbeat()
        status["components"]["chromadb"] = "connected"
    except Exception as e:
        status["status"] = "degraded"
        status["components"]["chromadb"] = f"unreachable: {str(e)}"

    return status

@app.post("/ingest")
async def ingest_document(
    data: IngestRequest,
    authenticated: str = Depends(verify_internal_key)
):
    """Downloads from S3, extracts text using PyMuPDF, and stores vectors."""
    print(f"--- INGEST REQUEST: {data.s3_key} ---")

    if vector_service is None:
        raise HTTPException(status_code=503, detail="VectorService not initialized")

    try:
        # Running in executor keeps the API responsive during heavy parsing
        chunk_count = await asyncio.get_event_loop().run_in_executor(
            executor,
            lambda: vector_service.process_from_s3(
                s3_key=data.s3_key,
                bucket=data.bucket_name,
                collection_name=data.collection_name,
                doc_metadata=data.doc_metadata
            )
        )

        return {
            "status": "success",
            "chunks_created": chunk_count,
            "file": data.s3_key
        }

    except Exception as e:
        print(f"!!!  INGESTION ERROR [{data.s3_key}]: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ingestion failed for {data.s3_key}: {str(e)}")

@app.post("/query")
async def chat_query(
    data: QueryRequest, 
    auth: str = Depends(verify_internal_key)
):
    """RAG Pipeline: Query Rewriting -> Vector Search -> Groq Answer."""
    print(f"---  QUERY REQUEST: {data.text[:50]}... ---")

    if query_service is None:
        raise HTTPException(status_code=503, detail="QueryService not initialized")

    try:
        response = await asyncio.get_event_loop().run_in_executor(
            executor,
            lambda: query_service.get_response(data.text, data.collection_name)
        )
        return response

    except Exception as e:
        print(f"!!!  RAG ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))