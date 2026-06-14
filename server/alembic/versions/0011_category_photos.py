"""curated category photos

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-14

A website category becomes an ordered set of individual photo references
(file_metadata) instead of one whole album — so it can mix photos pulled
from any client album with standalone website uploads, no duplication.

Seeds every photo currently in each category's linked album as a reference,
so the live site keeps showing exactly what it shows today.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "category_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "photo_id",
            sa.Integer(),
            sa.ForeignKey("file_metadata.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
    )
    op.create_index(
        "ix_category_photos_category", "category_photos", ["category_id"]
    )
    op.create_unique_constraint(
        "uq_category_photo", "category_photos", ["category_id", "photo_id"]
    )

    # seed from the existing one-album-per-category links so the public site
    # is unchanged on day one (ordered by capture-ish: file_metadata.id)
    op.execute(
        """
        INSERT INTO category_photos (category_id, photo_id, sort_order)
        SELECT ac.category_id, fm.id,
               ROW_NUMBER() OVER (PARTITION BY ac.category_id ORDER BY fm.id) - 1
        FROM album_categories ac
        JOIN file_metadata fm ON fm.album_id = ac.album_id
        """
    )


def downgrade() -> None:
    op.drop_table("category_photos")
