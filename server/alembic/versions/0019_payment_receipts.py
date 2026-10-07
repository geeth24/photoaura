"""each partial payment kept as its own receipt

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-06

A payment line can be paid in parts (say $50 Zelle, then $25 cash). The
line keeps the running total; receipts keeps each part for the invoice.
Older rows have no receipts and read as one receipt from the line itself.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("booking_payments", sa.Column("receipts", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("booking_payments", "receipts")
