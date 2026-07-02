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
