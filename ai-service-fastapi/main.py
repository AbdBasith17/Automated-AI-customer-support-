import os
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.vector_service import VectorService
from dotenv import load_dotenv
from starlette.status import HTTP_403_FORBIDDEN

load_dotenv()

app = FastAPI(title="Aion AI Service - RAG Engine")
vector_service = VectorService()


API_KEY_NAME = "X-Internal-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def verify_internal_key(header_value: str = Depends(api_key_header)):
    if header_value == os.getenv("INTERNAL_API_KEY"):
        return header_value
    raise HTTPException(
        status_code=HTTP_403_FORBIDDEN, detail="Access Denied: Invalid Internal Key"
    )


class IngestRequest(BaseModel):
    s3_key: str
    bucket_name: str
    collection_name: str
    doc_metadata: Dict[str, Any]

@app.get("/health")
async def health():
    return {"status": "healthy", "database": "connected"}


@app.post("/ingest")
async def ingest_document(
    data: IngestRequest, 
    authenticated: str = Depends(verify_internal_key)
):
    """
    Downloads from S3, performs Recursive Semantic Chunking,
    generates Gemini Embeddings, and stores in ChromaDB.
    """
    try:
        chunk_count = vector_service.process_from_s3(
            s3_key=data.s3_key,
            bucket=data.bucket_name,
            collection_name=data.collection_name,
            doc_metadata=data.doc_metadata
        )
        return {
            "status": "success", 
            "chunks_created": chunk_count,
            "message": f"Successfully processed {data.s3_key}"
        }
    except Exception as e:
        
        raise HTTPException(status_code=500, detail=str(e))