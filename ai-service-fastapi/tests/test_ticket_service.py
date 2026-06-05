from unittest.mock import MagicMock

import pytest

from services.ticket_service import TicketService


class TestCreateTicket:
    def setup_method(self):
        # Bypass live boto3 initialization using memory allocation
        self.svc = TicketService.__new__(TicketService)
        self.svc.table = MagicMock()

    def test_create_ticket_returns_true_on_success(self):
        self.svc.table.put_item.return_value = {}
        res = self.svc.create_ticket(
            "TK-101", "driver@aion.com", "session-xyz", "Battery Failure"
        )
        assert res is True
        self.svc.table.put_item.assert_called_once()

    def test_create_ticket_stores_correct_fields(self):
        self.svc.table.put_item.return_value = {}
        self.svc.create_ticket(
            ticket_key="TK-101",
            user_email="driver@aion.com",
            session_id="session-xyz",
            topic="Battery Failure",
            summary="Scooter won't turn on",
            description="The battery died suddenly while riding home.",
        )

        # Unpack execution parameters to verify schema alignment
        _, kwargs = self.svc.table.put_item.call_args
        item = kwargs["Item"]

        assert item["ticket_key"] == "TK-101"
        assert item["user_email"] == "driver@aion.com"
        assert item["session_id"] == "session-xyz"
        assert item["status"] == "open"
        assert item["topic"] == "Battery Failure"
        assert item["summary"] == "Scooter won't turn on"
        assert item["description"] == "The battery died suddenly while riding home."
        assert "created_at" in item
        assert "updated_at" in item

    def test_create_ticket_returns_false_on_error(self):
        # Simulate DynamoDB connection failure or throughput issues
        self.svc.table.put_item.side_effect = Exception("DynamoDB Resource Unreachable")
        res = self.svc.create_ticket(
            "TK-101", "driver@aion.com", "session-xyz", "Battery Failure"
        )
        assert res is False


class TestSessionHasTicket:
    def setup_method(self):
        self.svc = TicketService.__new__(TicketService)
        self.svc.table = MagicMock()

    def test_returns_true_when_ticket_exists(self):
        self.svc.table.query.return_value = {"Items": [{"ticket_key": "TK-101"}]}
        assert self.svc.session_has_ticket("session-xyz") is True

    def test_returns_false_when_no_ticket(self):
        self.svc.table.query.return_value = {"Items": []}
        assert self.svc.session_has_ticket("session-abc") is False

    def test_returns_false_on_error(self):
        self.svc.table.query.side_effect = Exception("Index Query Failed")
        assert self.svc.session_has_ticket("session-xyz") is False


class TestResolveTicket:
    def setup_method(self):
        self.svc = TicketService.__new__(TicketService)
        self.svc.table = MagicMock()

    def test_resolve_ticket_updates_status(self):
        self.svc.table.update_item.return_value = {}
        res = self.svc.resolve_ticket("TK-101", "Replaced wiring harness.")

        assert res is True
        self.svc.table.update_item.assert_called_once()

        _, kwargs = self.svc.table.update_item.call_args
        assert kwargs["Key"] == {"ticket_key": "TK-101"}
        assert kwargs["ExpressionAttributeValues"][":s"] == "resolved"
        assert kwargs["ExpressionAttributeValues"][":rn"] == "Replaced wiring harness."

    def test_resolve_ticket_returns_false_on_error(self):
        self.svc.table.update_item.side_effect = Exception(
            "Conditional Check Failed Exception"
        )
        res = self.svc.resolve_ticket("TK-101", "Fixed.")
        assert res is False
