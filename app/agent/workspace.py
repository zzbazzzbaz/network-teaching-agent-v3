from agentscope.app.workspace_manager import IsolationPolicy, LocalWorkspaceManager

from app.core.config import Settings

TEACHING_WORKSPACE_INSTRUCTIONS = (
    "<workspace>\n"
    "你拥有一个属于当前学生的工作目录, 由系统自动维护。\n"
    "你不直接读写其中的文件, 也不需要创建目录或项目。\n"
    "</workspace>"
)


def build_workspace_manager(settings: Settings) -> LocalWorkspaceManager:
    """本地目录工作区: 每个 agent 一个目录, 无外部依赖。"""
    return LocalWorkspaceManager(
        str(settings.workspaces_dir),
        isolation=IsolationPolicy.PER_AGENT,
        ttl=3600.0,
    )
