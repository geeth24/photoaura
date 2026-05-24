"""drop legacy booking tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-23

Drops the bookings/pricing/service_types tables left over from the removed
booking feature. Uses IF EXISTS so it is safe on databases that never had them.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS bookings CASCADE")
    op.execute("DROP TABLE IF EXISTS pricing CASCADE")
    op.execute("DROP TABLE IF EXISTS service_types CASCADE")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS service_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pricing (
            id SERIAL PRIMARY KEY,
            session_type VARCHAR(255),
            price NUMERIC(10, 2),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            client_name VARCHAR(255),
            client_email VARCHAR(255),
            client_phone VARCHAR(50),
            preferred_date TIMESTAMP,
            additional_notes TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            google_calendar_event_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            service_type_id INT REFERENCES service_types(id)
        )
        """
    )
