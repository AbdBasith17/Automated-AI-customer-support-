from unittest.mock import MagicMock, patch

import pytest


class TestFetchHistoryFromDynamo:

    def test_returns_formatted_history(self):
        mock_table = MagicMock()
        mock_table.query.return_value = {
            "Items": [
                {"role": "user", "content": "My battery drains", "timestamp": "200"},
                {"role": "ai", "content": "Try resetting it", "timestamp": "100"},
            ]
        }

        with patch("workers.tasks._get_dynamo_table", return_value=mock_table):
            from workers.tasks import fetch_history_from_dynamo

            result = fetch_history_from_dynamo("session-123")

        assert "User: My battery drains" in result
        assert "Ai: Try resetting it" in result

    def test_returns_empty_string_on_error(self):
        mock_table = MagicMock()
        mock_table.query.side_effect = Exception("DynamoDB connection failed")

        with patch("workers.tasks._get_dynamo_table", return_value=mock_table):
            from workers.tasks import fetch_history_from_dynamo

            result = fetch_history_from_dynamo("session-123")

        assert result == ""

    def test_filters_out_system_messages(self):
        mock_table = MagicMock()
        mock_table.query.return_value = {
            "Items": [
                {"role": "system", "content": "META#TICKET", "timestamp": "50"},
                {"role": "user", "content": "My motor is noisy", "timestamp": "100"},
                {"role": "ai", "content": "Try lubricating", "timestamp": "200"},
            ]
        }

        with patch("workers.tasks._get_dynamo_table", return_value=mock_table):
            from workers.tasks import fetch_history_from_dynamo

            result = fetch_history_from_dynamo("session-123")

        assert "META#TICKET" not in result
        assert "User: My motor is noisy" in result

    def test_truncates_long_history(self):
        long_content = "x" * 4000
        mock_table = MagicMock()
        mock_table.query.return_value = {
            "Items": [{"role": "user", "content": long_content, "timestamp": "100"}]
        }

        with patch("workers.tasks._get_dynamo_table", return_value=mock_table):
            from workers.tasks import fetch_history_from_dynamo

            result = fetch_history_from_dynamo("session-123")

        assert len(result) <= 3000


class TestSaveAiMessage:

    def test_saves_message_successfully(self):
        mock_table = MagicMock()
        mock_table.put_item.return_value = {}

        with patch("workers.tasks._get_dynamo_table", return_value=mock_table):
            from workers.tasks import save_ai_message

            save_ai_message(
                session_id="session-abc",
                content="Here is how to fix it",
                user_email="user@test.com",
                sources=[],
                topic="Battery Issue",
            )

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args[1]["Item"]
        assert item["session_id"] == "session-abc"
        assert item["role"] == "ai"
        assert item["content"] == "Here is how to fix it"
        assert item["user_email"] == "user@test.com"

    def test_includes_status_when_provided(self):
        mock_table = MagicMock()

        with patch("workers.tasks._get_dynamo_table", return_value=mock_table):
            from workers.tasks import save_ai_message

            save_ai_message(
                session_id="session-abc",
                content="Ticket created",
                user_email="user@test.com",
                sources=[],
                topic="Issue",
                status="ticket_created",
            )

        item = mock_table.put_item.call_args[1]["Item"]
        assert item["status"] == "ticket_created"

    def test_does_not_raise_on_dynamo_error(self):
        mock_table = MagicMock()
        mock_table.put_item.side_effect = Exception("DynamoDB error")

        with patch("workers.tasks._get_dynamo_table", return_value=mock_table):
            from workers.tasks import save_ai_message

            # Should not raise — analytics failures must never break the chat
            save_ai_message("s", "c", "e@e.com", [], "t")
