"""watermarked proof of each earlier photo version

Revision ID: 0028
Revises: 0027
Create Date: 2026-11-22

A locked album keeps a proof of every earlier edit, so clients can compare
versions without seeing a clean original before the final payment.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photo_versions", sa.Column("proof_filename", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("photo_versions", "proof_filename")
