#!/usr/bin/env python3
"""
Migration script to generate blur_data_url for existing photos.
Run this script to fix photos that have null blur_data_url values.
"""

import os
import sys
from services.database import get_db
from services.aws_service import s3_client
from utils.image_utils import generate_blur_data_url
import boto3
from botocore.exceptions import ClientError

AWS_BUCKET = os.environ.get("AWS_BUCKET")


def migrate_blur_data_urls():
    """Generate blur_data_url for photos that don't have one"""
    db, cursor = get_db()

    # Find all photos with null blur_data_url
    cursor.execute(
        "SELECT fm.id, fm.album_id, fm.filename, a.slug FROM file_metadata fm JOIN album a ON fm.album_id = a.id WHERE fm.blur_data_url IS NULL"
    )
    photos_to_update = cursor.fetchall()

    if len(photos_to_update) == 0:
        print("✅ All photos already have blur_data_url - skipping migration")
        cursor.close()
        db.close()
        return

    print(f"📸 Found {len(photos_to_update)} photos without blur_data_url")

    # Process photos
    updated_count = 0
    failed_count = 0
    total_photos = len(photos_to_update)

    for i, photo in enumerate(photos_to_update, 1):
        photo_id, album_id, filename, album_slug = photo

        try:
            s3_key = f"{album_slug}/{filename}"

            print(f"[{i}/{total_photos}] Processing {s3_key}...")

            # Download image from S3
            try:
                response = s3_client.get_object(Bucket=AWS_BUCKET, Key=s3_key)
                image_content = response["Body"].read()
            except ClientError as e:
                print(f"Failed to download {s3_key}: {e}")
                failed_count += 1
                continue

            # Generate blur data URL
            blur_data_url = generate_blur_data_url(image_content)

            # Update database
            cursor.execute(
                "UPDATE file_metadata SET blur_data_url = %s WHERE id = %s",
                (blur_data_url, photo_id),
            )
            db.commit()

            updated_count += 1
            print(f"✅ [{i}/{total_photos}] Updated {s3_key}")

        except Exception as e:
            print(f"❌ [{i}/{total_photos}] Failed to process photo ID {photo_id}: {e}")
            failed_count += 1
            db.rollback()

    print(f"\n🎉 Migration complete!")
    print(f"✅ Updated: {updated_count} photos")
    print(f"❌ Failed: {failed_count} photos")

    if failed_count > 0:
        print(
            f"⚠️  Note: {failed_count} photos failed to update, but this won't break the app (fallbacks are in place)"
        )

    cursor.close()
    db.close()


if __name__ == "__main__":
    print("Starting blur_data_url migration...")
    migrate_blur_data_urls()
