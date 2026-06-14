"""mark website-management albums

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-14

Flags the albums that exist only to back the public website (the
category-linked albums + the shared 'website' uploads album) so they're
hidden from the client Albums + All Photos views and managed under /website.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "album",
        sa.Column("is_website", sa.Boolean(), server_default="false", nullable=True),
    )
    # backfill: category-linked albums + the standalone 'website' uploads album
    op.execute(
        """
        UPDATE album SET is_website = true
        WHERE id IN (SELECT album_id FROM album_categories)
           OR slug = 'website'
        """
    )


def downgrade() -> None:
    op.drop_column("album", "is_website")
