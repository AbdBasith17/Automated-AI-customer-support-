# apps/accounts/managers.py

from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):

    def create_user(self, email, password, first_name, last_name, **extra_fields):

        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            first_name=first_name,
            last_name=last_name,
            **extra_fields
        )

        user.set_password(password)
        user.save()

        return user

    def create_superuser(self, email, password, first_name, last_name, **extra_fields):

        extra_fields["is_staff"]     = True
        extra_fields["is_superuser"] = True
        extra_fields["is_verified"]  = True
        extra_fields["role"]         = "admin"

        return self.create_user(email, password, first_name, last_name, **extra_fields)