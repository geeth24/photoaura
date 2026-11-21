"""versioned face chips and sticky merges

Revision ID: 0021
Revises: 0020
Create Date: 2026-11-21

face_data remembers which embedding its chip was cropped from and the S3 key
it lives at, so a recluster can tell when the chip is out of date and serve
the new one at a new URL. face_embedding.manual_group ties together faces an
admin merged, so reclustering keeps them as one person.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "face_data",
        sa.Column(
            "key_embedding_id",
            sa.Integer(),
            sa.ForeignKey("face_embedding.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("face_data", sa.Column("chip_key", sa.String(255), nullable=True))
    op.add_column("face_embedding", sa.Column("manual_group", sa.String(32), nullable=True))
    op.create_index("ix_face_embedding_manual_group", "face_embedding", ["manual_group"])


def downgrade() -> None:
    op.drop_index("ix_face_embedding_manual_group", table_name="face_embedding")
    op.drop_column("face_embedding", "manual_group")
    op.drop_column("face_data", "chip_key")
    op.drop_column("face_data", "key_embedding_id")
