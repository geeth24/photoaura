import boto3
from config import settings

session = boto3.Session(
    aws_access_key_id=settings.AWS_ACCESS_KEY,
    aws_secret_access_key=settings.AWS_SECRET_KEY,
    region_name=settings.AWS_REGION,
)

s3_client = session.client("s3")
rekognition_client = session.client("rekognition")

if settings.AWS_BUCKET:
    try:
        rekognition_client.create_collection(CollectionId=settings.AWS_BUCKET)
    except rekognition_client.exceptions.ResourceAlreadyExistsException:
        pass
    except Exception as e:
        print(f"Error creating Rekognition collection: {e}")
