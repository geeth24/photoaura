from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from db.models import Album, FileMetadata
from routers.admin.ops_router import top_albums


# file_metadata.tags is a Postgres array; sqlite only needs somewhere to put it
@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


def _session():
    engine = create_engine("sqlite://")
    Album.metadata.create_all(engine, tables=[Album.__table__, FileMetadata.__table__])
    return Session(engine)


def test_biggest_albums_first_with_photo_and_video_counts():
    s = _session()
    wedding = Album(name="Wedding", slug="wedding")
    portrait = Album(name="Portrait", slug="portrait")
    empty = Album(name="Empty", slug="empty")
    s.add_all([wedding, portrait, empty])
    s.flush()
    s.add_all(
        [
            FileMetadata(
                album_id=portrait.id,
                filename="a.jpg",
                content_type="image/jpeg",
                size=300,
            ),
            FileMetadata(
                album_id=wedding.id,
                filename="b.jpg",
                content_type="image/jpeg",
                size=200,
            ),
            FileMetadata(
                album_id=wedding.id,
                filename="c.mp4",
                content_type="video/mp4",
                size=900,
            ),
            FileMetadata(
                album_id=wedding.id,
                filename="d.jpg",
                content_type="image/jpeg",
                size=None,
            ),
        ]
    )
    s.flush()

    rows = top_albums(s)

    assert [r["slug"] for r in rows] == ["wedding", "portrait"]
    assert rows[0] == {
        "slug": "wedding",
        "name": "Wedding",
        "bytes": 1100,
        "photos": 2,
        "videos": 1,
    }
    assert rows[1]["photos"] == 1 and rows[1]["videos"] == 0


def test_limit():
    s = _session()
    for i in range(4):
        a = Album(name=f"A{i}", slug=f"a{i}")
        s.add(a)
        s.flush()
        s.add(
            FileMetadata(
                album_id=a.id, filename="x.jpg", content_type="image/jpeg", size=i + 1
            )
        )
    s.flush()

    assert [r["slug"] for r in top_albums(s, limit=2)] == ["a3", "a2"]
