import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter
from pymongo import MongoClient

router = APIRouter(prefix="/analytics", tags=["analytics"])

_mongo_client = None

def get_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(os.getenv("MONGO_URI", "mongodb://mongo:27017/aion_analytics"))
    return _mongo_client.aion_analytics


@router.get("/summary")
def get_summary():
    db = get_db()
    total_tickets = db.tickets.count_documents({})
    open_tickets = db.tickets.count_documents({"status": "open"})
    total_sessions = db.sessions.count_documents({})
    total_ai_msgs = db.messages.count_documents({"role": "ai"})
    cache_hits = db.messages.count_documents({"role": "ai", "cache_hit": True})
    top_topic = db.query_topics.find_one({}, sort=[("count", -1)])

    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "total_sessions": total_sessions,
        "cache_hit_rate": round(cache_hits / total_ai_msgs, 3) if total_ai_msgs else 0,
        "top_topic": top_topic["_id"] if top_topic else "—",
    }


@router.get("/tickets/volume")
def ticket_volume(days: int = 30):
    db = get_db()
    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": from_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    return list(db.tickets.aggregate(pipeline))


@router.get("/messages/latency")
def latency_stats(days: int = 7):
    db = get_db()
    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {
            "role": "ai",
            "cache_hit": False,
            "latency_ms": {"$exists": True, "$gt": 0},
            "created_at": {"$gte": from_date},
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "p50": {"$percentile": {"input": "$latency_ms", "p": [0.5], "method": "approximate"}},
            "p95": {"$percentile": {"input": "$latency_ms", "p": [0.95], "method": "approximate"}},
            "count": {"$sum": 1},
        }},
        {"$project": {
            "_id": 1,
            "p50": {"$round": [{"$arrayElemAt": ["$p50", 0]}, 0]},
            "p95": {"$round": [{"$arrayElemAt": ["$p95", 0]}, 0]},
            "count": 1,
        }},
        {"$sort": {"_id": 1}},
    ]
    return list(db.messages.aggregate(pipeline))


@router.get("/messages/cache-rate")
def cache_hit_rate():
    db = get_db()
    total = db.messages.count_documents({"role": "ai"})
    hits = db.messages.count_documents({"role": "ai", "cache_hit": True})
    return {
        "hit_rate": round(hits / total, 3) if total else 0,
        "hits": hits,
        "misses": total - hits,
        "total": total,
    }


@router.get("/topics/top")
def top_topics(limit: int = 10):
    db = get_db()
    docs = db.query_topics.find({}, {"_id": 1, "count": 1}).sort("count", -1).limit(limit)
    return [{"topic": d["_id"], "count": d["count"]} for d in docs]