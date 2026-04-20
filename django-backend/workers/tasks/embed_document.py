

import os
import boto3
from celery import shared_task
from django.conf import settings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


@shared_task(name='embed_document_task', bind=True, max_retries=3, default_retry_delay=60)
def embed_document(self, doc_id):
    """
    Celery task that:
      1. Fetches the document record from PostgreSQL
      2. Downloads the raw file from S3
      3. Extracts text using ParserService (handles PDF, DOCX, TXT)
      4. Splits text into chunks
      5. Generates Gemini embeddings
      6. (Pinecone upsert — wired in Phase 5 when FastAPI is ready)
      7. Marks the document as indexed
    """

    from documents.models import DocumentMetadata
    from documents.services.parser_service import ParserService

    try:
        doc = DocumentMetadata.objects.get(id=doc_id)
    except DocumentMetadata.DoesNotExist:
        
        print(f"[embed_document] Document {doc_id} not found. Skipping.")
        return

    # Mark as processing for UI to show a spinner
    doc.status = 'processing'
    doc.error_message = None
    doc.save(update_fields=['status', 'error_message', 'updated_at'])

    try:
        
        s3 = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )
        s3_obj = s3.get_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=doc.s3_key,
        )
        file_bytes = s3_obj['Body'].read()  

      
        raw_text = ParserService.extract_text(file_bytes, doc.file_type)

        if not raw_text.strip():
            raise ValueError("No text could be extracted from the document.")

        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
        )
        chunks = splitter.split_text(raw_text)

        if not chunks:
            raise ValueError("Text splitting produced zero chunks.")

        
        embeddings_model = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=settings.GOOGLE_API_KEY,
        )

       
        vectors = embeddings_model.embed_documents(chunks)

       

        print(f"[embed_document] '{doc.title}' → {len(chunks)} chunks, "
              f"vector dim={len(vectors[0])}")

        
        doc.status = 'indexed'
        doc.chunk_count = len(chunks)
        doc.error_message = None
        doc.save(update_fields=['status', 'chunk_count', 'error_message', 'updated_at'])

    except Exception as exc:
        
        doc.status = 'failed'
        doc.error_message = str(exc)
        doc.save(update_fields=['status', 'error_message', 'updated_at'])

        
        raise self.retry(exc=exc)