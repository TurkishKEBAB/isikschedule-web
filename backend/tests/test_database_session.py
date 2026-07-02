"""Database session lifecycle tests."""

import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import database
from app.models.database import Base, Friendship, GlobalCourse, SavedSchedule, User


class RecordingSession:
    def __init__(self):
        self.events = []

    def rollback(self):
        self.events.append("rollback")

    def close(self):
        self.events.append("close")


def test_get_db_rolls_back_and_closes_session_on_exception(monkeypatch):
    session = RecordingSession()
    monkeypatch.setattr(database, "SessionLocal", lambda: session)

    dependency = database.get_db()
    assert next(dependency) is session

    with pytest.raises(RuntimeError, match="boom"):
        dependency.throw(RuntimeError("boom"))

    assert session.events == ["rollback", "close"]


def test_sqlite_connections_enable_foreign_key_enforcement():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    try:
        with engine.connect() as conn:
            assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
    finally:
        engine.dispose()


def test_deleting_user_cascades_owned_rows_without_orphans():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()

    try:
        owner = User(email="owner@isik.edu.tr", password_hash="hash")
        friend = User(email="friend@isik.edu.tr", password_hash="hash")
        session.add_all([owner, friend])
        session.flush()
        session.add_all(
            [
                SavedSchedule(user_id=owner.id, name="Owned", courses_json="[]"),
                SavedSchedule(user_id=None, name="Anonymous", courses_json="[]"),
                Friendship(user_id=owner.id, friend_id=friend.id, status="accepted"),
                GlobalCourse(semester="2026-Fall", courses_json="[]", uploaded_by=owner.id),
            ]
        )
        session.commit()

        session.delete(owner)
        session.commit()

        assert session.query(SavedSchedule).filter(SavedSchedule.user_id == owner.id).count() == 0
        assert session.query(SavedSchedule).filter(SavedSchedule.user_id.is_(None)).count() == 1
        assert session.query(Friendship).count() == 0
        global_course = session.query(GlobalCourse).one()
        assert global_course.uploaded_by is None
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
