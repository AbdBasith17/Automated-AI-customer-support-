from rest_framework_simplejwt.tokens import RefreshToken


def get_tokens_for_user(user):
    # Create a refresh token for this user
    refresh = RefreshToken.for_user(user)

    return {
        "refresh": str(refresh),
        "access":  str(refresh.access_token),
    }


def get_user_data(user):
    # dict of safe user fields to include in responses
    return {
        "id":         str(user.id),
        "email":      user.email,
        "first_name": user.first_name,
        "last_name":  user.last_name,
        "role":       user.role,
        "is_verified":  user.is_verified,
        "is_mfa_enabled": user.is_mfa_enabled,
    }