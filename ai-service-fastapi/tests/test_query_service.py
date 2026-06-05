import pytest

from services.query_service import QueryService


class TestNeedsRewrite:
    """_needs_rewrite is pure string parsing logic — no external mocks needed."""

    def setup_method(self):
        # Cleanly instantiate a shell copy to bypass running the client __init__ links
        self.svc = QueryService.__new__(QueryService)

    def test_no_rewrite_on_first_message(self):
        assert self.svc._needs_rewrite("my battery drains fast", "") is False
        assert self.svc._needs_rewrite("my battery drains fast", "No history.") is False

    def test_rewrite_on_short_followup(self):
        assert self.svc._needs_rewrite("still broken", "User: battery drains") is True
        assert self.svc._needs_rewrite("try again", "User: tried charging") is True

    def test_rewrite_on_pronoun_reference(self):
        assert (
            self.svc._needs_rewrite("it stopped working", "User: motor issue") is True
        )
        assert self.svc._needs_rewrite("the same problem again", "User: GPS") is True
        assert self.svc._needs_rewrite("still happening", "User: brake issue") is True

    def test_no_rewrite_on_long_clear_query(self):
        result = self.svc._needs_rewrite(
            "my scooter battery is completely draining within one hour of charging",
            "User: hello",
        )
        assert result is False

    def test_rewrite_on_followup_connector(self):
        assert (
            self.svc._needs_rewrite("also what about the motor", "User: battery")
            is True
        )

    def test_rewrite_on_what_about(self):
        assert (
            self.svc._needs_rewrite("what about the charger", "User: battery issue")
            is True
        )
