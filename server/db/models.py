from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
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

from db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_name: Mapped[Optional[str]] = mapped_column(String(255))
    user_password: Mapped[Optional[str]] = mapped_column(String(255))
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    user_email: Mapped[Optional[str]] = mapped_column(String(255))


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


class FaceData(Base):
    __tablename__ = "face_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    external_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)


class PhotoFaceLink(Base):
    __tablename__ = "photo_face_link"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    photo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("file_metadata.id"))
    face_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("face_data.external_id")
    )
    album_id: Mapped[Optional[int]] = mapped_column(ForeignKey("album.id"))


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


class EventType(Base):
    __tablename__ = "event_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    priority: Mapped[Optional[int]] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type_id: Mapped[Optional[int]] = mapped_column(ForeignKey("event_types.id"))
    event_date: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=text("CURRENT_TIMESTAMP")
    )

    event_type: Mapped[Optional["EventType"]] = relationship()
    creator: Mapped[Optional["User"]] = relationship()
