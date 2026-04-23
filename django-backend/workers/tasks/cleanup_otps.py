from celery import shared_task
from django.utils import timezone


@shared_task
def cleanup_expired_otps():
    """
    Runs every night at midnight via Celery Beat.
    Deletes OTP rows that are either:
      - already used (is_used=True), OR
      - past their expiry time
    Keeps the otp_verifications table lean.
    """

    from accounts.models import OTPVerification

    now = timezone.now()

    deleted_count, _ = OTPVerification.objects.filter(is_used=True).delete()

    expired_count, _ = OTPVerification.objects.filter(
        is_used=False,
        expires_at__lt=now,
    ).delete()

    total = deleted_count + expired_count
    print(
        f"[cleanup_otps] Deleted {total} OTP records "
        f"({deleted_count} used, {expired_count} expired)."
    )

    return total
