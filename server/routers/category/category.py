from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from db.base import get_session
from db.models import Category, AlbumCategory, Album, FileMetadata
from utils.utils import create_album_photos_json
from dependencies import get_current_user

router = APIRouter()


# route for getting all categories
@router.get("/api/categories")
async def get_categories(
    current_user=Depends(get_current_user), session: Session = Depends(get_session)
):
    categories = session.query(Category).all()
    return [
        {"id": category.id, "name": category.name, "slug": category.slug}
        for category in categories
    ]


# route for making a new category
@router.post("/api/categories")
async def create_category(
    name: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    slug = name.lower().replace(" ", "-")
    session.add(Category(name=name, slug=slug))
    return {"message": "Category created successfully"}


# delete a category
@router.delete("/api/categories/{category_id}")
async def delete_category(
    category_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    session.query(AlbumCategory).filter_by(category_id=category_id).delete()
    session.query(Category).filter_by(id=category_id).delete()
    return {"message": "Category deleted successfully"}


# route linking an album to a category
@router.post("/api/album-categories")
async def link_album_to_category(
    album_id: int,
    category_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    session.add(AlbumCategory(album_id=album_id, category_id=category_id))
    return {"message": "Album linked to category successfully"}


# route for deleting a link between an album and a category
@router.delete("/api/album-categories")
async def unlink_album_from_category(
    album_id: int,
    category_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    session.query(AlbumCategory).filter_by(
        album_id=album_id, category_id=category_id
    ).delete()
    return {"message": "Album unlinked from category successfully"}


# route for the category albums get the one album linked to it
@router.get("/api/category-albums/{category_id}")
async def get_album_by_category(
    category_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    album = (
        session.query(Album)
        .join(AlbumCategory, Album.id == AlbumCategory.album_id)
        .filter(AlbumCategory.category_id == category_id)
        .first()
    )
    if not album:
        raise HTTPException(status_code=404, detail="Album not found for this category")

    album_photos = (
        session.query(FileMetadata).filter_by(album_id=album.id).all()
    )

    if not album_photos:
        raise HTTPException(
            status_code=404, detail="No album_photos found for this album"
        )

    album_photos = create_album_photos_json(album.slug, album_photos)

    return {
        "id": album.id,
        "name": album.name,
        "slug": album.slug,
        "location": album.location,
        "date": album.date,
        "image_count": album.image_count,
        "shared": album.shared,
        "upload": album.upload,
        "secret": album.secret,
        "album_photos": album_photos,
    }


# route for getting all albums linked each category
@router.get("/api/category-albums")
async def get_albums_by_category(
    orientation: str = None, session: Session = Depends(get_session)
):
    rows = (
        session.query(AlbumCategory, Category, Album)
        .join(Album, Album.id == AlbumCategory.album_id)
        .join(Category, Category.id == AlbumCategory.category_id)
        .all()
    )

    albums_by_category = {}
    for album_category, category, album in rows:
        album_details = {
            "id": album.id,
            "name": album.name,
            "slug": album.slug,
            "location": album.location,
            "date": album.date,
            "image_count": album.image_count,
            "shared": album.shared,
            "upload": album.upload,
            "secret": album.secret,
            "album_photos": [],
        }

        photos_query = session.query(FileMetadata).filter_by(album_id=album.id)
        if orientation:
            photos_query = photos_query.filter_by(orientation=orientation)
        album_photos = create_album_photos_json(album.slug, photos_query.all())
        album_details["album_photos"] = album_photos

        if category.id not in albums_by_category:
            albums_by_category[category.id] = {
                "category_id": category.id,
                "category_name": category.name,
                "category_slug": category.slug,
                "album": album_details,
            }

    return list(albums_by_category.values())
