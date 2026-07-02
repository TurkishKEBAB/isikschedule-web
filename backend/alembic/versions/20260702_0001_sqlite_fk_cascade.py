"""Enable SQLite FK cascade rules.

Revision ID: 20260702_0001
Revises: 20260701_0001
Create Date: 2026-07-02
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260702_0001"
down_revision: Union[str, Sequence[str], None] = "20260701_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NAMING_CONVENTION = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}


def _cleanup_orphans() -> None:
    op.execute(
        """
        DELETE FROM saved_schedules
        WHERE user_id IS NOT NULL
          AND user_id NOT IN (SELECT id FROM users)
        """
    )
    op.execute(
        """
        DELETE FROM friendships
        WHERE user_id NOT IN (SELECT id FROM users)
           OR friend_id NOT IN (SELECT id FROM users)
        """
    )
    op.execute(
        """
        UPDATE global_courses
        SET uploaded_by = NULL
        WHERE uploaded_by IS NOT NULL
          AND uploaded_by NOT IN (SELECT id FROM users)
        """
    )


def upgrade() -> None:
    _cleanup_orphans()

    with op.batch_alter_table(
        "saved_schedules",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("fk_saved_schedules_user_id_users", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_saved_schedules_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table(
        "friendships",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("fk_friendships_user_id_users", type_="foreignkey")
        batch_op.drop_constraint("fk_friendships_friend_id_users", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_friendships_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_foreign_key(
            "fk_friendships_friend_id_users",
            "users",
            ["friend_id"],
            ["id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table(
        "global_courses",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("fk_global_courses_uploaded_by_users", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_global_courses_uploaded_by_users",
            "users",
            ["uploaded_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table(
        "global_courses",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("fk_global_courses_uploaded_by_users", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_global_courses_uploaded_by_users",
            "users",
            ["uploaded_by"],
            ["id"],
        )

    with op.batch_alter_table(
        "friendships",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("fk_friendships_user_id_users", type_="foreignkey")
        batch_op.drop_constraint("fk_friendships_friend_id_users", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_friendships_user_id_users",
            "users",
            ["user_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_friendships_friend_id_users",
            "users",
            ["friend_id"],
            ["id"],
        )

    with op.batch_alter_table(
        "saved_schedules",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("fk_saved_schedules_user_id_users", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_saved_schedules_user_id_users",
            "users",
            ["user_id"],
            ["id"],
        )
