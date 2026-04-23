from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

User = get_user_model()

class AccountTests(APITestCase):
    def setUp(self):
        self.user_data = {
            "email": "basit@example.com",
            "password": "SecurePassword123!",
            "first_name": "Basit",
            "last_name": "Engineer"
        }
        self.user = User.objects.create_user(**self.user_data)
        self.user.is_verified = True 
        self.user.save()

    def test_login_flow(self):
        url = "/api/accounts/login/" 
        response = self.client.post(url, {
            "email": self.user_data["email"],
            "password": self.user_data["password"]
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

def test_mfa_status_check(self):
    url = "/api/accounts/me/" 
    self.client.force_authenticate(user=self.user)
    response = self.client.get(url)
    self.assertEqual(response.status_code, status.HTTP_200_OK)