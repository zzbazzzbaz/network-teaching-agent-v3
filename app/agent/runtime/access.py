from agentscope.app.access import (
    ResourceAccessPolicyBase,
    ResourceKind,
    ResourcePermission,
    ResourceRef,
)
from agentscope.app.storage import StorageBase

from app.shared.constants import SYSTEM_USER_ID


class _TeachingAccessPolicy(ResourceAccessPolicyBase):
    """system 名下的公共资源对所有用户只读。"""

    async def list_accessible(
            self,
            viewer_id: str,
            kind: ResourceKind,
            storage: StorageBase,
    ) -> list[ResourceRef]:
        del viewer_id
        if kind is ResourceKind.AGENT:
            agents = await storage.list_agents(SYSTEM_USER_ID)
            resource_ids = [record.id for record in agents if record.source != "team"]
        elif kind is ResourceKind.KNOWLEDGE_BASE:
            knowledge_bases = await storage.list_knowledge_bases(SYSTEM_USER_ID)
            resource_ids = [record.id for record in knowledge_bases]
        elif kind is ResourceKind.CREDENTIAL:
            credentials = await storage.list_credentials(SYSTEM_USER_ID)
            resource_ids = [record.id for record in credentials]
        else:
            return []

        return [
            ResourceRef(
                kind=kind,
                owner_id=SYSTEM_USER_ID,
                resource_id=resource_id,
                permission=ResourcePermission.READ,
            )
            for resource_id in resource_ids
        ]


def build_access_policy() -> _TeachingAccessPolicy:
    return _TeachingAccessPolicy()
