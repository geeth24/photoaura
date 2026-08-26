"""client photo favorites

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-25

Lets a client star photos in their gallery so the photographer knows which
ones to retouch, print, or put in an album.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "photo_favorites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "photo_id",
            sa.Integer(),
            sa.ForeignKey("file_metadata.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "album_id",
            sa.Integer(),
            sa.ForeignKey("album.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("user_id", "photo_id", name="uq_photo_favorite"),
    )
    op.create_index(
        "ix_photo_favorites_album_user", "photo_favorites", ["album_id", "user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_photo_favorites_album_user", table_name="photo_favorites")
    op.drop_table("photo_favorites")
