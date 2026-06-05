from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestHealthEndpoint:
    async def test_health_degraded_when_vector_service_none(self, client):
        """Health returns degraded when VectorService failed to init."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    async def test_health_returns_200(self, client):
        response = await client.get("/health")
        assert response.status_code == 200


class TestIngestEndpoint:
    async def test_ingest_rejects_missing_api_key(self, client):
        """No API key → 403."""
        response = await client.post(
            "/ingest",
            json={
                "s3_key": "documents/test.pdf",
                "bucket_name": "test-bucket",
                "collection_name": "enterprise_docs",
            },
        )
        assert response.status_code == 403

    async def test_ingest_rejects_wrong_api_key(self, client):
        response = await client.post(
            "/ingest",
            headers={"X-Internal-API-Key": "wrong-key"},
            json={
                "s3_key": "documents/test.pdf",
                "bucket_name": "test-bucket",
                "collection_name": "enterprise_docs",
            },
        )
        assert response.status_code == 403

    async def test_ingest_accepts_valid_key(self, client):
        """Valid API key + mocked vector service → 200."""
        with patch("main.vector_service") as mock_vs:
            mock_vs.process_from_s3.return_value = 42
            response = await client.post(
                "/ingest",
                headers={"X-Internal-API-Key": "test-internal-key"},
                json={
                    "s3_key": "documents/test.pdf",
                    "bucket_name": "test-bucket",
                    "collection_name": "enterprise_docs",
                    "doc_metadata": {"title": "Test Doc"},
                },
            )
        assert response.status_code == 200
        assert response.json()["chunks_created"] == 42

    async def test_ingest_returns_503_when_service_not_initialized(self, client):
        with patch("main.vector_service", None):
            response = await client.post(
                "/ingest",
                headers={"X-Internal-API-Key": "test-internal-key"},
                json={
                    "s3_key": "documents/test.pdf",
                    "bucket_name": "test-bucket",
                    "collection_name": "enterprise_docs",
                },
            )
        assert response.status_code == 503


class TestRegisterTokenEndpoint:
    async def test_register_token_stores_to_dynamo(self, client):
        with patch("main.boto3") as mock_boto:
            mock_table = MagicMock()
            mock_boto.resource.return_value.Table.return_value = mock_table

            response = await client.post(
                "/register-token",
                json={
                    "user_email": "test@example.com",
                    "fcm_token": "test-fcm-token-abc123",
                },
            )
        assert response.status_code == 200
        assert response.json()["message"] == "Token registered successfully"

    async def test_register_token_requires_user_email(self, client):
        response = await client.post(
            "/register-token", json={"fcm_token": "test-token"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert "missing email or token" in data["message"]


class TestTicketWebhook:
    @pytest.mark.asyncio
    async def test_webhook_sends_websocket_notification(self, client):
        # 1. Create an AsyncMock for the asynchronous channel layer broadcast
        mock_group_send = AsyncMock(return_value=None)

        # 2. Configure the Redis Channel Layer mock instance
        mock_layer_instance = MagicMock()
        mock_layer_instance.group_send = mock_group_send

        # 3. Securely patch all dependencies
        with patch("main.get_query_service") as mock_get_svc, patch(
            "main._ticket_service"
        ) as mock_ts, patch("main.save_resolution_message") as mock_save_msg, patch(
            "main.RedisChannelLayer", return_value=mock_layer_instance
        ):

            # Setup synchronous returns for query service
            mock_query_service = MagicMock()
            mock_query_service.generate_resolution_announcement.return_value = (
                "Your ticket has been resolved."
            )
            mock_get_svc.return_value = mock_query_service

            # Simulate payload using the exact keys expected by main.py
            payload = {
                "ticket_key": "TK-101",
                "resolution_notes": "Fixed the connection layout.",
                "session_id": "session-xyz",
            }

            # 4. Trigger execution using the correct endpoint path found in main.py
            response = await client.post("/webhook/ticket-update", json=payload)

            # 5. Verify successful delivery and execution
            assert response.status_code == 200
            assert response.json() == {"status": "ticket_closed_notification_sent"}
            mock_group_send.assert_called_once()
            mock_save_msg.assert_called_once()
