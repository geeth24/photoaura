import boto3
from botocore.exceptions import ClientError
import os
from services.database import get_db
from services.aws_service import rekognition_client
from services.aws_service import s3_client as s3

AWS_BUCKET = os.environ.get("AWS_BUCKET")


def delete_files_in_s3_bucket():
    # Initialize a session using Amazon S3

    try:
        # Get the bucket
        bucket = s3.list_objects_v2(Bucket=AWS_BUCKET)

        # If the bucket is empty, return
        if "Contents" not in bucket:
            print(f"Bucket {AWS_BUCKET} is empty.")
            return

        # Delete all objects in the bucket
        for obj in bucket["Contents"]:
            key = obj["Key"]
            s3.delete_object(Bucket=AWS_BUCKET, Key=key)
            print(f"Deleted object {key}")

        print(f"All objects in bucket {AWS_BUCKET} have been deleted.")

    except ClientError as e:
        print(f"Error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")


def delete_tables_in_database():
    db, cursor = get_db()

    try:
        # Query to retrieve all table names in the public schema
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
        tables = cursor.fetchall()

        # Disable foreign key checks to avoid issues when dropping tables with dependencies
        cursor.execute("SET session_replication_role = 'replica';")

        # Loop through the list of tables and drop each one
        for table in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table[0]} CASCADE;")
            print(f"Dropped table {table[0]}")

        # Re-enable foreign key checks
        cursor.execute("SET session_replication_role = 'origin';")

        db.commit()
        print("All tables in the database have been deleted.")

    except Exception as e:
        print(f"Unexpected error: {e}")
        db.rollback()
    finally:
        cursor.close()
        db.close()


def delete_faces_in_rekognition_collection():

    try:
        # List all faces in the collection
        response = rekognition_client.list_faces(CollectionId=AWS_BUCKET)
        face_ids = [face["FaceId"] for face in response["Faces"]]

        if not face_ids:
            print(f"No faces found in collection {AWS_BUCKET} to delete.")
            return

        # Delete faces from the collection
        delete_response = rekognition_client.delete_faces(
            CollectionId=AWS_BUCKET, FaceIds=face_ids
        )

        print(f"Deleted face IDs: {delete_response['DeletedFaces']}")

    except rekognition_client.exceptions.ResourceNotFoundException:
        print(f"Collection {AWS_BUCKET} not found.")
    except ClientError as e:
        print(f"Error deleting faces: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")


def delete_all_resources():
    print("Deleting files in S3 bucket...")
    delete_files_in_s3_bucket()

    print("Deleting all tables in database...")
    delete_tables_in_database()

    print("Deleting faces in Rekognition collection...")
    delete_faces_in_rekognition_collection()
