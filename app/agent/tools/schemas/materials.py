from pydantic import BaseModel, Field


class MaterialsLsInput(BaseModel):
    path: str = "/"
    depth: int = Field(default=1, ge=1, le=3)


class MaterialsReadInput(BaseModel):
    path: str
    offset: int = Field(default=1, ge=1)
    limit: int = Field(default=120, ge=1, le=300)


class MaterialsGrepInput(BaseModel):
    query: str = Field(min_length=1, max_length=100)
    path: str = "/"
    limit: int = Field(default=5, ge=1, le=10)
