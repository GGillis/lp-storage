"""
Collection statistics for records and games.
"""

import json
import re
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, func, select
from database import get_db
from models import Record, Game, RecordPlay, GamePlay

router = APIRouter(tags=["stats"])


# ── Shared helpers ────────────────────────────────────────────────────────────

def _decade(year: int) -> str:
    return f"{(year // 10) * 10}s"


def _format_duration(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    if h:
        return f"{h} h {m} min"
    return f"{m} min"


def _build_breakdown(items, key_fn, value_fn=None, duration_fn=None) -> list[dict]:
    """
    Group items by key_fn(item) → str.
    value_fn(item) → float for the value column (optional).
    duration_fn(item) → int seconds for the duration column (optional).
    """
    buckets: dict[str, dict] = defaultdict(lambda: {"count": 0, "value": 0.0, "duration_seconds": 0})
    for item in items:
        k = key_fn(item)
        if not k:
            continue
        buckets[k]["count"] += 1
        if value_fn:
            v = value_fn(item)
            if v:
                buckets[k]["value"] += v
        if duration_fn:
            buckets[k]["duration_seconds"] += duration_fn(item)
    return sorted(
        [
            {
                "label": k,
                "records": v["count"],
                "value": round(v["value"], 2),
                "duration_seconds": v["duration_seconds"],
                "duration": _format_duration(v["duration_seconds"]) if v["duration_seconds"] else None,
            }
            for k, v in buckets.items()
        ],
        key=lambda x: x["records"],
        reverse=True,
    )


# ── Record-specific ───────────────────────────────────────────────────────────

_SECONDS_PER_SIDE = 16 * 60  # 960 s


def _parse_duration(s: str) -> int:
    try:
        parts = [int(p) for p in s.strip().split(":")]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
    except Exception:
        pass
    return 0


def _record_seconds(r: Record) -> int:
    if not r.tracklist:
        return 0
    try:
        tracks = json.loads(r.tracklist)
    except Exception:
        return 0
    return sum(_parse_duration(t.get("duration", "")) for t in tracks)


def _estimate_sides(r: Record) -> int:
    """Count sides from tracklist position labels (A1, B2 … → 2 sides).
    Falls back to parsing the format string (2xLP → 4 sides).
    Defaults to 2 (single LP) when neither is available."""
    if r.tracklist:
        try:
            tracks = json.loads(r.tracklist)
            letters = {
                t["position"][0].upper()
                for t in tracks
                if t.get("position") and t["position"][0].isalpha()
            }
            if letters:
                return len(letters)
        except Exception:
            pass
    if r.format:
        m = re.search(r"(\d+)\s*x", r.format.lower())
        if m:
            return int(m.group(1)) * 2
    return 2


def _record_seconds_estimated(r: Record) -> int:
    """Actual tracklist duration, or 16 min/side estimate when unknown."""
    actual = _record_seconds(r)
    return actual if actual > 0 else _estimate_sides(r) * _SECONDS_PER_SIDE


# ── Game-specific ─────────────────────────────────────────────────────────────

def _game_playtime(g: Game) -> int:
    """Mid-point of playtime range in minutes, or min if no max."""
    if g.min_playtime and g.max_playtime:
        return (g.min_playtime + g.max_playtime) // 2
    return g.min_playtime or 0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def get_stats(
    collection: str = Query("records", pattern="^(records|games)$"),
    db: Session = Depends(get_db),
):
    if collection == "games":
        games = db.query(Game).all()
        total = len(games)
        total_minutes = sum(_game_playtime(g) for g in games)
        avg_rating = (
            round(sum(g.bgg_rating for g in games if g.bgg_rating) /
                  max(1, sum(1 for g in games if g.bgg_rating)), 2)
            if any(g.bgg_rating for g in games) else None
        )
        return {
            "totals": {
                "records": total,
                "duration": _format_duration(total_minutes * 60),
                "duration_seconds": total_minutes * 60,
                "avg_rating": avg_rating,
            },
            "by_decade": _build_breakdown(
                games,
                lambda g: _decade(g.year) if g.year else None,
            ),
            "by_category": _build_breakdown(
                games,
                lambda g: g.categories.split(",")[0].strip() if g.categories else None,
            ),
            "by_mechanic": _build_breakdown(
                games,
                lambda g: g.mechanics.split(",")[0].strip() if g.mechanics else None,
            ),
        }
    else:
        records = db.query(Record).all()
        total = len(records)
        total_seconds = sum(_record_seconds_estimated(r) for r in records)
        total_value = sum(float(r.lowest_price) for r in records if r.lowest_price)

        currency_counts: dict[str, int] = defaultdict(int)
        for r in records:
            if r.price_currency:
                currency_counts[r.price_currency] += 1
        primary_currency = max(currency_counts, key=currency_counts.get) if currency_counts else None

        return {
            "totals": {
                "records": total,
                "duration_seconds": total_seconds,
                "duration": _format_duration(total_seconds),
                "value": round(total_value, 2),
                "currency": primary_currency,
            },
            "by_decade": _build_breakdown(
                records,
                lambda r: _decade(r.year) if r.year else None,
                lambda r: float(r.lowest_price) if r.lowest_price else None,
                _record_seconds_estimated,
            ),
            "by_genre": _build_breakdown(
                records,
                lambda r: r.genre.strip() if r.genre else None,
                lambda r: float(r.lowest_price) if r.lowest_price else None,
                _record_seconds_estimated,
            ),
        }


_PLAYS_SORT_MAP = {
    "plays_desc":       lambda sq: desc(sq.c.play_count),
    "last_played_desc": lambda sq: desc(sq.c.last_played),
    "last_played_asc":  lambda sq: asc(sq.c.last_played),
    "first_played_desc": lambda sq: desc(sq.c.first_played),
    "first_played_asc": lambda sq: asc(sq.c.first_played),
}


@router.get("/plays")
def get_plays_leaderboard(
    collection: str = Query("records", pattern="^(records|games)$"),
    sort: str = Query("plays_desc"),
    limit: int = Query(5, le=20),
    db: Session = Depends(get_db),
):
    order_fn = _PLAYS_SORT_MAP.get(sort, _PLAYS_SORT_MAP["plays_desc"])

    if collection == "games":
        sq = (
            select(
                GamePlay.game_id.label("item_id"),
                func.count(GamePlay.id).label("play_count"),
                func.min(GamePlay.played_at).label("first_played"),
                func.max(GamePlay.played_at).label("last_played"),
            )
            .group_by(GamePlay.game_id)
            .subquery()
        )
        rows = (
            db.query(Game.id, Game.title, Game.designers, sq.c.play_count, sq.c.first_played, sq.c.last_played)
            .join(sq, Game.id == sq.c.item_id)
            .order_by(order_fn(sq))
            .limit(limit)
            .all()
        )
        return [
            {"id": r.id, "title": r.title, "subtitle": r.designers, "plays": r.play_count,
             "first_played": r.first_played, "last_played": r.last_played}
            for r in rows
        ]
    else:
        sq = (
            select(
                RecordPlay.record_id.label("item_id"),
                func.count(RecordPlay.id).label("play_count"),
                func.min(RecordPlay.played_at).label("first_played"),
                func.max(RecordPlay.played_at).label("last_played"),
            )
            .group_by(RecordPlay.record_id)
            .subquery()
        )
        rows = (
            db.query(Record.id, Record.title, Record.artist, sq.c.play_count, sq.c.first_played, sq.c.last_played)
            .join(sq, Record.id == sq.c.item_id)
            .order_by(order_fn(sq))
            .limit(limit)
            .all()
        )
        return [
            {"id": r.id, "title": r.title, "subtitle": r.artist, "plays": r.play_count,
             "first_played": r.first_played, "last_played": r.last_played}
            for r in rows
        ]
