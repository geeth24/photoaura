"""album moments

Revision ID: 0025
Revises: 0024
Create Date: 2026-11-21

Moments split an album into the stretches of the shoot (cake cutting, dancing).
photo_scores.moment_key says which one a photo is in; album_moments holds each
one's name and order. Times, counts and covers are read off the photos.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photo_scores", sa.Column("moment_key", sa.String(12)))
    op.create_table(
        "album_moments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("album.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(12), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(80), nullable=False),
        sa.Column("label_custom", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.UniqueConstraint("album_id", "key"),
    )
    op.create_index("ix_album_moments_album_id", "album_moments", ["album_id"])


def downgrade() -> None:
    op.drop_index("ix_album_moments_album_id", table_name="album_moments")
    op.drop_table("album_moments")
    op.drop_column("photo_scores", "moment_key")
