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

    def generate_presigned_url(
        self, s3_key, expiration=3600, action_type="view", filename=None
    ):
        """
        Generates a secure presigned URL.
        action_type="view" -> Opens inline in browser tab.
        action_type="download" -> Forces direct browser download.
        """
        # 1. Base disposition type
        disposition_type = "inline" if action_type == "view" else "attachment"

        # 2. Attach the filename if provided
        if filename:
            # Clean the filename to prevent header breaks and ensure it ends with .pdf
            safe_name = filename.replace('"', "").replace(";", "")
            if not safe_name.lower().endswith(".pdf"):
                safe_name += ".pdf"

            content_disposition = f'{disposition_type}; filename="{safe_name}"'
        else:
            content_disposition = disposition_type

        return self.s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": s3_key,
                "ResponseContentDisposition": content_disposition,
                "ResponseContentType": "application/pdf",
            },
            ExpiresIn=expiration,
        )
