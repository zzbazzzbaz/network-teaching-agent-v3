from fastapi import APIRouter

from app.api.endpoints.admin.knowledge import (
    public_router as knowledge_public_router,
)
from app.api.endpoints.admin.knowledge import user_router as knowledge_user_router
from app.api.endpoints.admin.stats import router as stats_router
from app.api.endpoints.admin.user_data import router as user_data_router
from app.api.endpoints.admin.users import router as users_router

router = APIRouter(prefix="/admin")
router.include_router(users_router)
router.include_router(knowledge_user_router)
router.include_router(user_data_router)
router.include_router(stats_router)
router.include_router(knowledge_public_router)
