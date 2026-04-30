# celery.py
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery(
    "aion_core",
    include=[
        "workers.tasks.embed_document",
        "workers.tasks.cleanup_otps",
    ]
)

app.config_from_object("django.conf:settings", namespace="CELERY")
app.conf.broker_connection_retry_on_startup = True

app.conf.task_routes = {
    "embed_document_task": {"queue": "embedding"},
    "workers.tasks.cleanup_otps.cleanup_expired_otps": {"queue": "beat_tasks"},
}

app.conf.beat_schedule = {
    "cleanup-otps-midnight": {
        "task": "workers.tasks.cleanup_otps.cleanup_expired_otps",
        "schedule": crontab(hour=0, minute=0),
    },
}



@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")