"""drop events and event_types tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-24

Removes the events/event_types tables from the dropped events feature.
Uses IF EXISTS so it is safe on databases that never had them.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS events CASCADE")
    op.execute("DROP TABLE IF EXISTS event_types CASCADE")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS event_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            priority INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            event_type_id INT REFERENCES event_types(id),
            event_date TIMESTAMP NOT NULL,
            location VARCHAR(255),
            description TEXT,
            created_by INT REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
