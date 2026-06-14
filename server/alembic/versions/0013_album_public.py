"""album public visibility flag

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-14

Adds album.public. A private album (default) can only be viewed through the
share link that carries its secret; a public album is openable by anyone.
Drives the /api/album/{slug}/view share endpoint.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "album",
        sa.Column("public", sa.Boolean(), server_default="false", nullable=True),
    )
    # the website-management albums are already public-facing
    op.execute("UPDATE album SET public = true WHERE is_website = true")


def downgrade() -> None:
    op.drop_column("album", "public")
