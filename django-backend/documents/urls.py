from django.urls import include, path

from .views import AdminDocumentListView, DocumentDeleteView, DocumentUploadView

urlpatterns = [
    path("upload/", DocumentUploadView.as_view(), name="document-upload"),
    path(
        "admin/all-docs/", AdminDocumentListView.as_view(), name="admin-document-list"
    ),
    path(
        "admin/delete/<uuid:pk>/", DocumentDeleteView.as_view(), name="document-delete"
    ),
    path("", include("documents.resource_urls")),
]
