"""published flag on album reels

Revision ID: 0027
Revises: 0026
Create Date: 2026-11-21

Clients only see a reel once the studio publishes it, separately from
publishing the album's highlights.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "album_reels",
        sa.Column("published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("album_reels", "published")
