from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .models import DocumentMetadata

User = get_user_model()


class DocumentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="password123",
            first_name="Test",
            last_name="User",
            role="user",
            is_verified=True,
        )
        self.admin = User.objects.create_superuser(
            email="admin@example.com",
            password="password123",
            first_name="Admin",
            last_name="User",
            role="admin",
            is_verified=True,
        )

    @patch("workers.tasks.embed_document.embed_document.delay")
    @patch("documents.views.S3Service.upload_file")
    def test_upload_valid_pdf(self, mock_upload, mock_embed_delay):
        # 💡 Authenticate as admin to pass the view's role constraint
        self.client.force_authenticate(user=self.admin)
        pdf_file = SimpleUploadedFile(
            "test.pdf",
            b"pdf_data",
            content_type="application/pdf",
        )

        response = self.client.post(
            "/api/documents/upload/",
            {"file": pdf_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "test.pdf")
        self.assertEqual(response.data["status"], "pending")
        mock_upload.assert_called_once()
        mock_embed_delay.assert_called_once()

    def test_rejects_unsupported_upload_type(self):
        # 💡 Authenticate as admin to pass the view's role constraint
        self.client.force_authenticate(user=self.admin)
        exe_file = SimpleUploadedFile(
            "malware.exe",
            b"nope",
            content_type="application/octet-stream",
        )

        response = self.client.post(
            "/api/documents/upload/",
            {"file": exe_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_list_access(self):
        response = self.client.get("/api/documents/admin/all-docs/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/documents/admin/all-docs/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/documents/admin/all-docs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch("documents.views.delete_document_cleanup.delay")
    def test_admin_document_deletion(self, mock_cleanup_delay):
        doc = DocumentMetadata.objects.create(
            owner=self.user,
            title="test.pdf",
            file_type="pdf",
            s3_key="test/key",
            status="indexed",
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.delete(f"/api/documents/admin/delete/{doc.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/documents/admin/delete/{doc.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DocumentMetadata.objects.filter(id=doc.id).exists())
        mock_cleanup_delay.assert_called_once_with("test/key", str(doc.id))
