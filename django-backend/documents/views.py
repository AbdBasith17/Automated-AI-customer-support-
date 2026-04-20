import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import DocumentMetadata
from .serializers import DocumentMetadataSerializer
from .services.s3_service import S3Service

class DocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Basic validation
        file_type = file_obj.name.split('.')[-1].lower()
        if file_type not in ['pdf', 'docx', 'txt']:
            return Response({"error": "Unsupported file type"}, status=status.HTTP_400_BAD_REQUEST)

        # Create unique S3 Key: documents/user_id/uuid-filename.ext
        s3_key = f"documents/{request.user.id}/{uuid.uuid4()}-{file_obj.name}"

        try:
            # 1. Upload to S3 via Service
            s3_client = S3Service()
            s3_client.upload_file(file_obj, s3_key)

            # 2. Save Metadata to Postgres
            doc_metadata = DocumentMetadata.objects.create(
                owner=request.user,
                title=file_obj.name,
                file_type=file_type,
                s3_key=s3_key,
                status='pending'
            )

            serializer = DocumentMetadataSerializer(doc_metadata)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            # In a real production app, you'd log this error
            return Response({"error": f"Upload failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

from rest_framework.exceptions import PermissionDenied

class AdminDocumentListView(APIView):
  
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        
        if not request.user.is_staff:
            raise PermissionDenied("You do not have permission to view the document registry.")

        
        documents = DocumentMetadata.objects.all().order_by('-created_at')
        serializer = DocumentMetadataSerializer(documents, many=True)
        return Response(serializer.data)