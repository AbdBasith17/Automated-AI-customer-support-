from rest_framework import serializers
from .models import DocumentMetadata

class DocumentMetadataSerializer(serializers.ModelSerializer):
    owner_email = serializers.ReadOnlyField(source='owner.email')

    class Meta:
        model = DocumentMetadata
        fields = [
            'id', 'owner_email', 'title', 'file_type', 
            's3_key', 'status', 'chunk_count', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'chunk_count', 'created_at']