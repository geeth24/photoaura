import logging
import time

import boto3
from config import settings

session = boto3.Session(
    aws_access_key_id=settings.AWS_ACCESS_KEY,
    aws_secret_access_key=settings.AWS_SECRET_KEY,
    region_name=settings.AWS_REGION,
)

s3_client = session.client("s3")
rekognition_client = session.client("rekognition")
cloudfront_client = session.client("cloudfront")

if settings.AWS_BUCKET:
    try:
        rekognition_client.create_collection(CollectionId=settings.AWS_BUCKET)
    except rekognition_client.exceptions.ResourceAlreadyExistsException:
        pass
    except Exception as e:
        print(f"Error creating Rekognition collection: {e}")


def invalidate_cdn(paths=("/*",)):
    """Best-effort CloudFront cache purge so stale/deleted images don't linger.
    No-op without a configured distribution; never raises into the caller.
    SIH thumbor/base64 URLs can't be targeted by key prefix, so callers use /*."""
    dist = settings.AWS_CLOUDFRONT_DISTRIBUTION_ID
    if not dist:
        return
    try:
        cloudfront_client.create_invalidation(
            DistributionId=dist,
            InvalidationBatch={
                "Paths": {"Quantity": len(paths), "Items": list(paths)},
                "CallerReference": f"photoaura-{int(time.time() * 1000)}",
            },
        )
    except Exception as e:
        logging.error(f"CDN invalidation failed: {e}")
