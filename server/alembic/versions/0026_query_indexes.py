"""indexes for the lookups every screen runs

Revision ID: 0026
Revises: 0025
Create Date: 2026-11-21

file_metadata had no index on album_id and photo_face_link none beyond its
primary key, so each per-album photo query and each person's photo links was a
full table scan. Also covers the permission and user lookups on every request.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (index name, table, columns)
INDEXES = [
    ("ix_file_metadata_album_id_id", "file_metadata", ["album_id", "id"]),
    ("ix_photo_face_link_album_id", "photo_face_link", ["album_id"]),
    ("ix_photo_face_link_face_id", "photo_face_link", ["face_id"]),
    ("ix_photo_face_link_photo_id", "photo_face_link", ["photo_id"]),
    ("ix_user_album_permissions_user_album", "user_album_permissions", ["user_id", "album_id"]),
    ("ix_user_album_permissions_album_id", "user_album_permissions", ["album_id"]),
    ("ix_users_user_name", "users", ["user_name"]),
    ("ix_album_slug", "album", ["slug"]),
]


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.create_index(name, table, cols, if_not_exists=True)


def downgrade() -> None:
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table, if_exists=True)
