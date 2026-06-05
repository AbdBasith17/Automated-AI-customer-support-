import os

from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://aion-redis:6379/0")

app = Celery(
    "ai_service", broker=redis_url, backend=redis_url, include=["workers.tasks"]
)
app.conf.task_track_started = True
app.conf.broker_connection_retry_on_startup = True
