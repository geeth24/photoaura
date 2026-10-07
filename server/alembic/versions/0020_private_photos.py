"""a booking can keep its photos private

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-07

When set, the agreement says the studio only uses or shares the event's
photos with the client's prior written permission, instead of the default
portfolio use with an opt-out.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("private_photos", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("bookings", "private_photos")
