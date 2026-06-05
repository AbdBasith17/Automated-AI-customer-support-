import time
import uuid

from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()

# Simple in-memory cache: { user_id_str: (user_object, expires_at) }
_user_cache: dict = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _get_cached_user(user_id_str):
    entry = _user_cache.get(user_id_str)
    if entry:
        user, expires_at = entry
        if time.monotonic() < expires_at:
            return user
        del _user_cache[user_id_str]  # expired — evict
    return None


def _set_cached_user(user_id_str, user):
    _user_cache[user_id_str] = (user, time.monotonic() + _CACHE_TTL_SECONDS)


@database_sync_to_async
def get_user(user_id):
    user_id_str = str(user_id)

    cached = _get_cached_user(user_id_str)
    if cached:
        return cached

    close_old_connections()
    try:
        user_uuid = uuid.UUID(user_id_str)
        user = User.objects.get(id=user_uuid)
        _set_cached_user(user_id_str, user)
        return user
    except (User.DoesNotExist, ValueError, TypeError):
        return AnonymousUser()


def get_token_from_scope(scope):
    headers = dict(scope.get("headers", {}))
    cookie_header = headers.get(b"cookie", b"").decode()

    if not cookie_header:
        return None

    cookies = {
        k.strip(): v
        for k, v in (
            pair.split("=", 1) for pair in cookie_header.split(";") if "=" in pair
        )
    }
    return cookies.get("access_token") or cookies.get("access")


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
