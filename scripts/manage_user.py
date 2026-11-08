import argparse
import asyncio
import sys

from app.api.core.database import close_db, create_db_and_tables, session_scope
from app.api.core.security import hash_password
from app.api.repositories import user_repositories
from app.shared.enums import UserRole, UserStatus


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="管理用户与管理员角色")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create", help="创建用户")
    create.add_argument("--username", required=True)
    create.add_argument("--password", required=True)
    create.add_argument(
        "--role",
        choices=[role.value for role in UserRole],
        default=UserRole.STUDENT.value,
    )
    create.add_argument(
        "--status",
        choices=[status.value for status in UserStatus],
        default=UserStatus.ACTIVE.value,
    )

    promote = subparsers.add_parser("promote", help="将已有用户提升为管理员")
    promote.add_argument("--username", required=True)

    return parser.parse_args()


async def _create(args: argparse.Namespace) -> int:
    username = args.username.strip()
    if len(username) < 3 or len(username) > 64 or any(char.isspace() for char in username):
        print("用户名必须为 3-64 个字符且不能包含空白字符", file=sys.stderr)
        return 1
    if len(args.password) < 6 or len(args.password) > 128:
        print("密码长度必须为 6-128 个字符", file=sys.stderr)
        return 1

    async with session_scope() as session:
        if await user_repositories.get_by_username(session, username) is not None:
            print(f"用户名已存在: {username}", file=sys.stderr)
            return 1
        user = await user_repositories.create(
            session,
            username=username,
            password_hash=hash_password(args.password),
            role=UserRole(args.role),
            status=UserStatus(args.status),
        )
        print(f"已创建用户: {user.username} ({user.role.value}, {user.status.value})")
    return 0


async def _promote(args: argparse.Namespace) -> int:
    username = args.username.strip()
    async with session_scope() as session:
        user = await user_repositories.get_by_username(session, username)
        if user is None:
            print(f"用户不存在: {username}", file=sys.stderr)
            return 1
        await user_repositories.update_user(session, user, role=UserRole.ADMIN)
        print(f"已提升为管理员: {user.username}")
    return 0


async def _main() -> int:
    args = _parse_args()
    await create_db_and_tables()
    try:
        if args.command == "create":
            return await _create(args)
        return await _promote(args)
    finally:
        await close_db()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
