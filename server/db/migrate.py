"""Migration runner used at deploy time.

Handles three cases safely:
  - fresh database          -> `upgrade head` creates everything
  - pre-Alembic database    -> stamp the baseline (schema already exists), then upgrade
  - already-managed database-> just `upgrade head`
"""
import os

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from db.base import engine

BASELINE_REVISION = "0001"


def _alembic_config() -> Config:
    server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(server_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(server_dir, "alembic"))
    return cfg


def run_migrations() -> None:
    cfg = _alembic_config()
    tables = set(inspect(engine).get_table_names())

    if "alembic_version" not in tables and "users" in tables:
        # schema predates Alembic: record it as the baseline without re-creating
        print("🔖 Existing schema detected, stamping baseline", BASELINE_REVISION)
        command.stamp(cfg, BASELINE_REVISION)

    print("⬆️  Applying migrations to head...")
    command.upgrade(cfg, "head")
    print("✅ Database migrations applied")


if __name__ == "__main__":
    run_migrations()
