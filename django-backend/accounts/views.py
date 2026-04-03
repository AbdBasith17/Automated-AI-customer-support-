from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .models import OTPVerification, User
from .serializers import LoginSerializer, RegisterSerializer, ResendOTPSerializer, VerifyOTPSerializer
from .helpers import get_tokens_for_user, get_user_data
from .utils import generate_otp, send_otp_email


def set_auth_cookies(response, tokens):
    # Access 
    response.set_cookie(
        key='access_token',
        value=tokens['access'],
        httponly=True,
        secure=not settings.DEBUG, 
        samesite='Lax',
        max_age=60 * 60 
    )
    # Refresh 
    response.set_cookie(
        key='refresh_token',
        value=tokens['refresh'],
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60 
    )
    return response

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        user = User.objects.create_user(
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )

        otp_code = generate_otp()
        OTPVerification.objects.create(user=user, code=otp_code)
        send_otp_email(user.email, user.first_name, otp_code)

        return Response(
            {"message": "Account created! Please check your email for the OTP.", "email": user.email},
            status=status.HTTP_201_CREATED,
        )

class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        otp = serializer.validated_data["otp"]

       
        user.is_verified = True
        user.save()
        otp.is_used = True
        otp.save()

        
        tokens = get_tokens_for_user(user)
        response = Response({
            "message": "Email verified! You are now logged in.",
            "user": get_user_data(user),
        }, status=status.HTTP_200_OK)

        
        return set_auth_cookies(response, tokens)
    
class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
       
        serializer = ResendOTPSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        
        user = serializer.user
        
       
        OTPVerification.objects.filter(user=user, is_used=False).delete()

        
        otp_code = generate_otp()
        OTPVerification.objects.create(user=user, code=otp_code)

       
        try:
            send_otp_email(user.email, user.first_name, otp_code)
        except Exception:
            return Response(
                {"error": "Failed to send OTP email. Please try again."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "A new OTP has been sent to your email."},
            status=status.HTTP_200_OK
        )

class LoginView(APIView):
    
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        tokens = get_tokens_for_user(user)

        response = Response({
            "message": "Login successful.",
            "user": get_user_data(user),
        }, status=status.HTTP_200_OK)

        return set_auth_cookies(response, tokens)
    

class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({"error": "Token is required"}, status=400)

        try:
          
            id_info = id_token.verify_oauth2_token(
                token, 
                google_requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )

            
            email = id_info.get('email')
            first_name = id_info.get('given_name', '')
            last_name = id_info.get('family_name', '')

            
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_verified': True, 
                }
            )

            
            tokens = get_tokens_for_user(user)
            
            response = Response({
                "message": "Google login successful",
                "user": get_user_data(user),
                "is_new_user": created
            }, status=status.HTTP_200_OK)

           
            return set_auth_cookies(response, tokens)

        except ValueError:
            return Response({"error": "Invalid Google token"}, status=400)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
       
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(get_user_data(request.user), status=status.HTTP_200_OK)