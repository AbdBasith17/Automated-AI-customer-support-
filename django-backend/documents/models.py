import uuid

from django.conf import settings
from django.db import models


class DocumentMetadata(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("indexed", "Indexed"),
        ("failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)
    s3_key = models.CharField(max_length=512, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    chunk_count = models.IntegerField(default=0)

    is_approved = models.BooleanField(default=False)

    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
