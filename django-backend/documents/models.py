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
    file_type = models.CharField(max_length=50, db_index=True)
    s3_key = models.CharField(max_length=512, unique=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True
    )  #
    chunk_count = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            # Compound index — admin list filters by status + orders by created_at
            models.Index(
                fields=["status", "-created_at"], name="doc_status_created_idx"
            ),
            # Owner lookups
            models.Index(fields=["owner", "status"], name="doc_owner_status_idx"),
        ]

    def __str__(self):
        return self.title


class ResourceDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin_given_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    s3_key = models.CharField(max_length=512, unique=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["-created_at"], name="resource_doc_created_idx"),
        ]

    def __str__(self):
        return self.admin_given_name
