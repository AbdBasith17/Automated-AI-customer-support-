from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()


@database_sync_to_async
def get_user(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


def get_token_from_scope(scope):
    """
    Extract JWT from cookie header OR ?token= query param Postman
    """
    # 1. Try cookie first
    headers = dict(scope.get("headers", {}))
    cookie_header = headers.get(b"cookie", b"").decode()
    cookies = {}
    for c in cookie_header.split(';'):
        if '=' in c:
            key, _, value = c.strip().partition('=')  # partition avoids truncating JWT '=' padding
            cookies[key] = value
    token = cookies.get("access_token")

    # 2.  Postman 
    if not token:
        query_string = scope.get("query_string", b"").decode()
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param[len("token="):]
                break

    return token


class JWTAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        token = get_token_from_scope(scope)

        if token:
            try:
                access_token_obj = AccessToken(token)
                user_id = access_token_obj["user_id"]
                scope["user"] = await get_user(user_id)
            except Exception:
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()

        return await self.app(scope, receive, send)