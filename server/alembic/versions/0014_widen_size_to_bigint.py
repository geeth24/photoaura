"""widen file size columns to BigInteger

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-20

A Postgres INTEGER caps at ~2.1GB, so a video (or deliverable zip) larger than
that overflowed file_metadata.size / client_files.size on insert
(NumericValueOutOfRange). Widen both to BIGINT.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("file_metadata", "size", type_=sa.BigInteger())
    op.alter_column("client_files", "size", type_=sa.BigInteger())


def downgrade() -> None:
    op.alter_column("file_metadata", "size", type_=sa.Integer())
    op.alter_column("client_files", "size", type_=sa.Integer())
