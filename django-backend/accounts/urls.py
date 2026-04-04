from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    VerifyOTPView,
    ResendOTPView,
    LoginView,
    LogoutView,
    GoogleLoginView,
    MeView,
    SetupMFAView,
    ActivateMFAView,
    VerifyMFALoginView,
)

urlpatterns = [
    
    path("register/",       RegisterView.as_view(),       name="register"),
    path("verify-otp/",     VerifyOTPView.as_view(),      name="verify-otp"),
    path("resend-otp/",     ResendOTPView.as_view(),      name="resend-otp"),
    path("login/",          LoginView.as_view(),          name="login"),
    path("logout/",         LogoutView.as_view(),         name="logout"),
    path("token/refresh/",  TokenRefreshView.as_view(),   name="token-refresh"),
    path("google/",         GoogleLoginView.as_view(),    name="google_login"),
    path("me/",             MeView.as_view(),             name="me"),
    
    
    path("mfa/setup/",      SetupMFAView.as_view(),       name="mfa-setup"),
    path("mfa/activate/",   ActivateMFAView.as_view(),    name="mfa-activate"),
    path("mfa/verify-login/", VerifyMFALoginView.as_view(), name="mfa-verify-login"),
]