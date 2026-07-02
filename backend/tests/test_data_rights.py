"""Data export and account deletion tests for issue #74."""

from app.core.auth import create_access_token, get_password_hash
from app.models.database import Friendship, GlobalCourse, SavedSchedule, User


def _current_user(db_session) -> User:
    return db_session.query(User).filter(User.email == "smoke-user@isik.edu.tr").one()


def test_export_requires_authentication(client):
    response = client.get("/api/auth/me/export")
    assert response.status_code == 401


def test_export_includes_owned_data_and_excludes_anonymous_schedules(client, db_session, auth_headers):
    user = _current_user(db_session)
    friend = User(email="friend@isik.edu.tr", password_hash=get_password_hash("friend-pass"), role="user")
    db_session.add(friend)
    db_session.flush()
    db_session.add_all(
        [
            SavedSchedule(
                user_id=user.id,
                name="Owned schedule",
                courses_json='[{"code":"SOFT101"}]',
                share_id="owned-share",
            ),
            SavedSchedule(
                user_id=None,
                name="Anonymous share",
                courses_json='[{"code":"ANON"}]',
                share_id="anon-share",
            ),
            Friendship(user_id=user.id, friend_id=friend.id, status="accepted"),
            GlobalCourse(
                semester="2026-Fall",
                courses_json='[{"code":"GLOBAL"}]',
                uploaded_by=user.id,
                is_active=True,
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/auth/me/export", headers=auth_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schema_version"] == "2026-07-02"
    assert body["user"]["email"] == "smoke-user@isik.edu.tr"
    assert "password_hash" not in body["user"]
    assert [schedule["name"] for schedule in body["saved_schedules"]] == ["Owned schedule"]
    assert body["saved_schedules"][0]["courses"] == [{"code": "SOFT101"}]
    assert len(body["friendships"]) == 1
    assert body["friendships"][0]["counterparty_email"] == "friend@isik.edu.tr"
    assert body["uploaded_global_courses"] == [
        {
            "id": 1,
            "semester": "2026-Fall",
            "uploaded_at": body["uploaded_global_courses"][0]["uploaded_at"],
            "is_active": True,
        }
    ]


def test_delete_requires_authentication(client):
    response = client.delete("/api/auth/me")
    assert response.status_code == 401


def test_delete_removes_owned_data_and_preserves_anonymous_and_global_course(
    client,
    db_session,
    auth_headers,
):
    user = _current_user(db_session)
    friend = User(email="delete-friend@isik.edu.tr", password_hash=get_password_hash("friend-pass"), role="user")
    db_session.add(friend)
    db_session.flush()
    owned_schedule = SavedSchedule(user_id=user.id, name="Owned schedule", courses_json="[]", share_id="owned-delete")
    anonymous_schedule = SavedSchedule(user_id=None, name="Anonymous share", courses_json="[]", share_id="anon-delete")
    friendship = Friendship(user_id=friend.id, friend_id=user.id, status="pending")
    global_course = GlobalCourse(semester="2026-Spring", courses_json="[]", uploaded_by=user.id, is_active=False)
    db_session.add_all([owned_schedule, anonymous_schedule, friendship, global_course])
    db_session.commit()
    user_id = user.id
    friendship_id = friendship.id
    global_course_id = global_course.id

    response = client.delete("/api/auth/me", headers=auth_headers)

    assert response.status_code == 200, response.text
    assert response.json() == {"message": "Account deleted successfully"}
    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(SavedSchedule).filter(SavedSchedule.share_id == "owned-delete").first() is None
    assert db_session.query(SavedSchedule).filter(SavedSchedule.share_id == "anon-delete").one().user_id is None
    assert db_session.query(Friendship).filter(Friendship.id == friendship_id).first() is None
    assert db_session.query(GlobalCourse).filter(GlobalCourse.id == global_course_id).one().uploaded_by is None
    assert client.get("/api/auth/me", headers=auth_headers).status_code == 401


def test_admin_self_delete_is_blocked(client, db_session):
    admin = User(
        email="admin-delete@isik.edu.tr",
        password_hash=get_password_hash("admin-pass"),
        role="admin",
    )
    db_session.add(admin)
    db_session.commit()
    token = create_access_token({"sub": admin.email})

    response = client.delete("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403
    assert db_session.query(User).filter(User.email == "admin-delete@isik.edu.tr").one()
