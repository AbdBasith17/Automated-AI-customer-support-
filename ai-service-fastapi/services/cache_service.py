import os
import json
import hashlib
import redis
import logging

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        # Strip any existing db number from the URL before appending /1
        # Prevents redis://redis:6379/0/1 if REDIS_URL already has a db suffix
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        base_url = redis_url.rsplit("/", 1)[0] if redis_url.count("/") >= 3 else redis_url
        self.client = redis.Redis.from_url(f"{base_url}/1")

    def _hash_query(self, query: str) -> str:
        return hashlib.md5(query.lower().strip().encode()).hexdigest()

    def get_cached_response(self, query: str):
        try:
            data = self.client.get(f"rag_cache:{self._hash_query(query)}")
            return json.loads(data) if data else None
        except Exception as e:
            logger.warning(f"Redis Cache GET Error: {e}")
            return None

    def set_cached_response(self, query: str, response: dict, expire=86400):
        try:
            self.client.setex(
                f"rag_cache:{self._hash_query(query)}",
                expire,
                json.dumps(response)
            )
        except Exception as e:
            logger.warning(f"Redis Cache SET Error: {e}")