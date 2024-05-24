import io
import os
from PIL import Image
from aws import s3_client, rekognition_client as rekognition
from db_config import get_db

AWS_BUCKET = os.environ.get("AWS_BUCKET")


def ensure_directory_exists(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)


def detect_and_store_faces(file_path, photo_id, album_id, bucket):
    db, cursor = get_db()

    # Get the original image from S3
    original_image = s3_client.get_object(Bucket=bucket, Key=file_path)
    img = Image.open(io.BytesIO(original_image["Body"].read()))

    # Detect faces using Rekognition
    response = rekognition.detect_faces(
        Image={"S3Object": {"Bucket": bucket, "Name": file_path}}, Attributes=["ALL"]
    )

    face_details = response["FaceDetails"]
    print(f"Detected {len(face_details)} faces in the new image.")

    temp_dir = "temp_faces"
    ensure_directory_exists(temp_dir)  # Ensure the directory exists before saving files

    for index, face in enumerate(face_details):
        # Crop the image to just the face
        box = face["BoundingBox"]
        padding_factor = 1  # New padding factor to expand the crop area

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

        # Crop the image using the new coordinates
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
        # Now search using the individual face image
        search_response = rekognition.search_faces_by_image(
            CollectionId=AWS_BUCKET,
            Image={"S3Object": {"Bucket": bucket, "Name": temp_face_image_path}},
            MaxFaces=1,
            FaceMatchThreshold=90,
        )

        if search_response["FaceMatches"]:
            face_id = search_response["FaceMatches"][0]["Face"]["FaceId"]
            print(f"Face {index+1} matched with ID {face_id}")
        else:
            print("Face not found in the collection. Indexing...")
            index_response = rekognition.index_faces(
                CollectionId=AWS_BUCKET,
                Image={"S3Object": {"Bucket": bucket, "Name": temp_face_image_path}},
                ExternalImageId=f"{photo_id}_{index}",
            )
            face_id = index_response["FaceRecords"][0]["Face"]["FaceId"]
            print(f"New face indexed with ID {face_id}")

        # Update permanent file path to use face_id as filename
        permanent_face_image_path = f"faces/{face_id}.jpg"
        s3_client.upload_file(
            Filename=temp_face_image_path,
            Bucket=bucket,
            Key=permanent_face_image_path,
            ExtraArgs={"ContentType": "image/jpeg"},
        )
        # Delete the temporary image from S3 after processing
        s3_client.delete_object(Bucket=bucket, Key=temp_face_image_path)

        # delete the temporary image from the local directory
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
