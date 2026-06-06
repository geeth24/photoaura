"""face embeddings (pgvector)

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-06

Adds the pgvector extension + a face_embedding table holding one 512-d
ArcFace vector per detected face. Clustering reads these to group faces
into people (face_data); face_id is the assigned cluster, null until grouped.
HNSW cosine index makes nearest-neighbour search fast.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "face_embedding",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "photo_id",
            sa.Integer(),
            sa.ForeignKey("file_metadata.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("album.id"), nullable=True),
        sa.Column(
            "face_id",
            sa.String(255),
            sa.ForeignKey("face_data.external_id"),
            nullable=True,
        ),
        sa.Column("embedding", Vector(512), nullable=True),
        sa.Column("det_score", sa.Float(), nullable=True),
        sa.Column("bbox", sa.JSON(), nullable=True),
        sa.Column("pose", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_face_embedding_photo_id", "face_embedding", ["photo_id"])
    op.create_index("ix_face_embedding_album_id", "face_embedding", ["album_id"])
    op.create_index("ix_face_embedding_face_id", "face_embedding", ["face_id"])
    op.execute(
        "CREATE INDEX ix_face_embedding_hnsw ON face_embedding "
        "USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.drop_index("ix_face_embedding_hnsw", table_name="face_embedding")
    op.drop_index("ix_face_embedding_face_id", table_name="face_embedding")
    op.drop_index("ix_face_embedding_album_id", table_name="face_embedding")
    op.drop_index("ix_face_embedding_photo_id", table_name="face_embedding")
    op.drop_table("face_embedding")
