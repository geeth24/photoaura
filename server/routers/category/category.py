from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from db.base import get_session
from db.models import Category, AlbumCategory, Album, FileMetadata, CategoryPhoto
from utils.utils import create_album_photos_json, build_photo_json
from dependencies import get_current_user, require_admin

router = APIRouter()


def _curated_photos(session, category_id, orientation=None):
    """A category's curated photos: ordered, deduped, each URL built from the
    album it actually lives in. Returns None when nothing's curated yet so the
    caller can fall back to the old one-album-per-category behaviour."""
    q = (
        session.query(FileMetadata, Album.slug)
        .join(CategoryPhoto, CategoryPhoto.photo_id == FileMetadata.id)
        .join(Album, Album.id == FileMetadata.album_id)
        .filter(CategoryPhoto.category_id == category_id)
        .order_by(CategoryPhoto.sort_order, CategoryPhoto.id)
    )
    if orientation:
        q = q.filter(FileMetadata.orientation == orientation)
    rows = q.all()
    if not rows:
        return None
    seen, out = set(), []
    for meta, slug in rows:
        if meta.id in seen:
            continue
        seen.add(meta.id)
        out.append(build_photo_json(meta, slug))
    return out


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
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    slug = name.lower().replace(" ", "-")
    session.add(Category(name=name, slug=slug))
    return {"message": "Category created successfully"}


# delete a category
@router.delete("/api/categories/{category_id}")
async def delete_category(
    category_id: int,
    current_user=Depends(require_admin),
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
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    session.add(AlbumCategory(album_id=album_id, category_id=category_id))
    return {"message": "Album linked to category successfully"}


# route for deleting a link between an album and a category
@router.delete("/api/album-categories")
async def unlink_album_from_category(
    album_id: int,
    category_id: int,
    current_user=Depends(require_admin),
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

    # curated selection wins; fall back to the whole linked album
    album_photos = _curated_photos(session, category_id)
    if album_photos is None:
        if not album:
            raise HTTPException(status_code=404, detail="Album not found for this category")
        album_photos = create_album_photos_json(
            album.slug, session.query(FileMetadata).filter_by(album_id=album.id).all()
        )

    if not album:
        # curated-only category (no backing album) — name it from the category
        cat = session.get(Category, category_id)
        return {
            "id": category_id,
            "name": cat.name if cat else "",
            "slug": cat.slug if cat else "",
            "location": None,
            "date": None,
            "image_count": len(album_photos),
            "shared": True,
            "upload": False,
            "secret": None,
            "album_photos": album_photos,
        }

    return {
        "id": album.id,
        "name": album.name,
        "slug": album.slug,
        "location": album.location,
        "date": album.date,
        "image_count": len(album_photos),
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
    out = []
    for category in session.query(Category).order_by(Category.id).all():
        album = (
            session.query(Album)
            .join(AlbumCategory, Album.id == AlbumCategory.album_id)
            .filter(AlbumCategory.category_id == category.id)
            .first()
        )

        # curated selection wins; fall back to the whole linked album
        album_photos = _curated_photos(session, category.id, orientation)
        if album_photos is None:
            if not album:
                continue
            photos_query = session.query(FileMetadata).filter_by(album_id=album.id)
            if orientation:
                photos_query = photos_query.filter_by(orientation=orientation)
            album_photos = create_album_photos_json(album.slug, photos_query.all())

        album_details = {
            "id": album.id if album else category.id,
            "name": album.name if album else category.name,
            "slug": album.slug if album else category.slug,
            "location": album.location if album else None,
            "date": album.date if album else None,
            "image_count": len(album_photos),
            "shared": album.shared if album else True,
            "upload": album.upload if album else False,
            "secret": album.secret if album else None,
            "album_photos": album_photos,
        }
        out.append({
            "category_id": category.id,
            "category_name": category.name,
            "category_slug": category.slug,
            "album": album_details,
        })

    return out


# ---- admin: curate a category's photos (references, no re-upload) ----

@router.get("/api/categories/{category_id}/photos")
def list_category_photos(
    category_id: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """The category's curated photos in order, for the admin editor."""
    rows = (
        session.query(FileMetadata, Album.slug, Album.name)
        .join(CategoryPhoto, CategoryPhoto.photo_id == FileMetadata.id)
        .join(Album, Album.id == FileMetadata.album_id)
        .filter(CategoryPhoto.category_id == category_id)
        .order_by(CategoryPhoto.sort_order, CategoryPhoto.id)
        .all()
    )
    return [
        {
            "photo_id": meta.id,
            "album_id": meta.album_id,
            "album_name": album_name,
            "filename": meta.filename,
            "compressed_image": build_photo_json(meta, slug)["compressed_image"],
        }
        for meta, slug, album_name in rows
    ]


class CategoryPhotosBody(BaseModel):
    photo_ids: list[int]


@router.post("/api/categories/{category_id}/photos")
def add_category_photos(
    category_id: int,
    body: CategoryPhotosBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Add photos (by file_metadata id, from any album) to a category."""
    if not session.get(Category, category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    base = session.query(
        func.coalesce(func.max(CategoryPhoto.sort_order), -1)
    ).filter_by(category_id=category_id).scalar() or -1
    existing = {
        pid for (pid,) in session.query(CategoryPhoto.photo_id)
        .filter_by(category_id=category_id).all()
    }
    added = 0
    for pid in body.photo_ids:
        if pid in existing or not session.get(FileMetadata, pid):
            continue
        base += 1
        added += 1
        existing.add(pid)
        session.add(CategoryPhoto(category_id=category_id, photo_id=pid, sort_order=base))
    session.commit()
    return {"added": added}


@router.delete("/api/categories/{category_id}/photos/{photo_id}")
def remove_category_photo(
    category_id: int,
    photo_id: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    session.query(CategoryPhoto).filter_by(
        category_id=category_id, photo_id=photo_id
    ).delete()
    session.commit()
    return {"message": "Removed"}


class ReorderBody(BaseModel):
    photo_ids: list[int]  # desired order


@router.put("/api/categories/{category_id}/photos/order")
def reorder_category_photos(
    category_id: int,
    body: ReorderBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    order = {pid: i for i, pid in enumerate(body.photo_ids)}
    for cp in session.query(CategoryPhoto).filter_by(category_id=category_id).all():
        if cp.photo_id in order:
            cp.sort_order = order[cp.photo_id]
    session.commit()
    return {"message": "Reordered"}
