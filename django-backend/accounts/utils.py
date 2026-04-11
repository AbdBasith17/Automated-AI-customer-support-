import secrets

from django.conf import settings
from django.core.mail import send_mail


def generate_otp():
    # secrets.randbelow for otp
    return f"{secrets.randbelow(1_000_000):06d}"


def send_otp_email(user_email, first_name, otp_code):
    subject = "Your verification code"

    message = (
        f"Hi {first_name},\n\n"
        f"Your verification code is: {otp_code}\n\n"
        f"This code expires in 10 minutes.\n"
        f"Do not share it with anyone."
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
    )


def send_password_reset_email(user_email, first_name, reset_link):
    subject = "AION CORE - Security Protocol: Password Reset"
    message = (
        f"Hi {first_name},\n\n"
        f"A request has been initiated to reset your credentials for AION CORE.\n"
        f"Please click the secure link below to proceed:\n\n"
        f"{reset_link}\n\n"
        f"This link is valid for a limited time.\n"
        f"If you did not request this, please secure your terminal and ignore this email."
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
        fail_silently=False,
    )
