from agentscope.app.access import (
    ResourceAccessPolicyBase,
    ResourceKind,
    ResourcePermission,
    ResourceRef,
)
from agentscope.app.storage import StorageBase

# 公共资源归属: 管理端以 system 身份创建, 所有学生只读。
PUBLIC_OWNER = "system"


class TeachingAccessPolicy(ResourceAccessPolicyBase):
    """system 名下的公共资源对所有用户只读。

    规则由"创建位置"决定, 不维护 id 白名单: 管理端新建公共库 / 公共 agent /
    共享凭据都不需要改代码。个人资源仍由 storage 的 owner 隔离负责,
    team 子 agent 不参与共享。
    """

    async def list_accessible(
        self,
        viewer_id: str,
        kind: ResourceKind,
        storage: StorageBase,
    ) -> list[ResourceRef]:
        del viewer_id
        if kind is ResourceKind.AGENT:
            agents = await storage.list_agents(PUBLIC_OWNER)
            resource_ids = [record.id for record in agents if record.source != "team"]
        elif kind is ResourceKind.KNOWLEDGE_BASE:
            knowledge_bases = await storage.list_knowledge_bases(PUBLIC_OWNER)
            resource_ids = [record.id for record in knowledge_bases]
        elif kind is ResourceKind.CREDENTIAL:
            credentials = await storage.list_credentials(PUBLIC_OWNER)
            resource_ids = [record.id for record in credentials]
        else:
            return []

        return [
            ResourceRef(
                kind=kind,
                owner_id=PUBLIC_OWNER,
                resource_id=resource_id,
                permission=ResourcePermission.READ,
            )
            for resource_id in resource_ids
        ]


def build_access_policy() -> TeachingAccessPolicy:
    return TeachingAccessPolicy()
