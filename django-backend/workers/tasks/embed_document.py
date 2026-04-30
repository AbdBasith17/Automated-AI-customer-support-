# workers/tasks/embed_document.py
import requests
from celery import shared_task
from django.apps import apps
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def _mark_failed(doc):
    """Safe helper — avoids repeating save logic across exception branches."""
    if doc:
        doc.status = "failed"
        doc.save(update_fields=["status"])


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
            "collection_name": settings.AI_COLLECTION_NAME,  # move out of hardcode
            "doc_metadata": {
                "document_id": str(doc.id),
                "title": doc.title,
                "owner_id": str(doc.owner_id) if hasattr(doc, "owner_id") else None,
            },
        }
        headers = {
            "X-Internal-API-Key": settings.INTERNAL_API_KEY,
            "Content-Type": "application/json",
        }

        response = requests.post(
            "http://ai-service:8001/ingest",
            json=payload,
            headers=headers,
            timeout=120,
        )
        response.raise_for_status()

        doc.status = "completed"
        doc.save(update_fields=["status"])

    except DocumentMetadata.DoesNotExist:
        
        logger.critical(f"Document {document_id} not found in database.")

    except requests.HTTPError as e:
        status_code = e.response.status_code if e.response is not None else None

        if status_code is not None and status_code >= 500:
        
            logger.warning(f"AI service {status_code}, retry {self.request.retries}/{self.max_retries}: {e}")
            try:
                raise self.retry(exc=e, countdown=30 * (self.request.retries + 1))
            except self.MaxRetriesExceededError:
                
                logger.error(f"Max retries exceeded on 5xx for document {document_id}")
                _mark_failed(doc)
                raise
        else:
           
            logger.error(f"AI service rejected request ({status_code}) for document {document_id}: {e}")
            _mark_failed(doc)

    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
        # Network-level failure -- retryable, separate from HTTPError for clarity
        logger.warning(f"Network error contacting AI service, retry {self.request.retries}/{self.max_retries}: {e}")
        try:
            raise self.retry(exc=e, countdown=30 * (self.request.retries + 1))
        except self.MaxRetriesExceededError:
            logger.error(f"Max retries exceeded on network error for document {document_id}")
            _mark_failed(doc)
            raise

    except Exception as e:
        logger.exception(f"Unexpected failure for document {document_id}")
        try:
            raise self.retry(exc=e, countdown=30 * (self.request.retries + 1))
        except self.MaxRetriesExceededError:
            logger.error(f"Max retries exceeded for document {document_id}")
            _mark_failed(doc)
            raise