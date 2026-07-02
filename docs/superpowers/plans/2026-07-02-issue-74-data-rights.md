# Issue 74 Data Rights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated account data export and account deletion for issue #74.

**Architecture:** Keep the backend change inside the existing `/api/auth` router and rely on the foreign-key cascade migration from issue #17. Add a protected `/account` page that calls the new endpoints with the existing auth token and clears local auth state after deletion.

**Tech Stack:** FastAPI + SQLAlchemy + SQLite/Alembic, pytest, Next.js 14 App Router + React 18 + TypeScript + TailwindCSS.

## Global Constraints

- Backend response shapes for existing `/api/auth/register`, `/api/auth/login`, and `/api/auth/me` stay unchanged.
- Export never includes `password_hash`.
- Anonymous saved schedules (`saved_schedules.user_id IS NULL`) are retained and excluded from a user's export.
- Account deletion is real deletion for non-admin users; admin self-delete returns `403`.
- Issue #17 ownership behavior is authoritative: saved schedules and friendships cascade, global course ownership is set to `NULL`.
- Backend logs export/delete events with user id only; logs do not include exported payloads, passwords, schedule JSON, tokens, or friend details.
- Frontend validates with `npm run lint` and `npm run build`; backend validates with pytest and ruff.

---

### Task 1: Backend data-rights tests

**Files:**
- Create: `backend/tests/test_data_rights.py`

**Interfaces:**
- Consumes: `client`, `db_session`, `auth_headers` fixtures; ORM models `User`, `SavedSchedule`, `Friendship`, `GlobalCourse`; auth helpers `create_access_token`, `get_password_hash`.
- Produces: failing tests for `GET /api/auth/me/export` and `DELETE /api/auth/me`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_data_rights.py`:

```python
"""Data export and account deletion tests for issue #74."""

from app.core.auth import create_access_token, get_password_hash
from app.models.database import Friendship, GlobalCourse, SavedSchedule, User


def _current_user(db_session) -> User:
    return db_session.query(User).filter(User.email == "smoke-user@isik.edu.tr").one()


def test_export_requires_authentication(client):
    response = client.get("/api/auth/me/export")
    assert response.status_code == 403


def test_export_includes_owned_data_and_excludes_anonymous_schedules(client, db_session, auth_headers):
    user = _current_user(db_session)
    friend = User(email="friend@isik.edu.tr", password_hash=get_password_hash("friend-pass"), role="user")
    db_session.add(friend)
    db_session.flush()
    db_session.add_all(
        [
            SavedSchedule(user_id=user.id, name="Owned schedule", courses_json='[{"code":"SOFT101"}]', share_id="owned-share"),
            SavedSchedule(user_id=None, name="Anonymous share", courses_json='[{"code":"ANON"}]', share_id="anon-share"),
            Friendship(user_id=user.id, friend_id=friend.id, status="accepted"),
            GlobalCourse(semester="2026-Fall", courses_json='[{"code":"GLOBAL"}]', uploaded_by=user.id, is_active=True),
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
    assert response.status_code == 403


def test_delete_removes_owned_data_and_preserves_anonymous_and_global_course(client, db_session, auth_headers):
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

    response = client.delete("/api/auth/me", headers=auth_headers)

    assert response.status_code == 200, response.text
    assert response.json() == {"message": "Account deleted successfully"}
    assert db_session.query(User).filter(User.id == user.id).first() is None
    assert db_session.query(SavedSchedule).filter(SavedSchedule.share_id == "owned-delete").first() is None
    assert db_session.query(SavedSchedule).filter(SavedSchedule.share_id == "anon-delete").one().user_id is None
    assert db_session.query(Friendship).filter(Friendship.id == friendship.id).first() is None
    assert db_session.query(GlobalCourse).filter(GlobalCourse.id == global_course.id).one().uploaded_by is None
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
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest tests/test_data_rights.py -q
```

Expected: failures for missing `/api/auth/me/export` and `DELETE /api/auth/me`.

---

### Task 2: Backend endpoints

**Files:**
- Modify: `backend/app/api/routes/auth.py`

**Interfaces:**
- Consumes: `get_current_user`, `get_db`, ORM models, existing auth router.
- Produces: `GET /api/auth/me/export` and `DELETE /api/auth/me`.

- [ ] **Step 1: Add imports and helpers**

In `backend/app/api/routes/auth.py`, add imports:

```python
import json
import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import or_
```

Extend the database import to:

```python
from ...models.database import _utcnow, get_db, Friendship, GlobalCourse, SavedSchedule, User
```

Add below the router:

```python
log = logging.getLogger("isikschedule")
DATA_EXPORT_SCHEMA_VERSION = "2026-07-02"


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _json_value(raw_json: str) -> Any:
    try:
        return json.loads(raw_json)
    except json.JSONDecodeError:
        return raw_json
```

- [ ] **Step 2: Add export endpoint**

Add after `get_me()`:

```python
@router.get("/me/export")
async def export_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export the authenticated user's personal data."""
    saved_schedules = (
        db.query(SavedSchedule)
        .filter(SavedSchedule.user_id == current_user.id)
        .order_by(SavedSchedule.id)
        .all()
    )
    friendships = (
        db.query(Friendship)
        .filter(or_(Friendship.user_id == current_user.id, Friendship.friend_id == current_user.id))
        .order_by(Friendship.id)
        .all()
    )
    uploaded_global_courses = (
        db.query(GlobalCourse)
        .filter(GlobalCourse.uploaded_by == current_user.id)
        .order_by(GlobalCourse.id)
        .all()
    )

    log.info("User data export requested: user_id=%s", current_user.id)

    return {
        "schema_version": DATA_EXPORT_SCHEMA_VERSION,
        "generated_at": _utcnow().isoformat(),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "is_active": current_user.is_active,
            "created_at": _isoformat(current_user.created_at),
            "kvkk_consent_at": _isoformat(current_user.kvkk_consent_at),
            "consent_version": current_user.consent_version,
        },
        "saved_schedules": [
            {
                "id": schedule.id,
                "name": schedule.name,
                "courses": _json_value(schedule.courses_json),
                "created_at": _isoformat(schedule.created_at),
                "share_id": schedule.share_id,
            }
            for schedule in saved_schedules
        ],
        "friendships": [
            {
                "id": friendship.id,
                "user_id": friendship.user_id,
                "friend_id": friendship.friend_id,
                "counterparty_user_id": friendship.friend_id if friendship.user_id == current_user.id else friendship.user_id,
                "counterparty_email": (
                    friendship.friend.email if friendship.user_id == current_user.id else friendship.user.email
                ),
                "status": friendship.status,
                "created_at": _isoformat(friendship.created_at),
                "updated_at": _isoformat(friendship.updated_at),
            }
            for friendship in friendships
        ],
        "uploaded_global_courses": [
            {
                "id": course.id,
                "semester": course.semester,
                "uploaded_at": _isoformat(course.uploaded_at),
                "is_active": course.is_active,
            }
            for course in uploaded_global_courses
        ],
    }
```

- [ ] **Step 3: Add delete endpoint**

Add after export:

```python
@router.delete("/me")
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the authenticated non-admin user account."""
    if current_user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be self-deleted",
        )

    user_id = current_user.id
    db.delete(current_user)
    db.commit()
    log.info("User account deleted: user_id=%s", user_id)
    return {"message": "Account deleted successfully"}
```

- [ ] **Step 4: Run backend tests and lint**

Run:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest tests/test_data_rights.py -q
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m ruff check .
```

Expected: all tests and lint pass.

---

### Task 3: Data-rights documentation

**Files:**
- Create: `docs/data-rights.md`

**Interfaces:**
- Consumes: behavior from Task 2.
- Produces: repository documentation for export/delete, ownership effects, auth, and audit logging.

- [ ] **Step 1: Add documentation**

Create `docs/data-rights.md` with:

```markdown
# Data Rights Flow

Authenticated users can export and delete their account data from `/account`.

## Export

`GET /api/auth/me/export` requires a bearer token and returns JSON for the current user. It includes profile metadata, owned saved schedules, friendship rows involving the user, and metadata for global course uploads owned by the user.

The export excludes password hashes and excludes anonymous saved schedules where `user_id IS NULL`.

## Delete

`DELETE /api/auth/me` requires a bearer token and deletes non-admin accounts immediately. Admin self-delete returns `403`.

Deletion effects are defined by the database foreign keys:

- `saved_schedules.user_id` cascades for owned saved schedules.
- `friendships.user_id` and `friendships.friend_id` cascade for sent and received friendships.
- `global_courses.uploaded_by` is set to `NULL`, so global course data remains available without a deleted owner.
- Anonymous saved schedules remain untouched.

## Auth And Logging

Both endpoints use the existing JWT bearer authentication dependency. After deletion, existing tokens no longer authenticate because the user row is gone.

The backend writes a high-level application log for export requests and completed deletions using only `user_id`. Logs do not include exported payloads, schedule JSON, passwords, friend details, or tokens.
```

---

### Task 4: Frontend account page

**Files:**
- Create: `frontend/app/account/page.tsx`
- Modify: `frontend/app/context/LanguageContext.tsx`
- Modify: `frontend/app/components/Navbar.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `RequireAuth`, `Navbar`, `API_BASE_URL`, `useLanguage()`.
- Produces: protected `/account` page and navbar link.

- [ ] **Step 1: Add i18n keys**

Add these keys to both `tr` and `en` translation objects.

TR:

```typescript
    navAccount: 'Hesap',
    accountTitle: 'Hesap ve veri hakları',
    accountSubtitle: 'Verilerinizi dışa aktarabilir veya hesabınızı silebilirsiniz.',
    accountSignedInAs: 'Giriş yapılan hesap',
    accountExportTitle: 'Verilerimi dışa aktar',
    accountExportDescription: 'Profil, kayıtlı programlar, arkadaşlık ilişkileri ve global dönem yükleme sahipliği JSON olarak indirilir.',
    accountExportAction: 'JSON indir',
    accountExporting: 'İndiriliyor...',
    accountDeleteTitle: 'Hesabı sil',
    accountDeleteDescription: 'Hesap, kayıtlı programlar ve arkadaşlık ilişkileri kalıcı olarak silinir. Global ders verileri korunur.',
    accountDeleteConfirmLabel: 'Hesabımı silmek istediğimi anlıyorum.',
    accountDeleteAction: 'Hesabı sil',
    accountDeleting: 'Siliniyor...',
    accountExportFailed: 'Veriler indirilemedi.',
    accountDeleteFailed: 'Hesap silinemedi.',
```

EN:

```typescript
    navAccount: 'Account',
    accountTitle: 'Account and data rights',
    accountSubtitle: 'Export your data or delete your account.',
    accountSignedInAs: 'Signed in as',
    accountExportTitle: 'Export my data',
    accountExportDescription: 'Profile, saved schedules, friendships, and global semester upload ownership are downloaded as JSON.',
    accountExportAction: 'Download JSON',
    accountExporting: 'Downloading...',
    accountDeleteTitle: 'Delete account',
    accountDeleteDescription: 'Your account, saved schedules, and friendships are permanently deleted. Global course data is retained.',
    accountDeleteConfirmLabel: 'I understand that I want to delete my account.',
    accountDeleteAction: 'Delete account',
    accountDeleting: 'Deleting...',
    accountExportFailed: 'Could not download your data.',
    accountDeleteFailed: 'Could not delete your account.',
```

- [ ] **Step 2: Add the account page**

Create `frontend/app/account/page.tsx` with a client component using `RequireAuth`. It calls `GET /api/auth/me/export`, creates a `Blob`, downloads `isikschedule-data-export-YYYY-MM-DD.json`, and calls `DELETE /api/auth/me` after the checkbox is checked. On successful deletion it calls `logout()`.

- [ ] **Step 3: Add navbar link**

In `frontend/app/components/Navbar.tsx`, import `Settings` from `lucide-react` and add `NavLink href="/account"` for authenticated users in desktop and mobile navigation.

- [ ] **Step 4: Run frontend checks**

Run:

```powershell
cd frontend
npm run lint
npm run build
```

Expected: lint and production build pass.

---

## Self-Review

- Spec coverage: backend export, delete, ownership behavior, auth/log docs, backend tests, and frontend UI are all mapped to tasks.
- Placeholder scan: no placeholder markers and no deferred decisions.
- Type consistency: backend uses `schema_version = "2026-07-02"` and frontend uses existing auth token storage through `useAuth`; no existing auth response shape changes.
