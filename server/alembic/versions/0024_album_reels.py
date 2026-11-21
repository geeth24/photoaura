"""album reels

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-21

Rendered highlight reels (music-video MP4s) per album. The file lives at
s3_key; the poster frame sits next to it at s3_key + ".poster.jpg".
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "album_reels",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "album_id",
            sa.Integer(),
            sa.ForeignKey("album.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("aspect", sa.String(8), nullable=False),
        sa.Column("s3_key", sa.String(255), nullable=False),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column(
            "created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Column("status", sa.String(16), server_default="rendering", nullable=False),
    )
    op.create_index("ix_album_reels_album_id", "album_reels", ["album_id"])


def downgrade() -> None:
    op.drop_index("ix_album_reels_album_id", table_name="album_reels")
    op.drop_table("album_reels")
