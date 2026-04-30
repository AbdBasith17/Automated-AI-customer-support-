import boto3
import os
import time
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key  # Needed for querying

class DynamoMessageService:
    def __init__(self):
        self.dynamodb = boto3.resource(
            'dynamodb',
            region_name=os.getenv('AWS_S3_REGION_NAME'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        self.table = self.dynamodb.Table(os.getenv('DYNAMODB_MESSAGES_TABLE', 'AionChatMessages'))

    def save_message(self, session_id: str, role: str, content: str, sources: list = None):
        """Stores a message in DynamoDB with a microsecond-precision timestamp."""
        try:
            self.table.put_item(
                Item={
                    'session_id': str(session_id),
                    'timestamp': str(time.time_ns()), # High precision for sorting
                    'role': role,
                    'content': content,
                    'sources': sources or []
                }
            )
        except ClientError as e:
            print(f"DynamoDB Save Error: {e.response['Error']['Message']}")

    def get_session_history(self, session_id: str) -> list:
        """Fetches all messages for a session, ordered by timestamp."""
        try:
            response = self.table.query(
                KeyConditionExpression=Key('session_id').eq(str(session_id))
            )
            # DynamoDB automatically returns items sorted by the sort key (timestamp)
            return response.get('Items', [])
        except ClientError as e:
            print(f"DynamoDB Query Error: {e.response['Error']['Message']}")
            return []