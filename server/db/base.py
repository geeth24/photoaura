from contextlib import contextmanager

from starlette.requests import HTTPConnection
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=5,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# a preview request is read-only below the handlers too: the transaction itself
# is READ ONLY, and an explicit commit raises instead of quietly writing
@event.listens_for(SessionLocal, "after_begin")
def _read_only_transaction(session, transaction, connection):
    request = session.info.get("request")
    if request is not None and getattr(request.state, "read_only", False):
        connection.execute(text("SET TRANSACTION READ ONLY"))


@event.listens_for(SessionLocal, "before_commit")
def _no_commit_when_read_only(session):
    request = session.info.get("request")
    if request is not None and getattr(request.state, "read_only", False):
        raise RuntimeError("read-only request tried to commit")


def get_session(request: HTTPConnection):
    """FastAPI dependency: yields a session, commits on success, rolls back on error.
    A read-only request (a preview token) never commits, even from a GET handler."""
    session = SessionLocal()
    session.info["request"] = request
    try:
        yield session
        if getattr(request.state, "read_only", False):
            session.rollback()
        else:
            session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def session_scope():
    """Context manager for session use outside of request handlers."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
