import os

import requests
from celery import shared_task
from django.apps import apps
from django.conf import settings
import logging
logger = logging.getLogger(__name__)

@shared_task(name="embed_document_task", bind=True, max_retries=3)
def embed_document(self, document_id):
    DocumentMetadata = apps.get_model("documents", "DocumentMetadata")
    doc = None

    try:
        doc = DocumentMetadata.objects.get(id=document_id)
        doc.status = "processing"
        doc.save(update_fields=["status"])

        payload = {
        "s3_key": doc.s3_key,
        "bucket_name": settings.AWS_STORAGE_BUCKET_NAME, 
        "collection_name": "enterprise_docs", 
        "doc_metadata": {
            "document_id": str(doc.id),
            "title": doc.title,
            "owner_id": str(doc.owner_id) if hasattr(doc, 'owner_id') else None
        }
    }
        headers = {
        "X-Internal-API-Key": settings.INTERNAL_API_KEY, 
        "Content-Type": "application/json"
    }

        response = requests.post(   
        "http://ai-service:8001/ingest",
        json=payload,
        headers=headers,
        timeout=120
    )
        response.raise_for_status()  

        doc.status = "completed"
        doc.save(update_fields=["status"])

    except DocumentMetadata.DoesNotExist:
       
        logger.critical(f"Document {document_id} not found.")

    except requests.HTTPError as e:
        if e.response.status_code >= 500:
            # Retryable — don't mark as failed yet
            logger.warning(f"AI service 5xx, retrying... {e}")
            raise self.retry(exc=e, countdown=30 * (self.request.retries + 1))  # exponential backoff
        else:
            # 4xx — not retryable (bad payload etc)
            logger.error(f"AI service rejected request: {e}")
            if doc:
                doc.status = "failed"
                doc.save(update_fields=["status"])

    except Exception as e:
        logger.exception(f"Unexpected failure for document {document_id}")
        if self.request.retries >= self.max_retries:
            # Only mark failed after all retries exhausted
            if doc:
                doc.status = "failed"
                doc.save(update_fields=["status"])
        raise self.retry(exc=e, countdown=30 * (self.request.retries + 1))