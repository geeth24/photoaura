"""family members

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-12

A client can have family on their account — extra people who sign in with
their own email and see every album the primary was granted.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "parent_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_parent_user_id", "users", ["parent_user_id"])


def downgrade() -> None:
    op.drop_index("ix_users_parent_user_id", table_name="users")
    op.drop_column("users", "parent_user_id")
