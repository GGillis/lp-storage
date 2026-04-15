"""
Collection statistics for records and games.
"""

import json
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Record, Game

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


def _build_breakdown(items, key_fn, value_fn=None) -> list[dict]:
    """
    Group items by key_fn(item) → str.
    value_fn(item) → float for the value column (optional).
    """
    buckets: dict[str, dict] = defaultdict(lambda: {"count": 0, "value": 0.0})
    for item in items:
        k = key_fn(item)
        if not k:
            continue
        buckets[k]["count"] += 1
        if value_fn:
            v = value_fn(item)
            if v:
                buckets[k]["value"] += v
    return sorted(
        [{"label": k, "records": v["count"], "value": round(v["value"], 2)} for k, v in buckets.items()],
        key=lambda x: x["records"],
        reverse=True,
    )


# ── Record-specific ───────────────────────────────────────────────────────────

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
        total_seconds = sum(_record_seconds(r) for r in records)
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
            ),
            "by_genre": _build_breakdown(
                records,
                lambda r: r.genre.strip() if r.genre else None,
                lambda r: float(r.lowest_price) if r.lowest_price else None,
            ),
        }
