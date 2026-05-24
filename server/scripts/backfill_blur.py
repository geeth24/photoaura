#!/usr/bin/env python3
"""
Manual backfill: generate blur_data_url for existing photos that don't have one.

Run from the server/ directory:  python -m scripts.backfill_blur
This is S3-heavy and intended to be run by hand, not on every startup.
"""
import os

from botocore.exceptions import ClientError

from db.base import session_scope
from db.models import Album, FileMetadata
from services.aws_service import s3_client
from utils.image_utils import generate_blur_data_url

AWS_BUCKET = os.environ.get("AWS_BUCKET")


def backfill_blur_data_urls():
    """Generate blur_data_url for photos that don't have one."""
    with session_scope() as session:
        rows = (
            session.query(FileMetadata, Album.slug)
            .join(Album, FileMetadata.album_id == Album.id)
            .filter(FileMetadata.blur_data_url.is_(None))
            .all()
        )

        if not rows:
            print("✅ All photos already have blur_data_url - skipping")
            return

        total = len(rows)
        print(f"📸 Found {total} photos without blur_data_url")

        updated = failed = 0
        for i, (photo, album_slug) in enumerate(rows, 1):
            s3_key = f"{album_slug}/{photo.filename}"
            print(f"[{i}/{total}] Processing {s3_key}...")
            try:
                try:
                    response = s3_client.get_object(Bucket=AWS_BUCKET, Key=s3_key)
                    image_content = response["Body"].read()
                except ClientError as e:
                    print(f"Failed to download {s3_key}: {e}")
                    failed += 1
                    continue

                photo.blur_data_url = generate_blur_data_url(image_content)
                session.commit()
                updated += 1
                print(f"✅ [{i}/{total}] Updated {s3_key}")
            except Exception as e:
                print(f"❌ [{i}/{total}] Failed photo ID {photo.id}: {e}")
                session.rollback()
                failed += 1

        print(f"\n🎉 Backfill complete! Updated: {updated}, Failed: {failed}")


if __name__ == "__main__":
    print("Starting blur_data_url backfill...")
    backfill_blur_data_urls()
