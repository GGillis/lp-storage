from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, func, select
from database import get_db
from models import Record, RecordTag, RecordPlay
from schemas import RecordCreate, RecordResponse, TagCreate, PlayStats
from services import discogs

router = APIRouter(tags=["records"])


def _get_or_404(record_id: int, db: Session) -> Record:
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


_SORT_MAP = {
    "date_desc":   desc(Record.date_added),
    "date_asc":    asc(Record.date_added),
    "artist_asc":  asc(Record.artist),
    "artist_desc": desc(Record.artist),
    "title_asc":   asc(Record.title),
    "year_asc":    asc(Record.year),
    "year_desc":   desc(Record.year),
}

_PLAY_SORT_KEYS = frozenset({"plays_desc", "last_played_desc", "last_played_asc", "first_played_desc", "first_played_asc"})


def _play_subquery():
    return (
        select(
            RecordPlay.record_id.label("record_id"),
            func.count(RecordPlay.id).label("play_count"),
            func.min(RecordPlay.played_at).label("first_played"),
            func.max(RecordPlay.played_at).label("last_played"),
        )
        .group_by(RecordPlay.record_id)
        .subquery()
    )


def _play_order(sort: str, sq):
    if sort == "plays_desc":
        return desc(sq.c.play_count).nulls_last()
    if sort == "last_played_desc":
        return desc(sq.c.last_played).nulls_last()
    if sort == "last_played_asc":
        return asc(sq.c.last_played).nulls_last()
    if sort == "first_played_desc":
        return desc(sq.c.first_played).nulls_last()
    return asc(sq.c.first_played).nulls_last()  # first_played_asc


@router.get("/", response_model=list[RecordResponse])
def list_records(
    artist: Optional[str] = None,
    title: Optional[str] = None,
    genre: Optional[str] = None,
    style: Optional[str] = None,
    tag: Optional[str] = None,
    track: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    never_played: bool = False,
    sort: Optional[str] = "date_desc",
    db: Session = Depends(get_db),
):
    query = db.query(Record)
    if artist:
        query = query.filter(Record.artist.ilike(f"%{artist}%"))
    if title:
        query = query.filter(Record.title.ilike(f"%{title}%"))
    if genre:
        query = query.filter(Record.genre.ilike(f"%{genre}%"))
    if style:
        query = query.filter(Record.styles.ilike(f"%{style}%"))
    if tag:
        query = query.filter(
            Record.tag_objects.any(RecordTag.tag == tag.strip().lower())
        )
    if track:
        query = query.filter(Record.tracklist.ilike(f'%{track}%'))
    if year_from is not None:
        query = query.filter(Record.year >= year_from)
    if year_to is not None:
        query = query.filter(Record.year <= year_to)

    if sort in _PLAY_SORT_KEYS or never_played:
        sq = _play_subquery()
        query = query.outerjoin(sq, Record.id == sq.c.record_id)
        if never_played:
            query = query.filter(sq.c.play_count == None)
        if sort in _PLAY_SORT_KEYS:
            order = _play_order(sort, sq)
        else:
            order = _SORT_MAP.get(sort, desc(Record.date_added))
    else:
        order = _SORT_MAP.get(sort, desc(Record.date_added))

    return query.order_by(order).all()


@router.get("/random", response_model=list[RecordResponse])
def random_records(limit: int = 50, db: Session = Depends(get_db)):
    from sqlalchemy.sql.expression import func as sqlfunc
    return db.query(Record).order_by(sqlfunc.random()).limit(limit).all()


@router.get("/{record_id}", response_model=RecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db)):
    return _get_or_404(record_id, db)


@router.post("/", response_model=RecordResponse, status_code=201)
async def create_record(payload: RecordCreate, db: Session = Depends(get_db)):
    if payload.discogs_id:
        existing = db.query(Record).filter(Record.discogs_id == payload.discogs_id).first()
        if existing:
            added = existing.date_added.strftime("%-d %b %Y")
            raise HTTPException(
                status_code=409,
                detail=f"Already in your collection (added {added})",
            )

    data = payload.model_dump(exclude={"cover_url", "tags"})

    if payload.cover_url and not data.get("cover_path"):
        cover_id = payload.discogs_id or "manual"
        local_path = await discogs.download_cover(payload.cover_url, cover_id)
        if local_path:
            data["cover_path"] = local_path

    if data.get("lowest_price") is not None and not data.get("price_checked_at"):
        data["price_checked_at"] = datetime.now(timezone.utc)

    db_record = Record(**data)
    for tag in payload.tags:
        db_record.tag_objects.append(RecordTag(tag=tag))

    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.delete("/{record_id}", status_code=204)
def delete_record(record_id: int, db: Session = Depends(get_db)):
    record = _get_or_404(record_id, db)
    db.delete(record)
    db.commit()


@router.get("/{record_id}/cover")
def get_cover(record_id: int, db: Session = Depends(get_db)):
    record = _get_or_404(record_id, db)
    if not record.cover_path:
        raise HTTPException(status_code=404, detail="Cover not found")
    return FileResponse(record.cover_path, media_type="image/jpeg")


# ── Tag endpoints ──────────────────────────────────────────────────────────────

@router.get("/{record_id}/tags", response_model=list[str])
def list_tags(record_id: int, db: Session = Depends(get_db)):
    record = _get_or_404(record_id, db)
    return record.tags


@router.post("/{record_id}/tags", response_model=list[str], status_code=201)
def add_tag(record_id: int, payload: TagCreate, db: Session = Depends(get_db)):
    record = _get_or_404(record_id, db)
    if not any(t.tag == payload.tag for t in record.tag_objects):
        record.tag_objects.append(RecordTag(record_id=record_id, tag=payload.tag))
        db.commit()
        db.refresh(record)
    return record.tags


@router.delete("/{record_id}/tags/{tag}", response_model=list[str])
def remove_tag(record_id: int, tag: str, db: Session = Depends(get_db)):
    record = _get_or_404(record_id, db)
    tag = tag.strip().lower()
    existing = next((t for t in record.tag_objects if t.tag == tag), None)
    if not existing:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(existing)
    db.commit()
    db.refresh(record)
    return record.tags


# ── Play endpoints ─────────────────────────────────────────────────────────────

def _play_stats(record_id: int, db: Session) -> dict:
    row = db.query(
        func.count(RecordPlay.id).label("plays"),
        func.min(RecordPlay.played_at).label("first_played"),
        func.max(RecordPlay.played_at).label("last_played"),
    ).filter(RecordPlay.record_id == record_id).first()
    return {
        "plays": row.plays or 0,
        "first_played": row.first_played,
        "last_played": row.last_played,
    }


@router.get("/{record_id}/plays", response_model=PlayStats)
def get_plays(record_id: int, db: Session = Depends(get_db)):
    _get_or_404(record_id, db)
    return _play_stats(record_id, db)


@router.post("/{record_id}/plays", response_model=PlayStats, status_code=201)
def log_play(record_id: int, db: Session = Depends(get_db)):
    _get_or_404(record_id, db)
    db.add(RecordPlay(record_id=record_id, played_at=datetime.now(timezone.utc)))
    db.commit()
    return _play_stats(record_id, db)


@router.delete("/{record_id}/plays/last", response_model=PlayStats)
def undo_last_play(record_id: int, db: Session = Depends(get_db)):
    _get_or_404(record_id, db)
    last = (
        db.query(RecordPlay)
        .filter(RecordPlay.record_id == record_id)
        .order_by(desc(RecordPlay.played_at))
        .first()
    )
    if not last:
        raise HTTPException(status_code=404, detail="No plays to undo")
    db.delete(last)
    db.commit()
    return _play_stats(record_id, db)
