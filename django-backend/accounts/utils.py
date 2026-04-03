import secrets
from django.core.mail import send_mail
from django.conf import settings


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