from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    TIMESTAMP,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_name: Mapped[Optional[str]] = mapped_column(String(255))
    user_password: Mapped[Optional[str]] = mapped_column(String(255))
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    user_email: Mapped[Optional[str]] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), server_default="client")
    last_login_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP)


class MagicLink(Base):
    __tablename__ = "magic_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    purpose: Mapped[str] = mapped_column(String(20), server_default="login")
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    used_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)
    # for verify-email links, which user_emails row to mark verified
    user_email_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("user_emails.id"), nullable=True
    )
    created_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class UserEmail(Base):
    __tablename__ = "user_emails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class Album(Base):
    __tablename__ = "album"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    slug: Mapped[Optional[str]] = mapped_column(String(255))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    date: Mapped[Optional[str]] = mapped_column(String(255))
    image_count: Mapped[Optional[int]] = mapped_column(Integer)
    shared: Mapped[Optional[bool]] = mapped_column(Boolean)
    upload: Mapped[Optional[bool]] = mapped_column(Boolean)
    secret: Mapped[Optional[str]] = mapped_column(String(255))
    face_detection: Mapped[Optional[bool]] = mapped_column(Boolean)
    # website-management albums (category backings + standalone uploads) are
    # hidden from the client Albums + All Photos views; managed under /website
    is_website: Mapped[Optional[bool]] = mapped_column(Boolean, server_default="false")
    # public = openable by anyone; private (default) needs the share secret
    public: Mapped[Optional[bool]] = mapped_column(Boolean, server_default="false")

    photos: Mapped[list["FileMetadata"]] = relationship(
        back_populates="album", cascade="all, delete-orphan"
    )
    permissions: Mapped[list["UserAlbumPermission"]] = relationship(
        back_populates="album"
    )


class FileMetadata(Base):
    __tablename__ = "file_metadata"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    album_id: Mapped[Optional[int]] = mapped_column(ForeignKey("album.id"))
    filename: Mapped[Optional[str]] = mapped_column(String(255))
    content_type: Mapped[Optional[str]] = mapped_column(String(50))
    size: Mapped[Optional[int]] = mapped_column(Integer)
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    upload_date: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP)
    exif_data: Mapped[Optional[Any]] = mapped_column(JSON)
    blur_data_url: Mapped[Optional[str]] = mapped_column(Text)
    orientation: Mapped[Optional[str]] = mapped_column(String(10))
    description: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))

    album: Mapped[Optional["Album"]] = relationship(back_populates="photos")


class UserAlbumPermission(Base):
    __tablename__ = "user_album_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    album_id: Mapped[Optional[int]] = mapped_column(ForeignKey("album.id"))

    user: Mapped[Optional["User"]] = relationship()
    album: Mapped[Optional["Album"]] = relationship(back_populates="permissions")


class ClientFile(Base):
    """A downloadable deliverable (e.g. a zip of originals) the photographer
    attaches to a client. Optionally tied to an album. Stored raw in S3 and
    served to the client via a presigned download URL."""

    __tablename__ = "client_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    album_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("album.id"), nullable=True
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    size: Mapped[Optional[int]] = mapped_column(Integer)
    content_type: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    slug: Mapped[Optional[str]] = mapped_column(String(255))


class AlbumCategory(Base):
    __tablename__ = "album_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    album_id: Mapped[Optional[int]] = mapped_column(ForeignKey("album.id"), unique=True)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id"), unique=True
    )

    album: Mapped[Optional["Album"]] = relationship()
    category: Mapped[Optional["Category"]] = relationship()


class CategoryPhoto(Base):
    """A website category curated as an ordered set of individual photos,
    referencing file_metadata by id — so a category can mix photos pulled
    from any client album with standalone website-only uploads, with no
    duplication. Supersedes the one-album-per-category link for display."""

    __tablename__ = "category_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE")
    )
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("file_metadata.id", ondelete="CASCADE")
    )
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")


class FaceData(Base):
    __tablename__ = "face_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    external_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    # quality of the chosen key-face crop (faces/{external_id}.jpg); higher = better
    key_score: Mapped[Optional[float]] = mapped_column(Float)


class PhotoFaceLink(Base):
    __tablename__ = "photo_face_link"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    photo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("file_metadata.id"))
    face_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("face_data.external_id")
    )
    album_id: Mapped[Optional[int]] = mapped_column(ForeignKey("album.id"))


class FaceEmbedding(Base):
    __tablename__ = "face_embedding"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    photo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("file_metadata.id", ondelete="CASCADE")
    )
    album_id: Mapped[Optional[int]] = mapped_column(ForeignKey("album.id"))
    # cluster assignment — set once an embedding is grouped into a person
    face_id: Mapped[Optional[str]] = mapped_column(ForeignKey("face_data.external_id"))
    embedding: Mapped[Optional[Any]] = mapped_column(Vector(512))
    det_score: Mapped[Optional[float]] = mapped_column(Float)
    bbox: Mapped[Optional[Any]] = mapped_column(JSON)
    pose: Mapped[Optional[Any]] = mapped_column(JSON)
    created_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    title: Mapped[Optional[str]] = mapped_column(String(255))
    s3_key: Mapped[Optional[str]] = mapped_column(String(255))
    content_type: Mapped[Optional[str]] = mapped_column(String(50))
    size: Mapped[Optional[int]] = mapped_column(BigInteger)
    upload_date: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )

    revisions: Mapped[list["VideoRevision"]] = relationship(back_populates="video")


class VideoRevision(Base):
    __tablename__ = "video_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[Optional[int]] = mapped_column(ForeignKey("videos.id"))
    s3_key: Mapped[Optional[str]] = mapped_column(String(255))
    version: Mapped[Optional[int]] = mapped_column(Integer)
    upload_date: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )
    permanent_storage: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )

    video: Mapped[Optional["Video"]] = relationship(back_populates="revisions")
