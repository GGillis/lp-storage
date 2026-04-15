"""
Explore API — keyword-driven record discovery.

Keywords are derived from:
  - genre (single value, may be comma-separated in edge cases)
  - styles (comma-separated string, e.g. "Psychedelic Rock, Blues Rock")
  - user tags
  - decade (year grouped to 10-year bands, e.g. 1973 → "1970s")
"""

import random
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Record
from schemas import RecordResponse

router = APIRouter(tags=["explore"])


# ── Keyword utilities ─────────────────────────────────────────────────────────

def decade_label(year: int) -> str:
    """1973 → '1970s', 2005 → '2000s'"""
    return f"{(year // 10) * 10}s"


def record_keywords(record: Record) -> set[str]:
    """All searchable keywords for a record."""
    kws: set[str] = set()
    if record.genre:
        for g in record.genre.split(","):
            g = g.strip().lower()
            if g:
                kws.add(g)
    if record.styles:
        for s in record.styles.split(","):
            s = s.strip().lower()
            if s:
                kws.add(s)
    for tag in record.tags:
        kws.add(tag.lower())
    if record.year:
        kws.add(decade_label(record.year))
    return kws


def jaccard(a: set, b: set) -> float:
    union = a | b
    return len(a & b) / len(union) if union else 0.0


# ── Response models ───────────────────────────────────────────────────────────

class SuggestionsResponse(BaseModel):
    records: list[RecordResponse]
    related_keywords: list[str]
    total: int

    model_config = {"from_attributes": True}


class RelatedResponse(BaseModel):
    similar: list[RecordResponse]
    different: list[RecordResponse]

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/keywords")
def get_keywords(db: Session = Depends(get_db)) -> dict:
    """All unique keywords in the collection, grouped by type."""
    records = db.query(Record).all()
    genres: set[str] = set()
    styles: set[str] = set()
    tags: set[str] = set()
    decades: set[str] = set()

    for r in records:
        if r.genre:
            for g in r.genre.split(","):
                g = g.strip().lower()
                if g:
                    genres.add(g)
        if r.styles:
            for s in r.styles.split(","):
                s = s.strip().lower()
                if s:
                    styles.add(s)
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
    db: Session = Depends(get_db),
):
    """
    Up to 3 random records matching ALL given keywords, plus related keywords
    drawn from the full matching set (useful for refinement chips in the UI).
    """
    all_records = db.query(Record).all()
    normalized = [k.strip().lower() for k in kw if k.strip()]

    if normalized:
        matching = [
            r for r in all_records
            if all(k in record_keywords(r) for k in normalized)
        ]
    else:
        matching = list(all_records)

    sample = random.sample(matching, min(3, len(matching)))

    # Gather keywords from the entire matching set, then remove already-active ones
    related: set[str] = set()
    for r in matching:
        related |= record_keywords(r)
    related -= set(normalized)

    related_list = random.sample(sorted(related), min(8, len(related)))

    return SuggestionsResponse(
        records=sample,
        related_keywords=related_list,
        total=len(matching),
    )


@router.get("/related/{record_id}", response_model=RelatedResponse)
def get_related(record_id: int, db: Session = Depends(get_db)):
    """
    2 most similar and 2 most different records for the given record,
    ranked by Jaccard similarity on their keyword sets.
    """
    all_records = db.query(Record).all()
    target = next((r for r in all_records if r.id == record_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Record not found")

    target_kws = record_keywords(target)
    others = [r for r in all_records if r.id != record_id]

    if not others:
        return RelatedResponse(similar=[], different=[])

    scored = sorted(
        [(r, jaccard(target_kws, record_keywords(r))) for r in others],
        key=lambda x: x[1],
        reverse=True,
    )

    similar = [r for r, _ in scored[:2]]
    similar_ids = {r.id for r in similar}

    # Most different: walk from the bottom, skip any already in similar
    different_candidates = [r for r, _ in reversed(scored) if r.id not in similar_ids]
    different = different_candidates[:2]

    return RelatedResponse(similar=similar, different=different)
