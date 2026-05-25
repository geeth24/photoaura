"""roles + magic links

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-25

Adds a role to users (admin/client) and a magic_links table for passwordless
login + client invites. Existing users are promoted to admin so no one is
locked out of the dashboard.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(20), nullable=False, server_default="client"),
    )
    # everyone who already had an account was using the admin dashboard
    op.execute("UPDATE users SET role = 'admin'")

    op.create_table(
        "magic_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token", sa.String(128), nullable=False, unique=True),
        sa.Column("purpose", sa.String(20), nullable=False, server_default="login"),
        sa.Column("expires_at", sa.TIMESTAMP(), nullable=False),
        sa.Column("used_at", sa.TIMESTAMP(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_magic_links_token", "magic_links", ["token"])


def downgrade() -> None:
    op.drop_index("ix_magic_links_token", table_name="magic_links")
    op.drop_table("magic_links")
    op.drop_column("users", "role")
