import os
import json
import logging
import threading
from datetime import datetime, timezone

from confluent_kafka import Consumer, KafkaError
from pymongo import MongoClient

logger = logging.getLogger(__name__)


def _parse_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def _handle_ticket(db, data: dict):
    ticket_key = data.get("ticket_key", "UNKNOWN")
    db.tickets.update_one(
        {"ticket_key": ticket_key},
        {"$setOnInsert": {
            "ticket_key": ticket_key,
            "session_id": data.get("session_id"),
            "user_email": data.get("user_email"),
            "summary": data.get("summary"),
            "status": "open",
            "created_at": _parse_dt(data.get("created_at", "")),
        }},
        upsert=True
    )
    db.sessions.update_one(
        {"session_id": data.get("session_id")},
        {"$set": {"ticket_created": True, "ticket_key": ticket_key}},
        upsert=True
    )
    logger.info(f"[Kafka] Ticket stored: {ticket_key}")


def _handle_message(db, data: dict):
    created_at = _parse_dt(data.get("created_at", ""))
    db.messages.insert_one({
        "session_id": data.get("session_id"),
        "role": data.get("role"),
        "user_email": data.get("user_email"),
        "latency_ms": data.get("latency_ms"),
        "cache_hit": data.get("cache_hit", False),
        "sources_count": data.get("sources_count", 0),
        "topic": data.get("topic"),
        "created_at": created_at,
    })

    db.sessions.update_one(
        {"session_id": data.get("session_id")},
        {
            "$inc": {"message_count": 1},
            "$set": {"user_email": data.get("user_email"), "last_active": created_at},
            "$setOnInsert": {"started_at": created_at, "ticket_created": False},
        },
        upsert=True
    )

    # Track query topics from AI messages
    if data.get("role") == "ai" and data.get("topic"):
        db.query_topics.update_one(
            {"_id": data["topic"]},
            {"$inc": {"count": 1}, "$set": {"last_seen": created_at}},
            upsert=True
        )


def _handle_cache_invalidate(cache_client):
    try:
        keys = cache_client.keys("rag_cache:*")
        if keys:
            cache_client.delete(*keys)
            logger.info(f"[Kafka] Cache flushed: {len(keys)} keys deleted")
    except Exception as e:
        logger.error(f"[Kafka] Cache flush error: {e}")


def _run_consumer(cache_client):
    consumer = Consumer({
        "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP", "kafka:9092"),
        "group.id": "aion-analytics-consumer",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
        "socket.timeout.ms": 10000,
    })
    consumer.subscribe(["support.tickets.created", "chat.messages.all", "cache.invalidate"])

    mongo = MongoClient(os.getenv("MONGO_URI", "mongodb://mongo:27017/aion_analytics"))
    db = mongo.aion_analytics
    logger.info("[Kafka] Consumer thread running — subscribed to 3 topics")

    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() != KafkaError._PARTITION_EOF:
                logger.error(f"[Kafka] Consumer error: {msg.error()}")
            continue
        try:
            data = json.loads(msg.value().decode("utf-8"))
            topic = msg.topic()
            if topic == "support.tickets.created":
                _handle_ticket(db, data)
            elif topic == "chat.messages.all":
                _handle_message(db, data)
            elif topic == "cache.invalidate":
                _handle_cache_invalidate(cache_client)
        except Exception as e:
            logger.error(f"[Kafka] Failed to process {msg.topic()}: {e}")


def start_kafka_consumer(cache_client):
    thread = threading.Thread(
        target=_run_consumer,
        args=(cache_client,),
        daemon=True,
        name="kafka-analytics-consumer",
    )
    thread.start()
    logger.info("[Kafka] Consumer daemon thread started")