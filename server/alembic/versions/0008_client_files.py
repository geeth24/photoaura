"""client deliverable files (drive)

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-27

Adds a client_files table — downloadable deliverables (e.g. a zip of
originals) a photographer attaches to a client, optionally tied to an album.
The raw file lives in S3; the row holds the key + metadata.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("album.id"), nullable=True),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("s3_key", sa.String(1024), nullable=False),
        sa.Column("size", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_client_files_user_id", "client_files", ["user_id"])
    op.create_index("ix_client_files_album_id", "client_files", ["album_id"])


def downgrade() -> None:
    op.drop_index("ix_client_files_album_id", table_name="client_files")
    op.drop_index("ix_client_files_user_id", table_name="client_files")
    op.drop_table("client_files")
