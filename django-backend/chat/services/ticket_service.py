import os

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


class TicketService:
    def __init__(self):
        self.dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_S3_REGION_NAME"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        self.table = self.dynamodb.Table(
            os.getenv("DYNAMODB_TICKETS_TABLE", "AionTickets")
        )

    def get_user_tickets(self, user_email: str) -> list:
        try:
            response = self.table.query(
                IndexName="UserEmailIndex",
                KeyConditionExpression=Key("user_email").eq(user_email),
            )
            items = response.get("Items", [])
            items.sort(key=lambda x: int(x.get("created_at", 0)), reverse=True)
            return items
        except ClientError as e:
            print(f"[TicketService] get_user_tickets error: {e}")
            return []
