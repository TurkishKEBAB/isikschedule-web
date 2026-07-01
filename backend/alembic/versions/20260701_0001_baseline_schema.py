"""Baseline current schema.

Revision ID: 20260701_0001
Revises:
Create Date: 2026-07-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260701_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _column_names(table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def _column(table_name: str, column_name: str) -> dict | None:
    for column in sa.inspect(op.get_bind()).get_columns(table_name):
        if column["name"] == column_name:
            return column
    return None


def _index_names(table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table_name)}


def _create_index_once(index_name: str, table_name: str, columns: list[str], *, unique: bool = False) -> None:
    if index_name not in _index_names(table_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _ensure_users() -> None:
    if "users" not in _table_names():
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("role", sa.String(length=50), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("kvkk_consent_at", sa.DateTime(), nullable=True),
            sa.Column("consent_version", sa.String(length=32), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        columns = _column_names("users")
        if "kvkk_consent_at" not in columns:
            op.add_column("users", sa.Column("kvkk_consent_at", sa.DateTime(), nullable=True))
        if "consent_version" not in columns:
            op.add_column("users", sa.Column("consent_version", sa.String(length=32), nullable=True))

    _create_index_once("ix_users_email", "users", ["email"], unique=True)
    _create_index_once("ix_users_id", "users", ["id"])


def _ensure_saved_schedules() -> None:
    if "saved_schedules" not in _table_names():
        op.create_table(
            "saved_schedules",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("courses_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("share_id", sa.String(length=64), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("share_id"),
        )
    else:
        user_id = _column("saved_schedules", "user_id")
        if user_id is not None and not user_id["nullable"]:
            with op.batch_alter_table("saved_schedules") as batch_op:
                batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)

    _create_index_once("ix_saved_schedules_id", "saved_schedules", ["id"])


def _ensure_friendships() -> None:
    if "friendships" not in _table_names():
        op.create_table(
            "friendships",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("friend_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["friend_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    _create_index_once("ix_friendships_id", "friendships", ["id"])


def _ensure_global_courses() -> None:
    if "global_courses" not in _table_names():
        op.create_table(
            "global_courses",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("semester", sa.String(length=50), nullable=False),
            sa.Column("courses_json", sa.Text(), nullable=False),
            sa.Column("uploaded_by", sa.Integer(), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    _create_index_once("ix_global_courses_id", "global_courses", ["id"])


def upgrade() -> None:
    _ensure_users()
    _ensure_saved_schedules()
    _ensure_friendships()
    _ensure_global_courses()


def downgrade() -> None:
    op.drop_index("ix_global_courses_id", table_name="global_courses")
    op.drop_table("global_courses")
    op.drop_index("ix_friendships_id", table_name="friendships")
    op.drop_table("friendships")
    op.drop_index("ix_saved_schedules_id", table_name="saved_schedules")
    op.drop_table("saved_schedules")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
