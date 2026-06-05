import logging

import requests
from celery import shared_task
from django.conf import settings

from documents.services.s3_service import S3Service

logger = logging.getLogger(__name__)


@shared_task(name="delete_document_cleanup_task", bind=True, max_retries=3)
def delete_document_cleanup(self, s3_key, document_id):
    try:

        s3 = S3Service()
        s3.delete_file(s3_key)

        url = "http://ai-service:8001/delete-vectors"

        payload = {
            "document_id": document_id,
            "collection_name": settings.AI_COLLECTION_NAME,
        }
        headers = {"X-Internal-API-Key": settings.INTERNAL_API_KEY}

        response = requests.delete(url, json=payload, headers=headers, timeout=20)
        response.raise_for_status()

    except Exception as e:
        logger.error(f"Deletion failed for {document_id}: {e}")
        # Retry with backoff if S3 or AI service is blipping
        raise self.retry(exc=e, countdown=60)
