import os
import time

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


class DynamoMessageService:
    def __init__(self):
        self.dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_S3_REGION_NAME"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        self.table = self.dynamodb.Table(
            os.getenv("DYNAMODB_MESSAGES_TABLE", "AionChatMessages")
        )

    def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        user_email: str,
        topic: str = "New Chat",
        sources: list = None,
        status: str = None,
    ):
        try:
            item = {
                "session_id": str(session_id),
                "timestamp": str(time.time_ns()),
                "user_email": user_email,
                "topic": topic,
                "role": role,
                "content": content,
                "sources": sources or [],
            }
            if status:
                item["status"] = status
            self.table.put_item(Item=item)
        except Exception as e:
            print(f"[DynamoDB] save_message error: {e}")

    def get_messages(self, session_id: str):
        try:
            response = self.table.query(
                KeyConditionExpression=Key("session_id").eq(session_id)
            )
            items = response.get("Items", [])

            # Only real chat rows — excludes rename anchors, system rows
            items = [i for i in items if i.get("role") in ("user", "ai")]

            def safe_ts(x):
                try:
                    return int(x.get("timestamp", 0))
                except (ValueError, TypeError):
                    return 0

            items.sort(key=safe_ts)

            return [
                {
                    "role": i.get("role"),
                    "content": i.get("content"),
                    "sources": i.get("sources", []),
                    "timestamp": i.get("timestamp"),
                    "status": i.get("status"),
                }
                for i in items
            ]

        except ClientError as e:
            print(f"[DynamoDB] get_messages error: {e}")
            return []

    def get_user_chat_list(self, user_email: str, max_sessions: int = 30):
        """
        Fetches unique sessions for the sidebar.
        Paginates DynamoDB reads — stops after collecting max_sessions unique sessions
        instead of loading every message ever sent.
        """
        try:
            unique_chats = {}
            meta_topics = {}
            last_key = None

            # Keep reading pages until we have enough sessions or run out of data
            while len(unique_chats) < max_sessions:
                query_kwargs = {
                    "IndexName": "UserEmailIndex",
                    "KeyConditionExpression": Key("user_email").eq(user_email),
                    "ScanIndexForward": False,  # newest first
                    "Limit": 100,  # read 100 items per page
                }
                if last_key:
                    query_kwargs["ExclusiveStartKey"] = last_key

                response = self.table.query(**query_kwargs)
                items = response.get("Items", [])

                for itm in items:
                    sid = itm.get("session_id")
                    if not sid:
                        continue

                    if itm.get("timestamp") == "0":
                        meta_topics[sid] = itm.get("topic", "New Chat")
                        continue

                    if itm.get("role") not in ("user", "ai"):
                        continue

                    try:
                        timestamp = float(itm.get("timestamp", 0))
                    except (ValueError, TypeError):
                        continue

                    if (
                        sid not in unique_chats
                        or timestamp > unique_chats[sid]["last_active"]
                    ):
                        unique_chats[sid] = {
                            "session_id": sid,
                            "topic": itm.get("topic", "New Chat"),
                            "last_active": timestamp,
                        }

                # Stop if DynamoDB has no more pages
                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    break

            # Apply renamed topics
            for sid, topic in meta_topics.items():
                if sid in unique_chats:
                    unique_chats[sid]["topic"] = topic

            return sorted(
                unique_chats.values(),
                key=lambda x: x["last_active"],
                reverse=True,
            )[
                :max_sessions
            ]  # hard cap at max_sessions

        except Exception as e:
            print(f"[DynamoDB] get_user_chat_list error: {e}")
            return []

    def get_session_topic(self, session_id: str) -> str:
        try:
            response = self.table.query(
                KeyConditionExpression=Key("session_id").eq(session_id),
                ScanIndexForward=True,
                Limit=5,
            )
            for item in response.get("Items", []):
                if item.get("role") in ("user", "ai"):
                    return item.get("topic", "New Chat")
            return "New Chat"
        except Exception as e:
            print(f"[DynamoDB] get_session_topic error: {e}")
            return "New Chat"

    def session_belongs_to_user(self, session_id: str, user_email: str) -> bool:
        try:
            response = self.table.query(
                KeyConditionExpression=Key("session_id").eq(session_id),
                ProjectionExpression="user_email",
                Limit=25,
            )
            return any(
                item.get("user_email") == user_email
                for item in response.get("Items", [])
            )
        except Exception as e:
            print(f"[DynamoDB] ownership check error: {e}")
            return False

    def rename_session(self, session_id: str, new_topic: str, user_email: str) -> bool:
        try:
            self.table.put_item(
                Item={
                    "session_id": session_id,
                    "timestamp": "0",
                    "user_email": user_email,
                    "topic": new_topic,
                    "role": "system",
                    "content": "",
                    "sources": [],
                }
            )
            return True
        except Exception as e:
            print(f"[DynamoDB] rename_session error: {e}")
            return False

    def delete_session(self, session_id: str) -> bool:
        try:
            response = self.table.query(
                KeyConditionExpression=Key("session_id").eq(session_id)
            )
            items = response.get("Items", [])
            with self.table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(
                        Key={
                            "session_id": item["session_id"],
                            "timestamp": item["timestamp"],
                        }
                    )
            return True
        except Exception as e:
            print(f"[DynamoDB] delete_session error: {e}")
            return False
