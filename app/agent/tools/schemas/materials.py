from pydantic import BaseModel, Field


class MaterialsLsInput(BaseModel):
    path: str = "/"


class MaterialsReadInput(BaseModel):
    path: str
    offset: int = Field(default=1, ge=1)
    limit: int = Field(default=300, ge=1, le=500)


class MaterialsGrepInput(BaseModel):
    query: str = Field(min_length=1, max_length=100)
    path: str = "/"
    limit: int = Field(default=20, ge=1, le=100)
