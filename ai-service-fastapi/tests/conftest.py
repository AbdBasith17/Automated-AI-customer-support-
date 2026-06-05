"""
Patches all heavy external services BEFORE any app code is imported.
This prevents real network calls to Groq, Gemini, ChromaDB, Kafka, DynamoDB.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


# ── Patch everything before app imports ──────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def mock_external_services():
    """Session-scoped — applied once for all tests."""
    patches = [
        patch("chromadb.HttpClient", return_value=MagicMock()),
        patch("langchain_groq.ChatGroq", return_value=MagicMock()),
        patch(
            "langchain_google_genai.GoogleGenerativeAIEmbeddings",
            return_value=MagicMock(),
        ),
        patch("confluent_kafka.Producer", return_value=MagicMock()),
        patch("pymongo.MongoClient", return_value=MagicMock()),
        patch("boto3.resource", return_value=MagicMock()),
        patch("boto3.client", return_value=MagicMock()),
    ]
    started = [p.start() for p in patches]
    yield
    for p in patches:
        p.stop()


@pytest.fixture
async def client(mock_external_services):
    """AsyncClient for FastAPI endpoint tests."""
    # Patch lifespan so VectorService and Kafka consumer don't actually start
    with patch("main.VectorService"), patch("main.start_kafka_consumer"):
        from main import app

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as c:
            yield c


@pytest.fixture
def mock_query_service():
    """Pre-configured mock for QueryService.get_response."""
    svc = MagicMock()
    svc.get_response.return_value = {
        "answer": "Test answer from AI",
        "status": "success",
        "topic": "Battery Issue",
        "sources": [],
    }
    svc.generate_resolution_announcement.return_value = (
        "Your ticket has been resolved. — Aion Support"
    )
    return svc


@pytest.fixture
def mock_ticket_service():
    svc = MagicMock()
    svc.create_ticket.return_value = True
    svc.session_has_ticket.return_value = False
    svc.get_user_tickets.return_value = []
    svc.resolve_ticket.return_value = True
    return svc
