from fastapi import APIRouter

from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.question import router as question_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(question_router)
