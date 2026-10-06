"""bookings, contracts and proof-mode galleries

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-06

Bookings carry the signed contract snapshot and the retainer / event-day /
final payments. A booking's album can be proof-locked: clients see
watermarked proofs and downloads stay closed until the final payment.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("album", sa.Column("proof_locked", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("album", sa.Column("hold_token", sa.String(64), nullable=True))
    op.add_column("file_metadata", sa.Column("original_filename", sa.String(255), nullable=True))
    op.add_column("file_metadata", sa.Column("held", sa.Boolean(), server_default="false", nullable=False))

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("client_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_phone", sa.String(50), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=True),
        sa.Column("event_date", sa.Date(), nullable=True),
        sa.Column("start_time", sa.String(5), nullable=True),
        sa.Column("end_time", sa.String(5), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("package_key", sa.String(50), nullable=False),
        sa.Column("package_name", sa.String(255), nullable=True),
        sa.Column("hours", sa.Float(), nullable=True),
        sa.Column("includes_video", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("revisions", sa.Integer(), nullable=True),
        sa.Column("hourly_rate_cents", sa.Integer(), nullable=True),
        sa.Column("total_fee_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("fee_overridden", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("details_for_client", sa.Text(), nullable=True),
        sa.Column("notes_internal", sa.Text(), nullable=True),
        sa.Column("contract_version", sa.String(20), nullable=True),
        sa.Column("contract_markdown", sa.Text(), nullable=True),
        sa.Column("contract_hash", sa.String(64), nullable=True),
        sa.Column("contract_rendered_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("sent_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("signed_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("signed_name", sa.String(255), nullable=True),
        sa.Column("signed_ip", sa.String(64), nullable=True),
        sa.Column("signed_user_agent", sa.Text(), nullable=True),
        sa.Column("signed_consent", sa.Text(), nullable=True),
        sa.Column("signed_version", sa.String(20), nullable=True),
        sa.Column("signed_hash", sa.String(64), nullable=True),
        sa.Column("pdf_key", sa.String(512), nullable=True),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("album.id", ondelete="SET NULL"), nullable=True),
        sa.Column("delivered_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("unlocked_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("cancelled_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=True),
    )
    op.create_index("ix_bookings_number", "bookings", ["number"], unique=True)
    op.create_index("ix_bookings_status", "bookings", ["status"])
    op.create_index("ix_bookings_client_user_id", "bookings", ["client_user_id"])
    op.create_index("ix_bookings_album_id", "bookings", ["album_id"])

    op.create_table(
        "booking_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("percent", sa.Integer(), nullable=True),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("received_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("received_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("method", sa.String(20), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_booking_payments_booking_id", "booking_payments", ["booking_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_payments_booking_id", table_name="booking_payments")
    op.drop_table("booking_payments")
    op.drop_index("ix_bookings_album_id", table_name="bookings")
    op.drop_index("ix_bookings_client_user_id", table_name="bookings")
    op.drop_index("ix_bookings_status", table_name="bookings")
    op.drop_index("ix_bookings_number", table_name="bookings")
    op.drop_table("bookings")
    op.drop_column("file_metadata", "held")
    op.drop_column("file_metadata", "original_filename")
    op.drop_column("album", "hold_token")
    op.drop_column("album", "proof_locked")
