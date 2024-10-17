import boto3
import os

# Initialize a session using Amazon S3 credentials
session = boto3.Session(
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_KEY"),
    region_name=os.environ.get("AWS_REGION"),
)

# Create an S3 client
s3_client = session.client("s3")

# Create an Rekognition client
rekognition_client = session.client("rekognition")

# create an rekognition collection if it doesn't exist
try:
    rekognition_client.create_collection(CollectionId=os.environ.get("AWS_BUCKET"))
except rekognition_client.exceptions.ResourceAlreadyExistsException:
    pass
except Exception as e:
    print(e)
    raise e
