from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import DocumentMetadata

User = get_user_model()

class DocumentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='password123',
            first_name='Test',
            last_name='User'
        )
        self.admin = User.objects.create_superuser(
            email='admin@example.com',
            password='password123',
            first_name='Admin',
            last_name='User'
        )
        self.client.force_authenticate(user=self.user)

    @patch('documents.services.s3_service.S3Service.upload_file')
    @patch('documents.signals.handle_document_upload') # Mock the signal to stop background tasks
    def test_upload_valid_pdf(self, mock_signal, mock_upload):
        mock_upload.return_value = True
        pdf_file = SimpleUploadedFile("test.pdf", b"pdf_data", content_type="application/pdf")
        
        url = "/api/documents/upload/"
        response = self.client.post(url, {"file": pdf_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_list_access(self):
        #
        url = "/api/documents/admin/all-docs/"
        
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('documents.services.s3_service.S3Service.delete_file')
    def test_document_deletion(self, mock_s3_delete):
        doc = DocumentMetadata.objects.create(
            owner=self.user, title="test.pdf", s3_key="test/key", status="ready"
        )
       
        url = f"/api/documents/delete/{doc.id}/"
        
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)