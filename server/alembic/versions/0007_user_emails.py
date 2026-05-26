"""multiple emails per user

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-25

Adds a user_emails table (one user, many addresses) and an optional
user_email_id on magic_links so the verify-email flow can mark which row
got verified. Each user's existing user_email is backfilled as the primary,
already-verified entry.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_emails",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("verified_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_user_emails_email", "user_emails", ["email"])
    op.create_index("ix_user_emails_user_id", "user_emails", ["user_id"])

    # backfill: each existing user's user_email becomes their primary, verified
    op.execute(
        """
        INSERT INTO user_emails (user_id, email, verified_at, is_primary)
        SELECT id, LOWER(user_email), CURRENT_TIMESTAMP, true
          FROM users
         WHERE user_email IS NOT NULL AND user_email <> ''
        """
    )

    # which user_emails row a verify-email link targets (NULL for login links)
    op.add_column(
        "magic_links",
        sa.Column(
            "user_email_id",
            sa.Integer(),
            sa.ForeignKey("user_emails.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("magic_links", "user_email_id")
    op.drop_index("ix_user_emails_user_id", table_name="user_emails")
    op.drop_index("ix_user_emails_email", table_name="user_emails")
    op.drop_table("user_emails")
