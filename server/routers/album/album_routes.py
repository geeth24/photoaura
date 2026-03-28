from fastapi import HTTPException, APIRouter, Depends
import os
import logging
from config import settings
from services.database import get_db
from services.aws_service import s3_client, rekognition_client
from botocore.exceptions import ClientError
from psycopg import errors
from utils.utils import create_album_photos_json, add_album_to_user

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL


@router.get("/api/album/{user_name}/{album_name}/")
async def get_album(user_name: str, album_name: str, secret: str = None):
    album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM album WHERE slug=%s", (album_slug,))
        album = cursor.fetchone()

        if album is None:
            raise HTTPException(status_code=404, detail="Album not found")

        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))
        file_metadata = cursor.fetchall()

        if not file_metadata:
            raise HTTPException(status_code=404, detail="No images found in the album")

        album_photos = create_album_photos_json(album_slug, file_metadata)

        cursor.execute(
            "SELECT * FROM user_album_permissions WHERE album_id=%s", (album[0],)
        )
        album_permissions = cursor.fetchall()

        permissions_list = []
        for perm in album_permissions:
            cursor.execute("SELECT * FROM users WHERE id=%s", (perm[1],))
            user = cursor.fetchone()
            if user:
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
async def get_all_albums(user_id: int = None):
    with get_db() as (db, cursor):
        if user_id:
            cursor.execute(
                """
                SELECT a.* FROM album a
                JOIN user_album_permissions uap ON a.id = uap.album_id
                WHERE uap.user_id = %s
                """,
                (user_id,),
            )
        else:
            cursor.execute("SELECT * FROM album")
        albums = cursor.fetchall()

        all_albums = []
        for album in albums:
            cursor.execute(
                "SELECT * FROM file_metadata WHERE album_id=%s LIMIT 4",
                (album[0],),
            )
            file_metadata = cursor.fetchall()
            album_photos = create_album_photos_json(album[2], file_metadata)

            all_albums.append(
                {
                    "album_id": album[0],
                    "album_name": album[1],
                    "slug": album[2],
                    "image_count": album[5],
                    "shared": album[6],
                    "upload": album[7],
                    "album_photos": album_photos,
                }
            )

        return all_albums


@router.get("/api/photos/")
async def get_all_photos(user_id: int = None):
    with get_db() as (db, cursor):
        if user_id:
            cursor.execute(
                """
                SELECT a.* FROM album a
                JOIN user_album_permissions uap ON a.id = uap.album_id
                WHERE uap.user_id = %s
                """,
                (user_id,),
            )
        else:
            cursor.execute("SELECT * FROM album")
        albums = cursor.fetchall()

        all_photos = []
        for album in albums:
            cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))
            file_metadata = cursor.fetchall()
            album_photos = create_album_photos_json(album[2], file_metadata)
            all_photos.extend(album_photos)

        return all_photos


@router.delete("/api/album/delete/{user_name}/{album_name}/")
async def delete_album(user_name: str, album_name: str):
    album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"

    with get_db() as (db, cursor):
        try:
            cursor.execute("SELECT id FROM album WHERE name = %s", (album_name,))
            album = cursor.fetchone()
            if not album:
                raise HTTPException(status_code=404, detail="Album not found")
            album_id = album[0]

            cursor.execute(
                "SELECT face_id FROM photo_face_link WHERE album_id = %s", (album_id,)
            )
            face_ids = cursor.fetchall()
            cursor.execute("DELETE FROM photo_face_link WHERE album_id = %s", (album_id,))

            for (face_id,) in face_ids:
                cursor.execute(
                    "SELECT COUNT(*) FROM photo_face_link WHERE face_id = %s", (face_id,)
                )
                if cursor.fetchone()[0] == 0:
                    rekognition_client.delete_faces(
                        CollectionId=AWS_BUCKET, FaceIds=[face_id]
                    )
                    cursor.execute(
                        "DELETE FROM face_data WHERE external_id = %s", (face_id,)
                    )

                    objects_to_delete = s3_client.list_objects_v2(
                        Bucket=AWS_BUCKET, Prefix="faces"
                    )
                    for obj in objects_to_delete.get("Contents", []):
                        if str(face_id) in obj["Key"] and obj["Key"].startswith("faces/"):
                            try:
                                s3_client.delete_object(Bucket=AWS_BUCKET, Key=obj["Key"])
                            except Exception as e:
                                print(f"Failed to delete {obj['Key']} from S3: {e}")

            cursor.execute(
                "DELETE FROM user_album_permissions WHERE album_id = %s", (album_id,)
            )

            cursor.execute(
                "DELETE FROM album_categories WHERE album_id = %s", (album_id,)
            )

            cursor.execute(
                "SELECT filename FROM file_metadata WHERE album_id = %s", (album_id,)
            )
            files = cursor.fetchall()
            for (filename,) in files:
                s3_client.delete_object(
                    Bucket=AWS_BUCKET, Key=f"{album_slug}/{filename}"
                )
            cursor.execute("DELETE FROM file_metadata WHERE album_id = %s", (album_id,))

            cursor.execute("DELETE FROM album WHERE id = %s", (album_id,))

            db.commit()
            return {"message": "Album deleted successfully."}

        except errors.ForeignKeyViolation as e:
            db.rollback()
            logging.error(f"ForeignKey violation: {e}")
            raise HTTPException(
                status_code=400, detail="Cannot delete data that is still referenced."
            )
        except Exception as e:
            logging.error(f"Error deleting album: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))


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
    user_name = slug.split("/")[0]
    new_slug = f"{user_name}/{album_new_name.lower().replace(' ', '-')}"

    with get_db() as (db, cursor):
        try:
            cursor.execute(
                "UPDATE album SET name=%s, shared=%s, upload=%s, location=%s, slug=%s WHERE slug=%s",
                (
                    album_new_name,
                    shared,
                    upload,
                    os.path.join(settings.DATA_DIR, f"{user_name}/{album_new_name.lower()}"),
                    new_slug,
                    slug.lower(),
                ),
            )
            db.commit()

            if album_name != album_new_name:
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
                if action == "update":
                    cursor.execute("SELECT * FROM album WHERE name=%s", (album_new_name,))
                    album = cursor.fetchone()
                    if album:
                        add_album_to_user(user_id, album[0])

                elif action == "delete":
                    cursor.execute("SELECT * FROM album WHERE name=%s", (album_name,))
                    album = cursor.fetchone()
                    if album:
                        cursor.execute(
                            "DELETE FROM user_album_permissions WHERE user_id=%s AND album_id=%s",
                            (user_id, album[0]),
                        )
                        db.commit()

            return {"message": "Album updated successfully."}
        except Exception as e:
            logging.error(f"Database error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail="Database update failed")


@router.get("/api/shared-albums/")
async def get_shared_albums():
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM album WHERE shared=%s", (True,))
        albums = cursor.fetchall()

        all_albums = []
        for album in albums:
            cursor.execute(
                "SELECT * FROM file_metadata WHERE album_id=%s LIMIT 4",
                (album[0],),
            )
            file_metadata = cursor.fetchall()
            album_photos = create_album_photos_json(album[2], file_metadata)

            all_albums.append(
                {
                    "album_name": album[1],
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
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM album WHERE slug=%s", (slug,))
        album = cursor.fetchone()

        if album is None:
            raise HTTPException(status_code=404, detail="Album not found")

        cursor.execute(
            "DELETE FROM file_metadata WHERE album_id=%s AND filename=%s",
            (album[0], photo_name),
        )
        db.commit()

        cursor.execute(
            "UPDATE album SET image_count=%s WHERE slug=%s",
            (album[5] - 1, slug),
        )
        db.commit()

        return {"message": "Photo deleted successfully."}
