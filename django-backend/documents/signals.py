import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import DocumentMetadata

logger = logging.getLogger(__name__)


@receiver(post_save, sender=DocumentMetadata)
def trigger_document_processing(sender, instance, created, **kwargs):
    """
    Fires after a new DocumentMetadata row is committed to the DB.
    Uses on_commit to guarantee the row is visible before Celery picks it up.
    """
    if not created:
        return

    def queue_task():
        from workers.tasks.embed_document import embed_document

        embed_document.delay(str(instance.id))
        logger.info(
            f"[Signal] Document {instance.id} ({instance.title}) "
            f"committed to DB — queued for embedding."
        )

    transaction.on_commit(queue_task)
