from django.urls import path

from .admin_views import (
    AdminUserListView,
    AdminUserDetailView,
    AdminUserAnalyticsView,
)

# Mount these under /api/auth/admin/ in your main urls.py
urlpatterns = [
    path("users/",              AdminUserListView.as_view(),      name="admin-user-list"),
    path("users/<uuid:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("analytics/users/",    AdminUserAnalyticsView.as_view(), name="admin-user-analytics"),
]