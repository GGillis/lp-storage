"""
Explore API — keyword-driven discovery for records and games.

Record keywords: genre, styles, user tags, decade
Game keywords:   categories, mechanics, user tags, decade, player-count bucket
"""

import random
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Record, Game
from schemas import RecordResponse, GameResponse

router = APIRouter(tags=["explore"])


# ── Shared utilities ──────────────────────────────────────────────────────────

def decade_label(year: int) -> str:
    return f"{(year // 10) * 10}s"


def jaccard(a: set, b: set) -> float:
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def _split(s: str | None) -> list[str]:
    if not s:
        return []
    return [p.strip().lower() for p in s.split(",") if p.strip()]


# ── Per-collection keyword extractors ────────────────────────────────────────

def record_keywords(r: Record) -> set[str]:
    kws: set[str] = set()
    kws.update(_split(r.genre))
    kws.update(_split(r.styles))
    for t in r.tags:
        kws.add(t.lower())
    if r.year:
        kws.add(decade_label(r.year))
    return kws


def game_keywords(g: Game) -> set[str]:
    kws: set[str] = set()
    kws.update(_split(g.categories))
    kws.update(_split(g.mechanics))
    for t in g.tags:
        kws.add(t.lower())
    if g.year:
        kws.add(decade_label(g.year))
    # Player-count bucket  e.g. "2 players", "3-4 players", "5+ players"
    if g.min_players and g.max_players:
        lo, hi = g.min_players, g.max_players
        if lo == hi:
            kws.add(f"{lo} players")
        elif hi >= 5:
            kws.add("5+ players")
        else:
            kws.add(f"{lo}-{hi} players")
    return kws


# ── Response models ───────────────────────────────────────────────────────────

class SuggestionsResponse(BaseModel):
    records: list[RecordResponse] = []
    games: list[GameResponse] = []
    related_keywords: list[str]
    total: int

    model_config = {"from_attributes": True}


class RelatedResponse(BaseModel):
    similar: list = []
    different: list = []

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/keywords")
def get_keywords(
    collection: str = Query("records", pattern="^(records|games)$"),
    db: Session = Depends(get_db),
) -> dict:
    if collection == "games":
        items = db.query(Game).all()
        categories: set[str] = set()
        mechanics: set[str] = set()
        tags: set[str] = set()
        decades: set[str] = set()
        players: set[str] = set()
        for g in items:
            categories.update(_split(g.categories))
            mechanics.update(_split(g.mechanics))
            for t in g.tags:
                tags.add(t)
            if g.year:
                decades.add(decade_label(g.year))
            kws = game_keywords(g)
            players.update(k for k in kws if "player" in k)
        return {
            "categories": sorted(categories),
            "mechanics": sorted(mechanics),
            "tags": sorted(tags),
            "decades": sorted(decades),
            "players": sorted(players),
        }
    else:
        items = db.query(Record).all()
        genres: set[str] = set()
        styles: set[str] = set()
        tags: set[str] = set()
        decades: set[str] = set()
        for r in items:
            genres.update(_split(r.genre))
            styles.update(_split(r.styles))
            for t in r.tags:
                tags.add(t)
            if r.year:
                decades.add(decade_label(r.year))
        return {
            "genres": sorted(genres),
            "styles": sorted(styles),
            "tags": sorted(tags),
            "decades": sorted(decades),
        }


@router.get("/suggestions", response_model=SuggestionsResponse)
def get_suggestions(
    kw: list[str] = Query(default=[]),
    collection: str = Query("records", pattern="^(records|games)$"),
    db: Session = Depends(get_db),
):
    normalized = [k.strip().lower() for k in kw if k.strip()]

    if collection == "games":
        all_items = db.query(Game).all()
        kw_fn = game_keywords
        matching = [g for g in all_items if all(k in kw_fn(g) for k in normalized)] if normalized else list(all_items)
        sample = random.sample(matching, min(3, len(matching)))
        related: set[str] = set()
        for g in matching:
            related |= kw_fn(g)
        related -= set(normalized)
        related_list = random.sample(sorted(related), min(8, len(related)))
        return SuggestionsResponse(games=sample, related_keywords=related_list, total=len(matching))
    else:
        all_items = db.query(Record).all()
        kw_fn = record_keywords
        matching = [r for r in all_items if all(k in kw_fn(r) for k in normalized)] if normalized else list(all_items)
        sample = random.sample(matching, min(3, len(matching)))
        related: set[str] = set()
        for r in matching:
            related |= kw_fn(r)
        related -= set(normalized)
        related_list = random.sample(sorted(related), min(8, len(related)))
        return SuggestionsResponse(records=sample, related_keywords=related_list, total=len(matching))


@router.get("/related/{item_id}", response_model=RelatedResponse)
def get_related(
    item_id: int,
    collection: str = Query("records", pattern="^(records|games)$"),
    db: Session = Depends(get_db),
):
    if collection == "games":
        all_items = db.query(Game).all()
        kw_fn = game_keywords
        response_model = GameResponse
    else:
        all_items = db.query(Record).all()
        kw_fn = record_keywords
        response_model = RecordResponse

    target = next((x for x in all_items if x.id == item_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Item not found")

    target_kws = kw_fn(target)
    others = [x for x in all_items if x.id != item_id]
    if not others:
        return RelatedResponse()

    scored = sorted(
        [(x, jaccard(target_kws, kw_fn(x))) for x in others],
        key=lambda p: p[1],
        reverse=True,
    )
    similar = [x for x, _ in scored[:2]]
    similar_ids = {x.id for x in similar}
    different = [x for x, _ in reversed(scored) if x.id not in similar_ids][:2]

    return RelatedResponse(similar=similar, different=different)
