import io
import os
from PIL import Image
from config import settings
from services.aws_service import s3_client, rekognition_client as rekognition
from services.database import get_db

AWS_BUCKET = settings.AWS_BUCKET


def ensure_directory_exists(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)


def is_face_forward(
    yaw, pitch, width, height, yaw_threshold=30, pitch_threshold=30, ratio_threshold=0.6
):
    """Returns True if the face is within yaw, pitch, and bounding box width/height ratio thresholds."""
    face_ratio = width / height  # Ratio of bounding box width to height
    return (
        abs(yaw) <= yaw_threshold
        and abs(pitch) <= pitch_threshold
        and face_ratio > ratio_threshold
    )


def detect_and_store_faces(file_path, photo_id, album_id, bucket):
    with get_db() as (db, cursor):
        original_image = s3_client.get_object(Bucket=bucket, Key=file_path)
        img = Image.open(io.BytesIO(original_image["Body"].read()))

        response = rekognition.detect_faces(
            Image={"S3Object": {"Bucket": bucket, "Name": file_path}}, Attributes=["ALL"]
        )

        face_details = response.get("FaceDetails", [])
        if not face_details:
            return "No faces detected."

        temp_dir = "temp_faces"
        ensure_directory_exists(temp_dir)

        for index, face in enumerate(face_details):
            yaw = face["Pose"]["Yaw"]
            pitch = face["Pose"]["Pitch"]
            width = face["BoundingBox"]["Width"]
            height = face["BoundingBox"]["Height"]

            if not is_face_forward(yaw, pitch, width, height):
                continue

            box = face["BoundingBox"]
            padding_factor = 1.2

            left = int((box["Left"] - box["Width"] * padding_factor / 2) * img.width)
            top = int((box["Top"] - box["Height"] * padding_factor / 2) * img.height)
            right = int((box["Left"] + box["Width"] * (1 + padding_factor / 2)) * img.width)
            bottom = int(
                (box["Top"] + box["Height"] * (1 + padding_factor / 2)) * img.height
            )

            left = max(0, left)
            top = max(0, top)
            right = min(img.width, right)
            bottom = min(img.height, bottom)

            face_image = img.crop((left, top, right, bottom))
            temp_face_image_path = os.path.join(temp_dir, f"face_{photo_id}_{index}.jpg")
            face_image.save(temp_face_image_path)

            s3_client.upload_file(
                Filename=temp_face_image_path,
                Bucket=bucket,
                Key=temp_face_image_path,
                ExtraArgs={"ContentType": "image/jpeg"},
            )

            try:
                search_response = rekognition.search_faces_by_image(
                    CollectionId=AWS_BUCKET,
                    Image={"S3Object": {"Bucket": bucket, "Name": temp_face_image_path}},
                    MaxFaces=1,
                    FaceMatchThreshold=70,
                )

                if search_response["FaceMatches"]:
                    face_id = search_response["FaceMatches"][0]["Face"]["FaceId"]
                else:
                    index_response = rekognition.index_faces(
                        CollectionId=AWS_BUCKET,
                        Image={
                            "S3Object": {"Bucket": bucket, "Name": temp_face_image_path}
                        },
                        ExternalImageId=f"{photo_id}_{index}",
                    )
                    face_id = index_response["FaceRecords"][0]["Face"]["FaceId"]

            except rekognition.exceptions.InvalidParameterException as e:
                print(f"Error processing face {index + 1}: {e}")
                continue

            permanent_face_image_path = f"faces/{face_id}.jpg"
            s3_client.upload_file(
                Filename=temp_face_image_path,
                Bucket=bucket,
                Key=permanent_face_image_path,
                ExtraArgs={"ContentType": "image/jpeg"},
            )

            os.remove(temp_face_image_path)

            cursor.execute(
                "INSERT INTO face_data (external_id) VALUES (%s) ON CONFLICT (external_id) DO NOTHING",
                (face_id,),
            )
            cursor.execute(
                "INSERT INTO photo_face_link (photo_id, face_id, album_id) VALUES (%s, %s, %s)",
                (photo_id, face_id, album_id),
            )

            db.commit()
        return "Faces processed and stored."
