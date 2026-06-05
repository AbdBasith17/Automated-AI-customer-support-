from django.urls import path

from . import views

urlpatterns = [
    path("sessions/", views.get_user_chat_sessions, name="chat-sessions"),
    path("tickets/", views.get_user_tickets, name="chat-tickets"),
    path(
        "sessions/<str:session_id>/rename/",
        views.rename_chat_session,
        name="rename-session",
    ),
    path(
        "sessions/<str:session_id>/delete/",
        views.delete_chat_session,
        name="delete-session",
    ),
]
