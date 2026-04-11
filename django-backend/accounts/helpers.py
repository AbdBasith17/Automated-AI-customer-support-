from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken


def get_tokens_for_user(user):

    refresh = RefreshToken.for_user(user)

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def set_auth_cookies(response, tokens):
    # Access
    response.set_cookie(
        key="access_token",
        value=tokens["access"],
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        max_age=60 * 60,
    )
    # Refresh
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh"],
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        max_age=7 * 24 * 60 * 60,
    )
    return response


def get_user_data(user):

    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_verified": user.is_verified,
        "is_mfa_enabled": user.is_mfa_enabled,
    }
