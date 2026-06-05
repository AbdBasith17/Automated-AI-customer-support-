from rest_framework import serializers

from .models import DocumentMetadata, ResourceDocument


class DocumentMetadataSerializer(serializers.ModelSerializer):
    owner_email = serializers.ReadOnlyField(source="owner.email")

    class Meta:
        model = DocumentMetadata
        fields = [
            "id",
            "owner_email",
            "title",
            "file_type",
            "s3_key",
            "status",
            "chunk_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "chunk_count", "created_at"]


class ResourceDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceDocument
        fields = [
            "id",
            "admin_given_name",
            "description",
            "s3_key",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "s3_key", "created_at", "updated_at"]
