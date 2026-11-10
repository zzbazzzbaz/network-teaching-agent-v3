from fastapi import FastAPI

from app.api.endpoints import api_router
from app.api.lifespan import lifespan

app = FastAPI(title="计算机网络教学智能体", version="0.1.0", lifespan=lifespan)
app.include_router(api_router)


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}
