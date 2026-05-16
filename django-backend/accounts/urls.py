from django.urls import path,include


from .views import (
    ActivateMFAView,
    GoogleLoginView,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    RequestPasswordResetView,
    ResendOTPView,
    ResetPasswordConfirmView,
    SetupMFAView,
    VerifyMFALoginView,
    VerifyOTPView,
    CustomTokenRefreshView,
    
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("resend-otp/", ResendOTPView.as_view(), name="resend-otp"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", CustomTokenRefreshView.as_view(), name="token-refresh"),
    path("google/", GoogleLoginView.as_view(), name="google_login"),
    path("me/", MeView.as_view(), name="me"),
    path(
        "password-reset/",
        RequestPasswordResetView.as_view(),
        name="password_reset_request",
    ),
    path(
        "password-reset-confirm/",
        ResetPasswordConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("mfa/setup/", SetupMFAView.as_view(), name="mfa-setup"),
    path("mfa/activate/", ActivateMFAView.as_view(), name="mfa-activate"),
    path("mfa/verify-login/", VerifyMFALoginView.as_view(), name="mfa-verify-login"),

     path("admin/", include("accounts.admin_urls")),
]
