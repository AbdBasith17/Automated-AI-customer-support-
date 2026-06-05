import uuid

from django.core.cache import cache
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from workers.tasks.delete_document import delete_document_cleanup

from .models import ResourceDocument
from .serializers import ResourceDocumentSerializer
from .services.s3_service import S3Service

# ── Cache keys + TTLs ─────────────────────────────────────────────────────────
CACHE_USER_DOCS = "resource_docs_user_list"
CACHE_ADMIN_DOCS = "resource_docs_admin_list"
TTL_USER = 300  # 5 minutes — user list changes infrequently
TTL_ADMIN = 120  # 2 minutes — admin needs fresher data


def _invalidate_doc_caches():
    """Call after any create / update / delete."""
    cache.delete_many([CACHE_USER_DOCS, CACHE_ADMIN_DOCS])


# ── Admin: List + Upload ───────────────────────────────────────────────────────
class AdminResourceDocumentView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resource_admin"

    def get(self, request):
        if request.user.role != "admin":
            raise PermissionDenied("Admin only")

        cached = cache.get(CACHE_ADMIN_DOCS)
        if cached is not None:
            return Response(cached)

        # select_related — avoids N+1 on uploaded_by.email in serializer
        # only() — skip fields not shown in admin list
        docs = (
            ResourceDocument.objects.select_related("uploaded_by")
            .only(
                "id",
                "admin_given_name",
                "description",
                "s3_key",
                "created_at",
                "updated_at",
                "uploaded_by__email",
            )
            .order_by("-created_at")
        )
        data = ResourceDocumentSerializer(docs, many=True).data
        cache.set(CACHE_ADMIN_DOCS, data, TTL_ADMIN)
        return Response(data)

    def post(self, request):
        if request.user.role != "admin":
            raise PermissionDenied("Admin only")

        file_obj = request.FILES.get("file")
        admin_given_name = request.data.get("admin_given_name")
        description = request.data.get("description", "")

        if not file_obj or not admin_given_name:
            return Response(
                {"error": "File and admin_given_name are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not file_obj.name.lower().endswith(".pdf"):
            return Response(
                {"error": "Only PDF files are allowed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        s3_key = f"resources/{uuid.uuid4()}-{file_obj.name}"

        try:
            S3Service().upload_file(file_obj, s3_key)

            doc = ResourceDocument.objects.create(
                admin_given_name=admin_given_name,
                description=description,
                s3_key=s3_key,
                uploaded_by=request.user,
            )

            _invalidate_doc_caches()  # new doc — both caches stale

            return Response(
                ResourceDocumentSerializer(doc).data, status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ── Admin: Edit + Delete ───────────────────────────────────────────────────────
class AdminResourceDocumentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resource_admin"

    def put(self, request, pk):
        if request.user.role != "admin":
            raise PermissionDenied("Admin only")

        doc = get_object_or_404(ResourceDocument, pk=pk)
        serializer = ResourceDocumentSerializer(doc, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            _invalidate_doc_caches()  # name/description changed — invalidate
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if request.user.role != "admin":
            raise PermissionDenied("Admin only")

        # only() — fetch just what's needed, skip description
        doc = get_object_or_404(ResourceDocument.objects.only("id", "s3_key"), pk=pk)
        s3_key = doc.s3_key
        doc_id = str(doc.id)

        doc.delete()
        delete_document_cleanup.delay(s3_key, doc_id)
        _invalidate_doc_caches()  # doc removed — invalidate

        return Response(status=status.HTTP_204_NO_CONTENT)


# ── User: Browse document library ─────────────────────────────────────────────
class UserResourceDocumentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resource_user"

    def get(self, request):
        cached = cache.get(CACHE_USER_DOCS)
        if cached is not None:
            return Response(cached)

        # Users don't need uploaded_by — only public-facing fields
        docs = ResourceDocument.objects.only(
            "id", "admin_given_name", "description", "created_at"
        ).order_by("-created_at")
        data = ResourceDocumentSerializer(docs, many=True).data
        cache.set(CACHE_USER_DOCS, data, TTL_USER)
        return Response(data)


# ── Both: Generate pre-signed S3 URL ──────────────────────────────────────────
class ResourceDocumentURLView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resource_download"

    def get(self, request, pk):
        # only() — just need s3_key and name for URL generation
        doc = get_object_or_404(
            ResourceDocument.objects.only("id", "s3_key", "admin_given_name"), pk=pk
        )
        action_type = request.query_params.get("action", "view")

        try:
            url = S3Service().generate_presigned_url(
                doc.s3_key,
                expiration=3600,
                action_type=action_type,
                filename=doc.admin_given_name,
            )
            return Response({"url": url, "name": doc.admin_given_name})
        except Exception as e:
            return Response(
                {"error": "Could not generate link"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
