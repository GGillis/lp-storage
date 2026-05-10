from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class RecordCreate(BaseModel):
    discogs_id: Optional[str] = None
    title: str
    artist: str
    year: Optional[int] = None
    genre: Optional[str] = None
    styles: Optional[str] = None
    label: Optional[str] = None
    catalog_number: Optional[str] = None
    country: Optional[str] = None
    format: Optional[str] = None
    tracklist: Optional[str] = None
    cover_path: Optional[str] = None
    cover_url: Optional[str] = None  # consumed server-side to download cover, not stored
    lowest_price: Optional[float] = None
    price_currency: Optional[str] = None
    price_checked_at: Optional[datetime] = None
    notes: Optional[str] = None
    tags: list[str] = []

    @field_validator("tags", mode="before")
    @classmethod
    def normalise_tags(cls, v):
        if not v:
            return []
        return sorted({t.strip().lower() for t in v if t.strip()})


class RecordResponse(RecordCreate):
    id: int
    date_added: datetime

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    tag: str

    @field_validator("tag")
    @classmethod
    def normalise(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("Tag cannot be empty")
        return v


class DiscogsCandidate(BaseModel):
    discogs_id: str
    title: str
    artist: str
    year: Optional[int] = None
    label: Optional[str] = None
    catalog_number: Optional[str] = None
    format: Optional[str] = None
    country: Optional[str] = None
    cover_url: Optional[str] = None
    resource_url: str


class MasterCandidate(BaseModel):
    master_id: str
    title: str
    artist: str
    year: Optional[int] = None
    genre: Optional[str] = None
    cover_url: Optional[str] = None


# ── Games ──────────────────────────────────────────────────────────────────────

class GameCreate(BaseModel):
    bgg_id: Optional[str] = None
    title: str
    year: Optional[int] = None
    designers: Optional[str] = None
    artists: Optional[str] = None
    publisher: Optional[str] = None
    min_players: Optional[int] = None
    max_players: Optional[int] = None
    min_playtime: Optional[int] = None
    max_playtime: Optional[int] = None
    min_age: Optional[int] = None
    categories: Optional[str] = None
    mechanics: Optional[str] = None
    bgg_rating: Optional[float] = None
    description: Optional[str] = None
    cover_path: Optional[str] = None
    cover_url: Optional[str] = None  # consumed server-side, not stored
    notes: Optional[str] = None
    tags: list[str] = []

    @field_validator("tags", mode="before")
    @classmethod
    def normalise_tags(cls, v):
        if not v:
            return []
        return sorted({t.strip().lower() for t in v if t.strip()})


class GameResponse(GameCreate):
    id: int
    date_added: datetime

    model_config = {"from_attributes": True}


class BGGCandidate(BaseModel):
    bgg_id: str
    title: str
    year: Optional[int] = None
    cover_url: Optional[str] = None
    min_players: Optional[int] = None
    max_players: Optional[int] = None
    min_playtime: Optional[int] = None
    max_playtime: Optional[int] = None
    bgg_rating: Optional[float] = None


class PlayStats(BaseModel):
    plays: int
    first_played: Optional[datetime] = None
    last_played: Optional[datetime] = None
