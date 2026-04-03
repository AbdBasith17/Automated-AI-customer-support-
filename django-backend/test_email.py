import os
import django
from django.core.mail import send_mail
from django.conf import settings

# 1. Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def test_brevo_config():
    print("--- 📧 Starting Email Configuration Test ---")
    print(f"Host: {settings.EMAIL_HOST}")
    print(f"User: {settings.EMAIL_HOST_USER}")
    print(f"From: {settings.DEFAULT_FROM_EMAIL}")
    
    subject = "Brevo SMTP Test - Enterprise AI Assistant"
    message = "If you are reading this, your Brevo SMTP configuration is working perfectly!"
    recipient = settings.DEFAULT_FROM_EMAIL 

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
        print("\n✅ SUCCESS: Email sent successfully!")
        print(f"Check your inbox at: {recipient}")
    except Exception as e:
        print("\n❌ FAILED: Could not send email.")
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    test_brevo_config()