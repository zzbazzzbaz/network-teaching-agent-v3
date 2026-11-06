from pathlib import Path

from agentscope.app.workspace_manager import IsolationPolicy, LocalWorkspaceManager

from app.shared.config import Settings

TEACHING_WORKSPACE_INSTRUCTIONS = (
    "<workspace>\n"
    "你拥有一个属于当前学生的工作目录, 由系统自动维护。\n"
    "你不直接读写其中的文件, 也不需要创建目录或项目。\n"
    "</workspace>"
)


def _discover_skill_paths() -> list[str]:
    _SKILLS_DIR = Path(__file__).parent.parent / "skills"
    return [str(path.parent) for path in sorted(_SKILLS_DIR.glob("*/SKILL.md"))]


def build_workspace_manager(settings: Settings) -> LocalWorkspaceManager:
    """本地目录工作区: 框架按 agent_id 分目录, 无外部依赖。"""
    return LocalWorkspaceManager(
        str(settings.workspaces_dir),
        isolation=IsolationPolicy.PER_AGENT,
        skill_paths=_discover_skill_paths(),
        ttl=3600.0,
    )
