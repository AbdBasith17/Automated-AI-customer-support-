from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import DocumentMetadata
 
 
@receiver(post_save, sender=DocumentMetadata)
def trigger_document_processing(sender, instance, created, **kwargs):
    """
    Fires when a new DocumentMetadata row is created.
    Sends the document ID to the Celery embedding queue.
    """
    if not created:
        
        return
 
    from workers.tasks.embed_document import embed_document
 
 
    embed_document.delay(str(instance.id))
 
    print(f"[Signal] Document {instance.id} queued for embedding.")