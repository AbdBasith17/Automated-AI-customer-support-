import uuid
import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):

    ROLE_ADMIN = "admin"
    ROLE_USER  = "user"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_USER,  "User"),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email       = models.EmailField(unique=True)
    first_name  = models.CharField(max_length=150)
    last_name   = models.CharField(max_length=150)
    role        = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_USER)
    is_verified = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    mfa_secret =  models.CharField(max_length=32, blank=True, null=True)
    is_mfa_enabled = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"


class OTPVerification(models.Model):

    user       = models.ForeignKey(User, on_delete=models.CASCADE)
    code       = models.CharField(max_length=6)
    is_used    = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"OTP for {self.user.email}"