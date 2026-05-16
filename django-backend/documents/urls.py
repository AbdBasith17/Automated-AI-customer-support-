from django.urls import path

from .views import AdminDocumentListView, DocumentUploadView, DocumentDeleteView

urlpatterns = [
   
    path("upload/", DocumentUploadView.as_view(), name="document-upload"),
    
    
    path(
        "admin/all-docs/", 
        AdminDocumentListView.as_view(), 
        name="admin-document-list"
    ),
    
    
    path(
        "admin/delete/<uuid:pk>/", 
        DocumentDeleteView.as_view(), 
        name="document-delete"
    ),
]