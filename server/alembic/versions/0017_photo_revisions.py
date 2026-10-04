"""photo revisions + app versions

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-04

Photographers can push re-edited photos to a delivered album as a numbered
revision. Each photo keeps its file history. Also adds the per-platform update
policy the mobile apps check on launch.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("file_metadata", sa.Column("version", sa.Integer(), server_default="1", nullable=False))
    op.add_column("file_metadata", sa.Column("base_name", sa.String(255), nullable=True))
    op.add_column("file_metadata", sa.Column("revision_number", sa.Integer(), nullable=True))
    op.create_index("ix_file_metadata_base_name", "file_metadata", ["base_name"])
    # stem without extension or a trailing _v2 / -v2 / " v2", lowercased
    op.execute(
        r"""
        UPDATE file_metadata SET base_name = lower(regexp_replace(
            regexp_replace(filename, '\.[^.]*$', ''), '[ _-]v\d+$', '', 'i'))
        WHERE filename IS NOT NULL
        """
    )

    op.create_table(
        "album_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("album.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("photo_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("notified_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("ix_album_revisions_album_id", "album_revisions", ["album_id"])

    op.create_table(
        "photo_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("photo_id", sa.Integer(), sa.ForeignKey("file_metadata.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("revision_number", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("ix_photo_versions_photo_id", "photo_versions", ["photo_id"])

    app_versions = op.create_table(
        "app_versions",
        sa.Column("platform", sa.String(20), primary_key=True),
        sa.Column("min_version", sa.String(20), nullable=True),
        sa.Column("latest_version", sa.String(20), nullable=True),
        sa.Column("store_url", sa.String(512), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.bulk_insert(
        app_versions,
        [
            {"platform": "ios", "latest_version": "2.3",
             "store_url": "https://apps.apple.com/app/id6477320360"},
            {"platform": "android", "latest_version": "2.3",
             "store_url": "https://play.google.com/store/apps/details?id=com.radsoftinc.photoaura"},
        ],
    )


def downgrade() -> None:
    op.drop_table("app_versions")
    op.drop_index("ix_photo_versions_photo_id", table_name="photo_versions")
    op.drop_table("photo_versions")
    op.drop_index("ix_album_revisions_album_id", table_name="album_revisions")
    op.drop_table("album_revisions")
    op.drop_index("ix_file_metadata_base_name", table_name="file_metadata")
    op.drop_column("file_metadata", "revision_number")
    op.drop_column("file_metadata", "base_name")
    op.drop_column("file_metadata", "version")
