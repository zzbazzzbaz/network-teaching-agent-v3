from fastapi import APIRouter

from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.files import router as file_router
from app.api.endpoints.internal_question import router as internal_question_router
from app.api.endpoints.internal_usage import router as internal_usage_router
from app.api.endpoints.memory import router as memory_router
from app.api.endpoints.question import router as question_router
from app.api.endpoints.session import router as session_router
from app.api.endpoints.stats import router as stats_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(question_router)
api_router.include_router(file_router)
api_router.include_router(session_router)
api_router.include_router(memory_router)
api_router.include_router(stats_router)
api_router.include_router(internal_question_router)
api_router.include_router(internal_usage_router)
