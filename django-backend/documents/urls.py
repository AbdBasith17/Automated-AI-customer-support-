from django.urls import path
from .views import DocumentUploadView , AdminDocumentListView

urlpatterns = [
    path('upload/', DocumentUploadView.as_view(), name='document-upload'),
    path('admin/all-docs/', AdminDocumentListView.as_view(), name='admin-document-list'),
]