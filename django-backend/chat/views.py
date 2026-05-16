from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .services.dynamo_service import DynamoMessageService
from .services.ticket_service import TicketService          

db             = DynamoMessageService()
ticket_service = TicketService()                           


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_chat_sessions(request):
    chats = db.get_user_chat_list(request.user.email)
    return Response({"status": "success", "chats": chats})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_tickets(request):
    raw_tickets = ticket_service.get_user_tickets(request.user.email) 
    formatted_tickets = [
        {
            "ticket_id":  t.get("ticket_key"),
            "session_id": t.get("session_id"),
            "summary":    t.get("summary", ""),         
            "resolution_notes": t.get("resolution_notes", ""),
            "topic":      t.get("topic", "Support Ticket"),
            "status":     t.get("status", "open"),
            "created_at": t.get("created_at"),
        }
        for t in raw_tickets
    ]
    return Response({"status": "success", "tickets": formatted_tickets})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def rename_chat_session(request, session_id):
    new_topic = request.data.get('topic', '').strip()
    if not new_topic:
        return Response({"error": "Topic required"}, status=status.HTTP_400_BAD_REQUEST)
    success = db.rename_session(str(session_id), new_topic, request.user.email)
    if success:
        return Response({"status": "renamed", "topic": new_topic})
    return Response({"error": "Rename failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_chat_session(request, session_id):
    success = db.delete_session(str(session_id))
    if success:
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response({"error": "Delete failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)