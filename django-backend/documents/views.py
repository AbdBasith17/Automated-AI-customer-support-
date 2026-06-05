import uuid

from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from workers.tasks.delete_document import delete_document_cleanup
from workers.tasks.embed_document import embed_document

from .models import DocumentMetadata, ResourceDocument
from .serializers import DocumentMetadataSerializer
from .services.s3_service import S3Service

# ── Cache key constants ───────────────────────────────────────────────────────
CACHE_ADMIN_DOCS = "admin_docs_list"
CACHE_RESOURCE_DOCS = "resource_docs_list"
CACHE_TTL_ADMIN = 120  # 2 minutes
CACHE_TTL_RESOURCE = 300  # 5 minutes


# ── Admin: Upload RAG document ─────────────────────────────────────────────────
class DocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "document_upload"

    def post(self, request):
        if request.user.role != "admin":
            raise PermissionDenied("Admin only")

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

        s3_key = f"documents/{request.user.id}/{uuid.uuid4()}-{file_obj.name}"

        try:
            S3Service().upload_file(file_obj, s3_key)

            # select_related not needed on create — owner is already the request user
            doc = DocumentMetadata.objects.create(
                owner=request.user,
                title=file_obj.name,
                file_type=file_type,
                s3_key=s3_key,
                status="pending",
            )

            embed_document.delay(str(doc.id))

            # Invalidate admin list cache on new upload
            cache.delete(CACHE_ADMIN_DOCS)

            serializer = DocumentMetadataSerializer(doc)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {"error": f"Upload failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ── Admin: Delete RAG document ─────────────────────────────────────────────────
class DocumentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "document_admin"

    def delete(self, request, pk):
        if request.user.role != "admin":
            raise PermissionDenied("Admin only")

        try:
            # only() — fetch just what's needed for deletion
            doc = DocumentMetadata.objects.only("id", "s3_key").get(pk=pk)
            s3_key = doc.s3_key
            doc_id = str(doc.id)
            doc.delete()
            delete_document_cleanup.delay(s3_key, doc_id)

            # Invalidate cache
            cache.delete(CACHE_ADMIN_DOCS)

            return Response(status=status.HTTP_204_NO_CONTENT)
        except DocumentMetadata.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)


# ── Admin: List all RAG documents ─────────────────────────────────────────────
class AdminDocumentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "document_admin"

    def get(self, request):
        if request.user.role != "admin":
            raise PermissionDenied("Admin only")

        # Try cache first
        cached = cache.get(CACHE_ADMIN_DOCS)
        if cached is not None:
            return Response(cached)

        # select_related('owner') — prevents N+1 on owner.email in serializer
        # defer() skips heavy fields not needed for the list view
        documents = (
            DocumentMetadata.objects.select_related("owner")
            .defer("error_message")  # not shown in list view
            .order_by("-created_at")
        )

        serializer = DocumentMetadataSerializer(documents, many=True)
        data = serializer.data

        cache.set(CACHE_ADMIN_DOCS, data, CACHE_TTL_ADMIN)
        return Response(data)
