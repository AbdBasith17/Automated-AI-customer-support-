from django.urls import path

from . import resource_views

urlpatterns = [
    # Admin routes
    path(
        "admin/resources/",
        resource_views.AdminResourceDocumentView.as_view(),
        name="admin-resource-list-create",
    ),
    path(
        "admin/resources/<uuid:pk>/",
        resource_views.AdminResourceDocumentDetailView.as_view(),
        name="admin-resource-detail",
    ),
    # User routes
    path(
        "resources/",
        resource_views.UserResourceDocumentListView.as_view(),
        name="user-resource-list",
    ),
    path(
        "resources/<uuid:pk>/url/",
        resource_views.ResourceDocumentURLView.as_view(),
        name="resource-generate-url",
    ),
]
