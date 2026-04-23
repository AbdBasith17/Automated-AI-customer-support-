import boto3
from django.conf import settings


class S3Service:
    def __init__(self):
        self.s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )
        self.bucket = settings.AWS_STORAGE_BUCKET_NAME

    def upload_file(self, file_obj, s3_key):
        self.s3.upload_fileobj(file_obj, self.bucket, s3_key)
        return f"https://{self.bucket}.s3.amazonaws.com/{s3_key}"

    def delete_file(self, s3_key):
        self.s3.delete_object(Bucket=self.bucket, Key=s3_key)
