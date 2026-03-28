from fastapi import APIRouter, HTTPException, Depends
from services.database import get_db
from utils.utils import create_album_photos_json
from dependencies import get_current_user

router = APIRouter()


# route for getting all categories
@router.get("/api/categories")
async def get_categories(current_user = Depends(get_current_user)):
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM categories")
        categories = cursor.fetchall()
        return [
            {"id": category[0], "name": category[1], "slug": category[2]}
            for category in categories
        ]


# route for making a new category
@router.post("/api/categories")
async def create_category(name: str, current_user = Depends(get_current_user)):
    with get_db() as (db, cursor):
        slug = name.lower().replace(" ", "-")
        cursor.execute(
            "INSERT INTO categories (name, slug) VALUES (%s, %s)", (name, slug)
        )
        db.commit()
        return {"message": "Category created successfully"}


# delete a category
@router.delete("/api/categories/{category_id}")
async def delete_category(category_id: int, current_user = Depends(get_current_user)):
    with get_db() as (db, cursor):
        cursor.execute("DELETE FROM album_categories WHERE category_id = %s", (category_id,))
        db.commit()
        cursor.execute("DELETE FROM categories WHERE id = %s", (category_id,))
        db.commit()
        return {"message": "Category deleted successfully"}


# route linking an album to a category
@router.post("/api/album-categories")
async def link_album_to_category(album_id: int, category_id: int, current_user = Depends(get_current_user)):
    with get_db() as (db, cursor):
        cursor.execute(
            "INSERT INTO album_categories (album_id, category_id) VALUES (%s, %s)",
            (album_id, category_id),
        )
        db.commit()
        return {"message": "Album linked to category successfully"}


# route for deleting a link between an album and a category
@router.delete("/api/album-categories")
async def unlink_album_from_category(album_id: int, category_id: int, current_user = Depends(get_current_user)):
    with get_db() as (db, cursor):
        cursor.execute(
            "DELETE FROM album_categories WHERE album_id = %s AND category_id = %s",
            (album_id, category_id),
        )
        db.commit()
        return {"message": "Album unlinked from category successfully"}


# route for the category albums get the one album linked to it
@router.get("/api/category-albums/{category_id}")
async def get_album_by_category(category_id: int, current_user = Depends(get_current_user)):
    with get_db() as (db, cursor):
        cursor.execute(
            """
            SELECT album.* FROM album
            JOIN album_categories ON album.id = album_categories.album_id
            WHERE album_categories.category_id = %s
            """,
            (category_id,),
        )
        album = cursor.fetchone()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found for this category")

        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))
        album_photos = cursor.fetchall()

        if not album_photos:
            raise HTTPException(
                status_code=404, detail="No album_photos found for this album"
            )

        album_photos = create_album_photos_json(album[2], album_photos)

        return {
            "id": album[0],
            "name": album[1],
            "slug": album[2],
            "location": album[3],
            "date": album[4],
            "image_count": album[5],
            "shared": album[6],
            "upload": album[7],
            "secret": album[8],
            "album_photos": album_photos,
        }


# route for getting all albums linked each category
@router.get("/api/category-albums")
async def get_albums_by_category():
    with get_db() as (db, cursor):
        cursor.execute(
            """
            SELECT ac.category_id, c.name as category_name, c.slug as category_slug, a.id, a.name, 
                   a.slug, a.location, a.date, a.image_count, a.shared, a.upload, a.secret
            FROM album a
            JOIN album_categories ac ON a.id = ac.album_id
            JOIN categories c ON c.id = ac.category_id
            """
        )
        albums = cursor.fetchall()

        albums_by_category = {}
        for album in albums:
            category_id = album[0]
            category_name = album[1]
            category_slug = album[2]
            album_details = {
                "id": album[3],
                "name": album[4],
                "slug": album[5],
                "location": album[6],
                "date": album[7],
                "image_count": album[8],
                "shared": album[9],
                "upload": album[10],
                "secret": album[11],
                "album_photos": [],
            }

            cursor.execute("SELECT * FROM file_metadata WHERE album_id = %s", (album[3],))
            album_photos = cursor.fetchall()
            album_photos = create_album_photos_json(album[5], album_photos)
            album_details["album_photos"] = album_photos

            if category_id not in albums_by_category:
                albums_by_category[category_id] = {
                    "category_id": category_id,
                    "category_name": category_name,
                    "category_slug": category_slug,
                    "album": album_details,
                }

        return list(albums_by_category.values())
