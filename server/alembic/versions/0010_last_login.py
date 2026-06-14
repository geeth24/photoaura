"""user last_login_at

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-14

Tracks the last time each user signed in (any method). NULL = never logged
in, which the admin uses to nudge clients who haven't opened their gallery.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.TIMESTAMP(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
