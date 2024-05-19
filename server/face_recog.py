from db_config import get_db
from aws import s3_client, rekognition_client as rekognition
from PIL import Image
import io
import os

AWS_BUCKET = os.environ.get("AWS_BUCKET")


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

    for face in face_details:
        # Attempt to search for the face in the collection
        search_response = rekognition.search_faces_by_image(
            CollectionId=AWS_BUCKET,
            Image={"S3Object": {"Bucket": bucket, "Name": file_path}},
            MaxFaces=1,
            FaceMatchThreshold=90,
        )

        if search_response["FaceMatches"]:
            face_id = search_response["FaceMatches"][0]["Face"]["FaceId"]
        else:
            # If the face is not found, index it
            index_response = rekognition.index_faces(
                CollectionId=AWS_BUCKET,
                Image={"S3Object": {"Bucket": bucket, "Name": file_path}},
                ExternalImageId=f"{photo_id}_{album_id}",
            )
            face_id = index_response["FaceRecords"][0]["Face"]["FaceId"]

        # Crop the face based on bounding box
        box = face["BoundingBox"]
        left = img.width * box["Left"]
        top = img.height * box["Top"]
        width = img.width * box["Width"]
        height = img.height * box["Height"]
        face_image = img.crop((left, top, left + width, top + height))

        # Generate a unique name for the cropped face image
        face_image_path = "faces/{}_{}_{}.jpg".format(photo_id, album_id, face_id)

        # Save the cropped face image to a byte stream
        img_byte_arr = io.BytesIO()
        face_image.save(img_byte_arr, format="JPEG")
        img_byte_arr = img_byte_arr.getvalue()

        # Upload the cropped face image to S3
        s3_client.put_object(Body=img_byte_arr, Bucket=bucket, Key=face_image_path, ContentType="image/jpeg")

        # Database updates for each face
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
