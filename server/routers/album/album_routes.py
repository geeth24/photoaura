from fastapi import (
    HTTPException,
    APIRouter,
)
import os
import logging
from services.database import get_db, data_dir
from services.aws_service import s3_client, rekognition_client
from botocore.exceptions import ClientError
from psycopg import errors
from utils.utils import create_album_photos_json, add_album_to_user

router = APIRouter()
AWS_BUCKET = os.environ.get("AWS_BUCKET")
AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL")


@router.get("/api/album/{user_name}/{album_name}/")
async def get_album(user_name: str, album_name: str, secret: str = None):
    db, cursor = get_db()
    album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"
    cursor.execute("SELECT * FROM album WHERE slug=%s", (album_slug,))
    album = cursor.fetchone()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    # Fetch file metadata
    cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))
    file_metadata = cursor.fetchall()

    if not file_metadata:
        raise HTTPException(status_code=404, detail="No images found in the album")

    # Generate album photos with presigned URLs
    album_photos = create_album_photos_json(album_slug, file_metadata)

    # Fetch album permissions
    cursor.execute(
        "SELECT * FROM user_album_permissions WHERE album_id=%s", (album[0],)
    )
    album_permissions = cursor.fetchall()

    # Construct permissions list
    permissions_list = []
    for perm in album_permissions:
        cursor.execute("SELECT * FROM users WHERE id=%s", (perm[1],))
        user = cursor.fetchone()
        permissions_list.append(
            {
                "user_id": user[0],
                "user_name": user[1],
                "full_name": user[3],
                "user_email": user[4],
            }
        )

    return {
        "album_name": album[1],
        "slug": album[2],
        "image_count": album[5],
        "shared": album[6],
        "upload": album[7],
        "secret": album[8],
        "face_detection": album[9],
        "album_permissions": permissions_list,
        "album_photos": album_photos,
    }


@router.get("/api/albums/")
async def get_all_albums(
    user_id: int = None,
):
    # get all ablnum names and first 4 images in each album
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
    albums = cursor.fetchall()
    # print(albums)

    all_albums = []
    for album in albums:
        album_slug = album[2]
        album_name = album[1]

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))

        file_metadata = cursor.fetchall()

        # limit images to 4
        file_metadata = file_metadata[:4]

        album_photos = create_album_photos_json(album_slug, file_metadata)

        all_albums.append(
            {
                "album_id": album[0],
                "album_name": album_name,
                "slug": album[2],
                "image_count": album[5],
                "shared": album[6],
                "upload": album[7],
                "album_photos": album_photos,
            }
        )

    # return all albums which userid has access to
    if user_id:
        cursor.execute(
            "SELECT * FROM user_album_permissions WHERE user_id=%s", (user_id,)
        )
        user_albums = cursor.fetchall()
        user_album_ids = [album[2] for album in user_albums]
        all_albums = [
            album for album in all_albums if album["album_id"] in user_album_ids
        ]

    return all_albums


@router.get("/api/photos/")
async def get_all_photos(
    user_id: int = None,
):
    # get all album names
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
    albums = cursor.fetchall()

    all_photos = []
    for album in albums:
        # print(album)
        album_slug = album[2]
        album_name = album[1]

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))

        file_metadata = cursor.fetchall()

        album_photos = create_album_photos_json(album_slug, file_metadata)
        all_photos.extend(album_photos)

    # return all albums which userid has access to
    if user_id:
        cursor.execute(
            "SELECT * FROM user_album_permissions WHERE user_id=%s", (user_id,)
        )
        user_albums = cursor.fetchall()
        user_album_ids = [album[2] for album in user_albums]
        all_photos = [
            photo
            for photo in all_photos
            if photo["file_metadata"]["album_id"] in user_album_ids
        ]

    return all_photos


@router.delete("/api/album/delete/{user_name}/{album_name}/")
async def delete_album(user_name: str, album_name: str):
    album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"
    db, cursor = get_db()

    try:
        # Find the album ID
        cursor.execute("SELECT id FROM album WHERE name = %s", (album_name,))
        album = cursor.fetchone()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        album_id = album[0]

        # Delete any photo_face_link entries
        cursor.execute(
            "SELECT face_id FROM photo_face_link WHERE album_id = %s", (album_id,)
        )
        face_ids = cursor.fetchall()
        cursor.execute("DELETE FROM photo_face_link WHERE album_id = %s", (album_id,))

        # Delete faces from Rekognition if no longer referenced
        for (face_id,) in face_ids:
            cursor.execute(
                "SELECT COUNT(*) FROM photo_face_link WHERE face_id = %s", (face_id,)
            )
            if cursor.fetchone()[0] == 0:  # No other links to this face_id
                rekognition_client.delete_faces(
                    CollectionId=AWS_BUCKET, FaceIds=[face_id]
                )
                cursor.execute(
                    "DELETE FROM face_data WHERE external_id = %s", (face_id,)
                )

                # delete face image from S3
                objects_to_delete = s3_client.list_objects_v2(
                    Bucket=AWS_BUCKET, Prefix="faces"
                )

                # Assuming objects_to_delete is fetched from s3_client.list_objects_v2() call
                for obj in objects_to_delete.get("Contents", []):
                    # The key will include the face_id if the file is associated with that specific face
                    if str(face_id) in obj["Key"] and obj["Key"].startswith("faces/"):
                        try:
                            s3_client.delete_object(Bucket=AWS_BUCKET, Key=obj["Key"])
                        except Exception as e:
                            print(f"Failed to delete {obj['Key']} from S3: {e}")

        # Delete permissions associated with the album
        cursor.execute(
            "DELETE FROM user_album_permissions WHERE album_id = %s", (album_id,)
        )

        # Delete related file metadata records and S3 files
        cursor.execute(
            "SELECT filename FROM file_metadata WHERE album_id = %s", (album_id,)
        )
        # Attempt to delete the album directory from S3

        # List objects to be deleted
        objects_to_delete = s3_client.list_objects_v2(
            Bucket=AWS_BUCKET, Prefix=f"{user_name}/{album_slug}"
        )
        files = cursor.fetchall()
        for (filename,) in files:
            s3_client.delete_object(
                Bucket=AWS_BUCKET, Key=f"{user_name}/{album_name}/{filename}"
            )
            s3_client.delete_object(
                Bucket=AWS_BUCKET, Key=f"{user_name}/{album_name}/compressed/{filename}"
            )
        cursor.execute("DELETE FROM file_metadata WHERE album_id = %s", (album_id,))

        # Delete the album
        cursor.execute("DELETE FROM album WHERE id = %s", (album_id,))

        db.commit()

    except errors.ForeignKeyViolation as e:
        db.rollback()
        print(e)
        raise HTTPException(
            status_code=400, detail="Cannot delete data that is still referenced."
        )
    except Exception as e:
        print(e)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

    return {"message": "Album deleted successfully."}


@router.put("/api/album/")
async def update_album(
    album_name: str,
    album_new_name: str,
    shared: bool,
    upload: bool,
    slug: str,
    user_id: int = None,
    action: str = None,
):
    # print(album_name, album_new_name, shared)
    db, cursor = get_db()

    user_name = slug.split("/")[0]

    try:
        newSlug = user_name + "/" + album_new_name.lower().replace(" ", "-")
        # print("slug", slug)
        cursor.execute(
            "UPDATE album SET name=%s, shared=%s, upload=%s, location=%s, slug=%s WHERE slug=%s",
            (
                album_new_name,
                shared,
                upload,
                os.path.join(data_dir, user_name + "/" + album_new_name.lower()),
                newSlug,
                slug.lower(),
            ),
        )
        print("updated album")
        db.commit()
    except Exception as e:
        logging.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

    if album_name != album_new_name:

        # Rename the album directory in s3
        try:
            objects_to_rename = s3_client.list_objects_v2(
                Bucket=AWS_BUCKET, Prefix=f"{user_name}/{album_name.replace(' ', '-')}"
            )
            rename_keys = [
                {"Key": obj["Key"]} for obj in objects_to_rename.get("Contents", [])
            ]

            if rename_keys:
                for key in rename_keys:
                    new_key = key["Key"].replace(
                        album_name.replace(" ", "-"), album_new_name.replace(" ", "-")
                    )
                    s3_client.copy_object(
                        Bucket=AWS_BUCKET,
                        CopySource=f"{AWS_BUCKET}/{key['Key']}",
                        Key=new_key,
                    )
                    s3_client.delete_object(Bucket=AWS_BUCKET, Key=key["Key"])
        except ClientError as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to rename album in S3: {e}"
            )

    if user_id is not None:
        # cursor.execute("SELECT * FROM album WHERE name=%s", (album_new_name,))
        # album = cursor.fetchone()
        # add_album_to_user(user_id, album[0])
        if action == "update":
            cursor.execute("SELECT * FROM album WHERE name=%s", (album_new_name,))
            album = cursor.fetchone()
            add_album_to_user(user_id, album[0])

        elif action == "delete":
            cursor.execute("SELECT * FROM album WHERE name=%s", (album_name,))
            album = cursor.fetchone()

            # delete only the row that has the user_id
            cursor.execute(
                "DELETE FROM user_album_permissions WHERE user_id=%s AND album_id=%s",
                (user_id, album[0]),
            )
            db.commit()

    return {"message": "Album updated successfully."}


@router.get("/api/shared-albums/")
async def get_shared_albums():
    # get all ablnum names and first 4 images in each album
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album WHERE shared=%s", (True,))
    albums = cursor.fetchall()

    all_albums = []
    for album in albums:
        album_dir = album[2]
        album_name = album[1]
        if not os.path.exists(album_dir):
            raise HTTPException(status_code=404, detail="Album not found")

        # get first 4 images in album
        images = [
            image
            for image in os.listdir(album_dir + "/compressed")
            if not image.startswith(".")
        ][:4]

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))

        file_metadata = cursor.fetchall()

        album_photos = create_album_photos_json(
            album[0], album_dir, album_name, images, file_metadata
        )

        all_albums.append(
            {
                "album_name": album_name,
                "slug": album[2],
                "image_count": album[5],
                "shared": album[6],
                "upload": album[7],
                "album_photos": album_photos,
            }
        )

    return all_albums


@router.delete("/api/photo/delete/")
async def delete_photo(slug: str, photo_name: str):
    user_name = slug.split("/")[0]
    album_name = slug.split("/")[1]

    album_dir = os.path.join(data_dir, user_name + "/" + album_name.lower())
    album_compressed_dir = os.path.join(album_dir, "compressed")

    db, cursor = get_db()
    cursor.execute("SELECT * FROM album WHERE slug=%s", (slug,))
    album = cursor.fetchone()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    cursor.execute(
        "DELETE FROM file_metadata WHERE album_id=%s AND filename=%s",
        (album[0], photo_name),
    )

    db.commit()

    if os.path.exists(os.path.join(album_dir, photo_name)):
        os.remove(os.path.join(album_dir, photo_name))

    if os.path.exists(os.path.join(album_compressed_dir, photo_name)):
        os.remove(os.path.join(album_compressed_dir, photo_name))

    # update album image count
    cursor.execute(
        "UPDATE album SET image_count=%s WHERE slug=%s",
        (album[5] - 1, slug),
    )

    db.commit()

    return {"message": "Photo deleted successfully."}
