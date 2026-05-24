"""backfill photo orientation (accounting for EXIF rotation)

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-23

One-time data migration that replaces the orientation backfill that used to run
on every app startup. Fixes EXIF-rotated photos (orientation 5-8 swap width/height)
and fills orientation for any rows still missing it.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # fix EXIF-rotated photos (orientation 5-8 means 90 deg rotation, swap dimensions)
    op.execute(
        """
        UPDATE file_metadata
        SET width = height, height = width,
            orientation = CASE
                WHEN width > height THEN 'portrait'
                WHEN height > width THEN 'landscape'
                ELSE 'square' END
        WHERE (exif_data::text LIKE '%"Orientation": 5%'
            OR exif_data::text LIKE '%"Orientation": 6%'
            OR exif_data::text LIKE '%"Orientation": 7%'
            OR exif_data::text LIKE '%"Orientation": 8%')
        AND width > height
        """
    )
    # backfill any remaining photos missing orientation
    op.execute(
        """
        UPDATE file_metadata
        SET orientation = CASE
            WHEN height > width THEN 'portrait'
            WHEN width > height THEN 'landscape'
            ELSE 'square' END
        WHERE orientation IS NULL AND width IS NOT NULL AND height IS NOT NULL
        """
    )


def downgrade() -> None:
    # data backfill is not reversible
    pass
