"""smart gallery scores

Revision ID: 0023
Revises: 0022
Create Date: 2026-11-21

photo_scores holds the CLIP embedding, aesthetic and technical scores and what
the selection pass decided per photo (stack, highlight, review reason), plus the
studio's manual overrides. The album gets its state and publish flags.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "photo_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "photo_id",
            sa.Integer(),
            sa.ForeignKey("file_metadata.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("album.id", ondelete="CASCADE")),
        sa.Column("aesthetic", sa.Float()),
        sa.Column("sharpness", sa.Float()),
        sa.Column("clipped_highlights", sa.Float()),
        sa.Column("clipped_shadows", sa.Float()),
        sa.Column("exposure_mean", sa.Float()),
        sa.Column("clip", Vector(768)),
        sa.Column("technical", sa.Float()),
        sa.Column("people", sa.Float()),
        sa.Column("main_faces", sa.Integer(), server_default="0", nullable=False),
        sa.Column("combined", sa.Float()),
        sa.Column("stack_id", sa.Integer()),
        sa.Column("is_stack_best", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("in_highlights", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("review_reason", sa.String(16)),
        sa.Column("manual_highlight", sa.String(8)),
        sa.Column("review_override", sa.String(8)),
        sa.Column("best_pinned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_index("ix_photo_scores_album_id", "photo_scores", ["album_id"])
    op.create_index("ix_photo_scores_stack_id", "photo_scores", ["stack_id"])
    op.add_column("album", sa.Column("smart_state", sa.String(12)))
    op.add_column(
        "album",
        sa.Column("smart_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "album",
        sa.Column("smart_touched", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("album", "smart_touched")
    op.drop_column("album", "smart_published")
    op.drop_column("album", "smart_state")
    op.drop_index("ix_photo_scores_stack_id", table_name="photo_scores")
    op.drop_index("ix_photo_scores_album_id", table_name="photo_scores")
    op.drop_table("photo_scores")
