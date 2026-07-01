"""Database session lifecycle tests."""

import pytest

from app.models import database


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
