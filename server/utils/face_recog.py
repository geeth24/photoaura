import io
import os
from PIL import Image
from services.aws_service import s3_client, rekognition_client as rekognition
from services.database import get_db

AWS_BUCKET = os.environ.get("AWS_BUCKET")


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
    db, cursor = get_db()

    # Get the original image from S3
    original_image = s3_client.get_object(Bucket=bucket, Key=file_path)
    img = Image.open(io.BytesIO(original_image["Body"].read()))

    # Detect faces using Rekognition
    response = rekognition.detect_faces(
        Image={"S3Object": {"Bucket": bucket, "Name": file_path}}, Attributes=["ALL"]
    )

    face_details = response.get("FaceDetails", [])
    if not face_details:
        print("No faces detected in the image.")
        return "No faces detected."

    print(f"Detected {len(face_details)} faces in the new image.")

    temp_dir = "temp_faces"
    ensure_directory_exists(temp_dir)  # Ensure the directory exists before saving files

    for index, face in enumerate(face_details):
        yaw = face["Pose"]["Yaw"]
        pitch = face["Pose"]["Pitch"]
        width = face["BoundingBox"]["Width"]
        height = face["BoundingBox"]["Height"]

        # Skip the face if it is not facing forward enough or doesn't meet bounding box ratio
        if not is_face_forward(yaw, pitch, width, height):
            print(
                f"Skipping face {index + 1} due to extreme angle or small width ratio: Yaw={yaw}, Pitch={pitch}, Ratio={width/height}"
            )
            continue

        # Crop and save the face locally
        box = face["BoundingBox"]
        padding_factor = 1.2  # Adjust padding for better recognition of side faces

        # Calculate coordinates with padding
        left = int((box["Left"] - box["Width"] * padding_factor / 2) * img.width)
        top = int((box["Top"] - box["Height"] * padding_factor / 2) * img.height)
        right = int((box["Left"] + box["Width"] * (1 + padding_factor / 2)) * img.width)
        bottom = int(
            (box["Top"] + box["Height"] * (1 + padding_factor / 2)) * img.height
        )

        # Ensure the coordinates do not go out of image boundaries
        left = max(0, left)
        top = max(0, top)
        right = min(img.width, right)
        bottom = min(img.height, bottom)

        # Crop the face and save locally
        face_image = img.crop((left, top, right, bottom))
        temp_face_image_path = os.path.join(temp_dir, f"face_{photo_id}_{index}.jpg")
        face_image.save(temp_face_image_path)

        # Upload the cropped face image to S3 for searching
        s3_client.upload_file(
            Filename=temp_face_image_path,
            Bucket=bucket,
            Key=temp_face_image_path,
            ExtraArgs={"ContentType": "image/jpeg"},
        )

        # Try to search for the face in the collection
        try:
            search_response = rekognition.search_faces_by_image(
                CollectionId=AWS_BUCKET,
                Image={"S3Object": {"Bucket": bucket, "Name": temp_face_image_path}},
                MaxFaces=1,
                FaceMatchThreshold=70,  # Lower threshold for better matching
            )

            if search_response["FaceMatches"]:
                face_id = search_response["FaceMatches"][0]["Face"]["FaceId"]
                print(f"Face {index + 1} matched with ID {face_id}")
            else:
                print(f"Face {index + 1} not found in the collection. Indexing...")

                # Index the face
                index_response = rekognition.index_faces(
                    CollectionId=AWS_BUCKET,
                    Image={
                        "S3Object": {"Bucket": bucket, "Name": temp_face_image_path}
                    },
                    ExternalImageId=f"{photo_id}_{index}",
                )
                face_id = index_response["FaceRecords"][0]["Face"]["FaceId"]
                print(f"New face indexed with ID {face_id}")

        except rekognition.exceptions.InvalidParameterException as e:
            print(f"Error processing face {index + 1}: {e}")
            continue  # Skip to the next face if there's an issue

        # Update the permanent file path
        permanent_face_image_path = f"faces/{face_id}.jpg"
        s3_client.upload_file(
            Filename=temp_face_image_path,
            Bucket=bucket,
            Key=permanent_face_image_path,
            ExtraArgs={"ContentType": "image/jpeg"},
        )

        # Clean up
        os.remove(temp_face_image_path)

        # Update database records
        cursor.execute(
            "INSERT INTO face_data (external_id) VALUES (%s) ON CONFLICT (external_id) DO NOTHING",
            (face_id,),
        )
        cursor.execute(
            "INSERT INTO photo_face_link (photo_id, face_id, album_id) VALUES (%s, %s, %s)",
            (photo_id, face_id, album_id),
        )

    db.commit()
    cursor.close()
    return "Faces processed and stored."
