"""
Collection statistics.

All heavy lifting is done in Python so the frontend stays thin.
Duration strings from Discogs look like "3:45" or "1:02:34".
"""

import json
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Record

router = APIRouter(tags=["stats"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_duration(s: str) -> int:
    """Parse 'MM:SS' or 'H:MM:SS' to total seconds. Returns 0 on failure."""
    try:
        parts = [int(p) for p in s.strip().split(":")]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
    except Exception:
        pass
    return 0


def _record_duration(record: Record) -> int:
    """Sum of all track durations in seconds for one record."""
    if not record.tracklist:
        return 0
    try:
        tracks = json.loads(record.tracklist)
    except Exception:
        return 0
    return sum(_parse_duration(t.get("duration", "")) for t in tracks)


def _format_duration(seconds: int) -> str:
    """Format seconds as 'X h Y min', or 'Y min' if under an hour."""
    h = seconds // 3600
    m = (seconds % 3600) // 60
    if h:
        return f"{h} h {m} min"
    return f"{m} min"


def _decade(year: int) -> str:
    return f"{(year // 10) * 10}s"


def _build_breakdown(records: list[Record], key_fn) -> list[dict]:
    """
    Group records by key_fn(record) → str.
    Returns list sorted by record count desc, skipping None keys.
    """
    buckets: dict[str, dict] = defaultdict(lambda: {"records": 0, "duration_seconds": 0, "value": 0.0, "currency": None})
    for r in records:
        k = key_fn(r)
        if not k:
            continue
        b = buckets[k]
        b["records"] += 1
        b["duration_seconds"] += _record_duration(r)
        if r.lowest_price:
            b["value"] += float(r.lowest_price)
            if not b["currency"] and r.price_currency:
                b["currency"] = r.price_currency

    return sorted(
        [{"label": k, **v, "duration": _format_duration(v["duration_seconds"])} for k, v in buckets.items()],
        key=lambda x: x["records"],
        reverse=True,
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/")
def get_stats(db: Session = Depends(get_db)):
    records = db.query(Record).all()

    total_records = len(records)
    total_seconds = sum(_record_duration(r) for r in records)
    total_value = sum(float(r.lowest_price) for r in records if r.lowest_price)

    # Most common currency for the value total
    currency_counts: dict[str, int] = defaultdict(int)
    for r in records:
        if r.price_currency:
            currency_counts[r.price_currency] += 1
    primary_currency = max(currency_counts, key=currency_counts.get) if currency_counts else None

    return {
        "totals": {
            "records": total_records,
            "duration_seconds": total_seconds,
            "duration": _format_duration(total_seconds),
            "value": round(total_value, 2),
            "currency": primary_currency,
        },
        "by_decade": _build_breakdown(
            records,
            lambda r: _decade(r.year) if r.year else None,
        ),
        "by_genre": _build_breakdown(
            records,
            lambda r: r.genre.strip() if r.genre else None,
        ),
    }
