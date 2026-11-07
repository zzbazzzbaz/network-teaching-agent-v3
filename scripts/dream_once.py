"""手动触发一次 ReMe 记忆整理 (dream), 与每天 23:00 的定时任务跑同一套步骤。

用法:
    python -m scripts.dream_once                      # 所有学生, 以今天为基准
    python -m scripts.dream_once --user <user_id>     # 只处理指定学生, 可重复
    python -m scripts.dream_once --date 2026-11-04    # 指定基准日期
    python -m scripts.dream_once --scan-days 3        # 向前多扫几天
"""

import argparse
import asyncio
from pathlib import Path

from agentscope.middleware import ReMeMiddleware

from app.agent.runtime.models import build_chat_model, build_embedding_model
from app.shared.config import get_settings


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="手动触发一次 ReMe dream 记忆整理")
    parser.add_argument(
        "--user",
        action="append",
        dest="users",
        default=None,
        help="学生 id, 可重复传入",
    )
    parser.add_argument("--date", default="", help="整理基准日期, 默认今天")
    parser.add_argument(
        "--scan-days",
        type=int,
        default=None,
        help="向前扫描的天数, 默认沿用任务配置的 2 天",
    )
    return parser.parse_args()


def _targets(root: Path, users: list[str] | None) -> list[Path]:
    candidates = [root / user for user in users] if users else sorted(root.iterdir())
    return [path for path in candidates if path.is_dir()]


async def _dream(workspace: Path, date: str, scan_days: int | None) -> None:
    settings = get_settings()
    memory = ReMeMiddleware(
        workspace_dir=str(workspace),
        parameters=ReMeMiddleware.Parameters(
            chat_model=build_chat_model(settings),
            embedding_model=build_embedding_model(settings),
            mode="agent_control",
        ),
    )
    job_kwargs: dict[str, object] = {"date": date}
    if scan_days is not None:
        job_kwargs["scan_days"] = scan_days

    try:
        response = await memory._run_job("auto_dream", **job_kwargs)
    except Exception as exc:
        print(f"[fail] {workspace.name}: {exc}")
    else:
        print(f"[done] {workspace.name}\n{response.answer}\n")
    finally:
        await memory.close()


async def main() -> None:
    args = _parse_args()
    targets = _targets(get_settings().storage.memory_dir, args.users)
    if not targets:
        print("[skip] 没有找到任何学生的记忆目录")
        return
    for workspace in targets:
        await _dream(workspace, args.date, args.scan_days)


if __name__ == "__main__":
    asyncio.run(main())
