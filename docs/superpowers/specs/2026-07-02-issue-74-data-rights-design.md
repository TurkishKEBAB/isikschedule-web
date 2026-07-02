# Issue 74 Data Rights Design

## Goal

Add a minimal authenticated data-rights flow so a user can export their own personal data and delete their own account before production go-live.

## Scope

- Add authenticated backend endpoints under `/api/auth`.
- Add backend tests for authorization, export content, and deletion effects.
- Add a protected frontend account page reachable from the navbar.
- Document the data ownership, cascade, and logging behavior.

## Backend Design

`GET /api/auth/me/export` returns JSON for the current authenticated user:

- `schema_version` and `generated_at`.
- `user`: id, email, role, active status, creation timestamp, KVKK consent timestamp, and consent version.
- `saved_schedules`: schedules owned by the user (`saved_schedules.user_id = current_user.id`).
- `friendships`: friendship rows where the user is either requester or friend.
- `uploaded_global_courses`: metadata for global course uploads where `global_courses.uploaded_by = current_user.id`.

The export must never include password hashes. Anonymous saved schedules (`user_id IS NULL`) are not owned by the user and are excluded.

`DELETE /api/auth/me` deletes the current non-admin user account. Existing foreign-key rules define the data effects:

- Owned `saved_schedules` are deleted by cascade.
- Sent and received `friendships` are deleted by cascade.
- `global_courses.uploaded_by` is set to `NULL`, keeping global course data available.
- Anonymous saved schedules remain untouched.

Admin self-delete is rejected with `403` so the app does not accidentally remove the bootstrap/admin operator path.

## Frontend Design

Add `/account` as a protected page using the existing auth context and navbar style.

The page includes:

- Current account identity.
- Export button that downloads the backend JSON as a timestamped `.json` file.
- Delete account area with an explicit confirmation step before calling `DELETE /api/auth/me`.

After successful deletion, the frontend clears local auth state and sends the user to login or home.

## Audit And Documentation

The backend logs export and deletion events with user id only. Logs do not contain exported data, schedule payloads, friendship details, passwords, or tokens.

Add a short repository document describing:

- What the endpoints do.
- Which data is exported.
- Which data is deleted or retained.
- Auth requirements.
- Logging behavior.

## Error Handling

- Unauthenticated export/delete requests return the existing auth failure response.
- Admin delete returns `403`.
- Deletion returns a simple success JSON response after commit.
- Frontend shows inline error messages for failed export/delete requests.

## Tests

Backend tests cover:

- Export requires authentication.
- Export includes owned user-linked records and excludes anonymous saved schedules.
- Delete requires authentication.
- Delete removes the user, owned schedules, and friendships.
- Delete leaves anonymous schedules and nulls `global_courses.uploaded_by`.
- Admin self-delete is blocked.

Frontend will be validated with lint/build after implementation.
