import uuid
from django.db import close_old_connections
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def get_user(user_id):
    """
    Explicitly cast to UUID and clear old connections to prevent handshake failure.
    """
    close_old_connections()
    try:
        # Cast to UUID to ensure compatibility with your accounts/models.py
        user_uuid = uuid.UUID(str(user_id))
        return User.objects.get(id=user_uuid)
    except (User.DoesNotExist, ValueError, TypeError):
        return AnonymousUser()

def get_token_from_scope(scope):
    headers = dict(scope.get("headers", {}))
    cookie_header = headers.get(b"cookie", b"").decode()

    if cookie_header:
        cookies = {
            k.strip(): v for k, v in
            [pair.split('=', 1) for pair in cookie_header.split(';') if '=' in pair]
        }
        # Check both names — simplejwt default is "access", custom setups use "access_token"
        token = cookies.get("access_token") or cookies.get("access")
        if token:
            return token

    # Query param fallback — used when frontend passes ?token=...
    query_string = scope.get("query_string", b"").decode()
    if query_string:
        params = dict(qc.split("=") for qc in query_string.split("&") if "=" in qc)
        return params.get("token")

    return None

class JWTAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        token = get_token_from_scope(scope)

        if token:
            try:
                # Validate token and extract user_id
                access_token_obj = AccessToken(token)
                user_id = access_token_obj["user_id"]
                
                # Assign actual user object to scope
                scope["user"] = await get_user(user_id)
            except Exception as e:
                # If token is expired or invalid
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()

        # Add debug logging to your terminal to verify the fix
        user_status = "Authenticated" if scope["user"].is_authenticated else "Anonymous"
        print(f"[WS Auth] User: {scope['user']} | Status: {user_status}")

        return await self.app(scope, receive, send)