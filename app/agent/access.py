from agentscope.app.access import (
    ResourceAccessPolicyBase,
    ResourceKind,
    ResourcePermission,
    ResourceRef,
)
from agentscope.app.storage import StorageBase

# 公共库归属与 id 列表硬编码: 换库需要发版, 不走配置。
PUBLIC_OWNER = "system"
PUBLIC_KB_IDS: tuple[str, ...] = ()


class TeachingAccessPolicy(ResourceAccessPolicyBase):
    """跨 owner 访问策略: 目前只放行公共知识库的只读引用。

    个人资源(知识库 / 凭据 / agent)仍由 storage 的 owner 隔离负责,
    不在这里出现; 未匹配到的 kind 一律拒绝。
    """

    async def list_accessible(
        self,
        viewer_id: str,
        kind: ResourceKind,
        storage: StorageBase,
    ) -> list[ResourceRef]:
        del viewer_id, storage
        if kind is not ResourceKind.KNOWLEDGE_BASE:
            return []
        return [
            ResourceRef(
                kind=ResourceKind.KNOWLEDGE_BASE,
                owner_id=PUBLIC_OWNER,
                resource_id=kb_id,
                permission=ResourcePermission.READ,
            )
            for kb_id in PUBLIC_KB_IDS
        ]


def build_access_policy() -> TeachingAccessPolicy:
    return TeachingAccessPolicy()
