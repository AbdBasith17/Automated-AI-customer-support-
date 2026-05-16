import boto3
import os
import time
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key


class TicketService:
    def __init__(self):
        self.dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_REGION", "ap-south-1"),
            endpoint_url=os.getenv("DYNAMODB_URL"),
        )
        self.table = self.dynamodb.Table(
            os.getenv("DYNAMODB_TICKETS_TABLE", "AionTickets")
        )

    def create_ticket(
        self,
        ticket_key: str,
        user_email: str,
        session_id: str,
        topic: str,
        summary: str = "",  
        description: str = "",
    ) -> bool:
        try:
            now = str(time.time_ns())
            self.table.put_item(Item={
                "ticket_key":  ticket_key,
                "user_email":  user_email,
                "session_id":  session_id,
                "status":      "open",
                "topic":       topic,
                "summary":     summary, 
                "description": description[:300] if description else "",
                "created_at":  now,
                "updated_at":  now,
            })
            print(f"[TicketService] Created: {ticket_key} - {summary}")
            return True
        except Exception as e:
            print(f"[TicketService] create_ticket error: {e}")
            return False

    def session_has_ticket(self, session_id: str) -> bool:
        try:
            response = self.table.query(
                IndexName="SessionIndex",
                KeyConditionExpression=Key("session_id").eq(session_id),
                Limit=1,
            )
            return len(response.get("Items", [])) > 0
        except Exception as e:
            print(f"[TicketService] session_has_ticket error: {e}")
            return False

    def resolve_ticket(self, ticket_key: str, resolution_notes: str = "") -> bool:
        try:
            now         = str(time.time_ns())
            update_expr = "SET #st = :s, updated_at = :ua, resolved_at = :ra"
            expr_names  = {"#st": "status"}
            expr_values = {":s": "resolved", ":ua": now, ":ra": now}

            if resolution_notes:
                update_expr       += ", resolution_notes = :rn"
                expr_values[":rn"]  = resolution_notes

            self.table.update_item(
                Key={"ticket_key": ticket_key},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
            print(f"[TicketService] Resolved: {ticket_key}")
            return True
        except Exception as e:
            print(f"[TicketService] resolve_ticket error: {e}")
            return False