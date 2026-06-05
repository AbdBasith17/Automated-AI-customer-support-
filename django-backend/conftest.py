import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    from accounts.models import User

    user = User.objects.create_user(
        email="admin@test.com",
        password="TestPass123!",
        first_name="Admin",
        last_name="User",
        role="admin",
        is_verified=True,
        is_staff=True,
    )
    return user


@pytest.fixture
def regular_user(db):
    from accounts.models import User

    user = User.objects.create_user(
        email="user@test.com",
        password="TestPass123!",
        first_name="Test",
        last_name="User",
        role="user",
        is_verified=True,
    )
    return user


@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def user_client(api_client, regular_user):
    api_client.force_authenticate(user=regular_user)
    return user_client
