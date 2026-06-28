# Security incident: leaked admin credential in git history

> **Issue:** [#13](https://github.com/TurkishKEBAB/isikschedule-web/issues/13) — *Leaked admin credential'ı rotate et ve history/risk kararını netleştir*
> **Severity:** P0 (credential exposure) · **Labels:** `type: security`, `phase: go-live`, `epic: security`
> **Status:** code-side fix shipped; **rotation + history purge are still PENDING operator action** (see [Decisions](#decisions)).
> **TR özet:** Gerçek admin parolası ve gerçek bir kişiye ait e-posta, public repo'nun git geçmişinde sızdı. Koddaki default'lar zararsız placeholder'a çevrildi (`9bebc8a`). Kalan iki iş — (1) gerçek parolayı rotate etmek, (2) git geçmişini rewrite ile temizlemek — operatör tarafından elle yapılacak; runbook'lar aşağıda.

---

## 1. Summary

A real admin password and a real personal student email address were committed to
`backend/app/config.py` as the built-in admin bootstrap defaults. Because
`origin` is a **public** GitHub repository
(`github.com/TurkishKEBAB/isikschedule-web`), these values are readable by anyone
who clones or browses the repository's history.

The working tree has already been remediated — the defaults are now harmless
placeholders — but the secret remains reachable through the git history of the
public repo until the history is rewritten.

## 2. What leaked

| Item | Value | Notes |
|---|---|---|
| Admin password | *(redacted — see commit `7144da5`)* | A real, usable password. **Must be treated as compromised.** |
| Admin email | A real personal `@isik.edu.tr` student address | PII. Also acts as the bootstrap admin's login identity. |

Both were introduced as the `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`
literals in [`backend/app/config.py`](../../backend/app/config.py).

> This document deliberately does **not** reproduce the secret values, to avoid
> re-introducing them into a tracked file. They are recoverable from the commit
> referenced below for whoever performs the rotation.

## 3. Timeline

| Date (UTC) | Event | Commit |
|---|---|---|
| — | Real admin email + password committed as config defaults | `7144da5` *refactor(security): move admin bootstrap credentials into settings* |
| 2026-06-28 | Defaults replaced with non-functional placeholders; production guard + dev warning preserved | `9bebc8a` *fix backend release security gates* |
| 2026-06-28 | This incident & decision record created; rotation + history purge runbooks documented | issue #13 PR |

The leaked literals are present in **every commit between `7144da5` and the parent
of `9bebc8a`** (~26 commits of history on `master`).

## 4. Exposure assessment

- **Public repository.** Assume the password is already harvested. GitHub history,
  forks, clones, and third-party caches (e.g. search/archival crawlers) may retain
  the value even after a history rewrite. **A history rewrite is *not* a substitute
  for rotation** — rotation is the control that actually neutralizes the secret.
- **Blast radius if reused.** The leaked value is the *bootstrap admin* credential.
  An attacker who logs in as admin can reach the admin-only endpoints
  ([`backend/app/api/routes/admin.py`](../../backend/app/api/routes/admin.py):
  upload-semester, activate-semester, list users, stats).
- **Personal data.** The email is a real student address (KVKK / PII relevance),
  which is a second reason to scrub history beyond the password itself.

## 5. Code-side controls already in place (verified 2026-06-28)

These are confirmed present in the current tree and are **not** part of the
remaining work — they are recorded here as the durable guardrails:

- `backend/app/config.py` defaults are now placeholders:
  `admin@example.com` / `change-me-in-production`
  ([config.py L14–L16](../../backend/app/config.py#L14-L16)).
- Production boot guard refuses to start if `SECRET_KEY`, `ADMIN_EMAIL`, or
  `ADMIN_PASSWORD` are left at their defaults while `APP_ENV in {production, prod}`
  ([config.py L94–L108](../../backend/app/config.py#L94-L108)).
- A startup warning is logged when the built-in defaults are used in development
  ([database.py `create_admin_user` L118–L133](../../backend/app/models/database.py#L118-L133)).
- `.env.example` documents both admin vars as REQUIRED in production.

### ⚠️ Codebase caveat that changes the rotation procedure

`create_admin_user()` is **create-only** — it inserts the admin **only if no user
with that email already exists** (`if not admin:` at
[database.py L118–L128](../../backend/app/models/database.py#L118-L128)), and there
is **no password-change endpoint** anywhere in the API (`auth.py` exposes only
register / login / me / logout; `admin.py` has no user-mutation route).

**Consequence:** simply setting a new `ADMIN_PASSWORD` in `.env` and restarting
will **not** change an admin that already exists in `data.db`. Rotation of an
existing admin must update the database row directly (or recreate the row). Both
methods are given in the runbook below.

---

## 6. Decisions

| # | Decision | Chosen path | Status |
|---|---|---|---|
| **D1** | Rotate the leaked admin credential | Rotate **password and email** away from the leaked values | ⏳ PENDING (operator) |
| **D2** | Remediate git history | **Purge** the secret from history via rewrite (BFG / git-filter-repo) + force-push | ⏳ PENDING (operator) |

Rationale:
- **D1** is mandatory and is the primary control: once the password is rotated,
  the value sitting in history becomes useless for authentication.
- **D2** was chosen (over documented risk-acceptance) because the leaked data also
  includes a real student email (PII), and the owner elected to scrub history
  rather than accept the residual exposure. Per
  [`docs/AI_AGENT_WORKFLOW.md`](../AI_AGENT_WORKFLOW.md) routing, credential
  rotation and a history-rewrite force-push are **human/operator** actions; this
  document supplies the runbooks, but the destructive steps are intentionally left
  for a human to execute — an AI agent will not force-push `master`.

---

## 7. Runbook D1 — rotate the admin credential

Pick **one** of the two methods. Method A preserves existing data; Method B is a
clean recreate. Both assume you run from the `backend/` directory with the project
virtualenv.

### Step 0 — choose new values (both methods)

```powershell
# Strong new password (store it in your secret manager, do NOT commit it)
..\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(24))"
```

Decide a new admin email that is **not** a personal student address
(e.g. a role mailbox like `admin@isikschedule.app`).

### Method A — update the existing row in place (no data loss, recommended)

Rehashes the password using the app's own hashing and updates the admin row,
keeping its `user_id` (so any schedules it owns are preserved). Optionally also
moves the admin to the new non-PII email.

```powershell
cd backend
..\.venv\Scripts\python.exe - <<'PY'
from app.models.database import SessionLocal, User
from app.core.auth import get_password_hash

OLD_EMAIL = "PUT-THE-LEAKED-EMAIL-HERE"   # the @isik.edu.tr address from commit 7144da5
NEW_EMAIL = "admin@isikschedule.app"       # new non-PII admin login (or keep OLD_EMAIL)
NEW_PASSWORD = "PASTE-NEW-STRONG-PASSWORD"

db = SessionLocal()
admin = db.query(User).filter(User.email == OLD_EMAIL).first()
assert admin, f"No admin row found for {OLD_EMAIL}"
admin.password_hash = get_password_hash(NEW_PASSWORD)
admin.email = NEW_EMAIL
db.commit()
print("Rotated admin:", admin.email)
db.close()
PY
```

### Method B — recreate via bootstrap (simplest; drops the old admin row)

> ⚠️ This deletes the existing admin user row. Any `SavedSchedule` rows owned by
> that admin (`user_id` = old admin id) are orphaned/lost. Use Method A if the
> admin owns data you care about.

1. Set the new values in the production environment (secret manager / `.env`, never committed):
   ```dotenv
   ADMIN_EMAIL=admin@isikschedule.app
   ADMIN_PASSWORD=PASTE-NEW-STRONG-PASSWORD
   ```
2. Delete the old admin row:
   ```powershell
   cd backend
   ..\.venv\Scripts\python.exe -c "from app.models.database import SessionLocal, User; db=SessionLocal(); db.query(User).filter(User.email=='PUT-THE-LEAKED-EMAIL-HERE').delete(); db.commit(); print('deleted'); db.close()"
   ```
3. Restart the backend → `create_admin_user()` recreates the admin from the new env values.

### Verify (both methods)

```powershell
# Old credential must now FAIL (expect 401)
curl -i -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"OLD_EMAIL\",\"password\":\"OLD_LEAKED_PASSWORD\"}"

# New credential must succeed (expect 200 + token)
curl -i -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@isikschedule.app\",\"password\":\"NEW_PASSWORD\"}"
```

Acceptance: old password → `401`, new password → `200`.

---

## 8. Runbook D2 — purge the secret from git history

> ⚠️ **Destructive & coordinated.** This rewrites `master` and requires a
> `--force` push. It breaks every existing clone/fork and invalidates open PRs.
> Announce a freeze, ensure no unmerged work is outstanding, and take a backup
> mirror first. **Do D1 (rotation) first** — history rewriting does not un-leak
> what crawlers/forks already captured.

### Step 1 — back up

```powershell
git clone --mirror https://github.com/TurkishKEBAB/isikschedule-web.git isikschedule-backup.git
```

### Step 2 — rewrite (recommended: git-filter-repo)

Install: `pip install git-filter-repo`. Create a replacements file `replacements.txt`
(do **not** commit it) with the literal secrets to scrub:

```text
literal:THE_LEAKED_PASSWORD==>change-me-in-production
literal:the-leaked@isik.edu.tr==>admin@example.com
```

Then, in a fresh clone:

```powershell
git clone https://github.com/TurkishKEBAB/isikschedule-web.git isikschedule-clean
cd isikschedule-clean
git filter-repo --replace-text ..\replacements.txt
```

### Step 2 (alternative) — BFG

```powershell
# BFG replaces text matched in a file; one "secret==>replacement" per line
java -jar bfg.jar --replace-text replacements.txt isikschedule-clean.git
cd isikschedule-clean.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### Step 3 — force-push the rewritten history

```powershell
git push --force origin master
# If other branches/tags contain the secret, push them rewritten too:
# git push --force --tags origin
```

### Step 4 — post-rewrite cleanup

- Ask GitHub Support to **purge cached views** of the affected commits, and delete
  stale forks if any exist.
- Notify collaborators to **re-clone** (their old clones still contain the secret).
- Confirm the secret is gone:
  ```powershell
  git log --all -S "THE_LEAKED_PASSWORD" --oneline   # expect: no output
  ```

---

## 9. Definition of done (to close issue #13)

- [ ] D1: admin password rotated; old password returns `401`, new returns `200` (§7 verify).
- [ ] D1: admin email moved off the personal student address (optional but recommended).
- [x] Code-side defaults are placeholders + production guard enforced (`9bebc8a`, verified §5).
- [ ] D2: history rewritten and force-pushed; `git log --all -S <secret>` returns nothing (§8 step 4).
- [ ] Collaborators notified to re-clone.

Until D1 and D2 are executed by an operator, this issue stays **open**. This PR
delivers the decision record, the verified code-side status, and the runbooks.
