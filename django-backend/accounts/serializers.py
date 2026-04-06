from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import OTPVerification, User


class RegisterSerializer(serializers.Serializer):

    first_name = serializers.CharField(max_length=150)
    last_name  = serializers.CharField(max_length=150)
    email      = serializers.EmailField()
    password   = serializers.CharField(write_only=True)
    password2  = serializers.CharField(write_only=True)

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return data


class VerifyOTPSerializer(serializers.Serializer):

    email    = serializers.EmailField()
    otp_code = serializers.CharField(min_length=6, max_length=6)

    def validate(self, data):
        email    = data["email"].lower()
        otp_code = data["otp_code"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("No account found with this email.")

        if user.is_verified:
            raise serializers.ValidationError("This account is already verified.")

        otp = OTPVerification.objects.filter(user=user, is_used=False).last()

        if otp is None:
            raise serializers.ValidationError("No active OTP found. Please request a new one.")

        if otp.is_expired():
            raise serializers.ValidationError("This OTP has expired. Please request a new one.")

        if otp.code != otp_code:
            raise serializers.ValidationError("Incorrect OTP code.")

        data["user"] = user
        data["otp"]  = otp
        return data


class ResendOTPSerializer(serializers.Serializer):

    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.lower()

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("No account found with this email.")

        if user.is_verified:
            raise serializers.ValidationError("This account is already verified.")

        self.user = user
        return email


class LoginSerializer(serializers.Serializer):

    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email    = data["email"].lower()
        password = data["password"]

        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError("Incorrect email or password.")

        if not user.is_verified:
            raise serializers.ValidationError(
                "Please verify your email first. Check your inbox for the OTP."
            )

        data["user"] = user
        return data

from rest_framework import serializers

class ResetPasswordConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return data