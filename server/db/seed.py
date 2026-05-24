"""Idempotent data seeding run at deploy time (after migrations)."""
import bcrypt

from config import settings
from db.base import session_scope
from db.models import User


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed_root_user() -> None:
    with session_scope() as session:
        existing = (
            session.query(User).filter_by(user_name=settings.ROOT_USER).first()
        )
        if existing:
            return
        session.add(
            User(
                user_name=settings.ROOT_USER,
                user_password=_hash_password(settings.ROOT_PASSWORD),
                full_name=settings.ROOT_FULL_NAME,
                user_email=settings.ROOT_EMAIL,
            )
        )
        print(f"🌱 Seeded root user '{settings.ROOT_USER}'")


if __name__ == "__main__":
    seed_root_user()
