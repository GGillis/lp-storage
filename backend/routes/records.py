from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Record, RecordTag
from schemas import RecordCreate, RecordResponse, TagCreate
from services import discogs

router = APIRouter(tags=["records"])


def _get_or_404(record_id: int, db: Session) -> Record:
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


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
        # Search within the tracklist JSON blob for matching track titles
        query = query.filter(Record.tracklist.ilike(f'%{track}%'))
    if year_from is not None:
        query = query.filter(Record.year >= year_from)
    if year_to is not None:
        query = query.filter(Record.year <= year_to)
    return query.order_by(Record.date_added.desc()).all()


@router.get("/random", response_model=list[RecordResponse])
def random_records(limit: int = 50, db: Session = Depends(get_db)):
    from sqlalchemy.sql.expression import func
    return db.query(Record).order_by(func.random()).limit(limit).all()


@router.get("/{record_id}", response_model=RecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db)):
    return _get_or_404(record_id, db)


@router.post("/", response_model=RecordResponse, status_code=201)
async def create_record(payload: RecordCreate, db: Session = Depends(get_db)):
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
