"""add face_data.key_score

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-25

Tracks the quality of the chosen key-face crop so detection keeps the best
(largest/most-frontal/sharpest) shot of each person instead of last-write-wins.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("face_data", sa.Column("key_score", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("face_data", "key_score")
