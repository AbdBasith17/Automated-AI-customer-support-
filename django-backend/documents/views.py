import uuid

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DocumentMetadata
from .serializers import DocumentMetadataSerializer
from .services.s3_service import S3Service

from rest_framework.exceptions import PermissionDenied

from workers.tasks.delete_document import delete_document_cleanup

class DocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get("file")

        if not file_obj:
            return Response(
                {"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        
        file_type = file_obj.name.split(".")[-1].lower()
        if file_type not in ["pdf", "docx", "txt"]:
            return Response(
                {"error": "Unsupported file type"}, status=status.HTTP_400_BAD_REQUEST
            )

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
                status="pending",
            )

            serializer = DocumentMetadataSerializer(doc_metadata)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
           
            return Response(
                {"error": f"Upload failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DocumentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "Admin only"}, status=status.HTTP_403_FORBIDDEN)

        try:
            doc = DocumentMetadata.objects.get(pk=pk)
            
            # Prepare data for background cleanup
            s3_key = doc.s3_key
            doc_id = str(doc.id)

            # 1. Delete from Postgres
            doc.delete()

            # 2.background cleanup  run on 'aion-celery-worker'
            delete_document_cleanup.delay(s3_key, doc_id)

            return Response(status=status.HTTP_204_NO_CONTENT)
        except DocumentMetadata.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)




class AdminDocumentListView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):

        if not request.user.is_staff:
            raise PermissionDenied(
                "You do not have permission to view the document registry."
            )

        documents = DocumentMetadata.objects.all().order_by("-created_at")
        serializer = DocumentMetadataSerializer(documents, many=True)
        return Response(serializer.data)
