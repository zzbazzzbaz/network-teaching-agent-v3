from datetime import date

from pydantic import BaseModel


class StatsTotals(BaseModel):
    tokens: int
    sessions: int
    rounds: int
    answers: int


class DailyStatsItem(BaseModel):
    date: date
    tokens: int
    cache_hit_rate: float | None
    rounds: int
    input_tokens: int
    output_tokens: int
    cache_input_tokens: int


class MyStatsResponse(BaseModel):
    totals: StatsTotals
    daily: list[DailyStatsItem]
