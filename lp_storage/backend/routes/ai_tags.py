"""
AI tagging endpoints.

  POST /api/ai/suggest/records/{id}   — suggest + apply tags for one record
  POST /api/ai/suggest/games/{id}     — suggest + apply tags for one game
  GET  /api/ai/status                 — rate-limit info + batch status
  POST /api/ai/batch/start            — start background batch tagging
  POST /api/ai/batch/stop             — stop background batch
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import Record, RecordTag, Game, GameTag
from services import ai_tags

router = APIRouter(tags=["ai"])

# ── Batch state (module-level, in-memory) ─────────────────────────────────────

_batch: dict = {
    "running": False,
    "collection": None,
    "done": 0,
    "total": 0,
    "current": None,
    "errors": 0,
}
_batch_task: asyncio.Task | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _apply_record_tags(db: Session, record: Record, tags: list[str]) -> list[str]:
    existing = set(record.tags)
    for tag in tags:
        if tag not in existing:
            db.merge(RecordTag(record_id=record.id, tag=tag))
    db.commit()
    db.refresh(record)
    return record.tags


def _apply_game_tags(db: Session, game: Game, tags: list[str]) -> list[str]:
    existing = set(game.tags)
    for tag in tags:
        if tag not in existing:
            db.merge(GameTag(game_id=game.id, tag=tag))
    db.commit()
    db.refresh(game)
    return game.tags


# ── Single-item suggest endpoints ─────────────────────────────────────────────

@router.post("/suggest/records/{record_id}")
async def suggest_record_tags(record_id: int, db: Session = Depends(get_db)):
    wait = ai_tags.rate_limit_check()
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited — try again in {wait}s",
            headers={"Retry-After": str(wait)},
        )

    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    collection_tags = [t.tag for t in db.query(RecordTag).distinct(RecordTag.tag).all()]

    try:
        tags = await ai_tags.suggest_tags(ai_tags.record_prompt(record, collection_tags))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")

    updated = _apply_record_tags(db, record, tags)
    return {"tags": updated, "added": [t for t in tags if t not in set(record.tags) | set(tags)]}


@router.post("/suggest/games/{game_id}")
async def suggest_game_tags(game_id: int, db: Session = Depends(get_db)):
    wait = ai_tags.rate_limit_check()
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited — try again in {wait}s",
            headers={"Retry-After": str(wait)},
        )

    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    collection_tags = [t.tag for t in db.query(GameTag).distinct(GameTag.tag).all()]

    try:
        tags = await ai_tags.suggest_tags(ai_tags.game_prompt(game, collection_tags))
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")

    updated = _apply_game_tags(db, game, tags)
    return {"tags": updated, "added": [t for t in tags if t not in set(game.tags) | set(tags)]}


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status():
    return {
        "api_key_configured": ai_tags.api_key_configured(),
        "calls_this_minute": ai_tags.calls_this_minute(),
        "max_per_minute": 5,
        "batch": {**_batch, "task": None},  # task is not serialisable
    }


# ── Batch ─────────────────────────────────────────────────────────────────────

@router.post("/batch/start")
async def start_batch(
    collection: str = Query(..., pattern="^(records|games)$"),
    untagged_only: bool = Query(True),
):
    global _batch_task

    if _batch["running"]:
        raise HTTPException(status_code=409, detail="Batch already running")
    if not ai_tags.api_key_configured():
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not configured")

    _batch.update(running=True, collection=collection, done=0,
                  total=0, current=None, errors=0)
    _batch_task = asyncio.create_task(_run_batch(collection, untagged_only))
    return {"started": True, "collection": collection}


@router.post("/batch/stop")
def stop_batch():
    _batch["running"] = False
    if _batch_task and not _batch_task.done():
        _batch_task.cancel()
    return {"stopped": True}


async def _run_batch(collection: str, untagged_only: bool):
    db = SessionLocal()
    try:
        if collection == "records":
            items = db.query(Record).all()
            if untagged_only:
                items = [r for r in items if not r.tags]
            apply_fn = lambda item, tags: _apply_record_tags(db, item, tags)
            tag_model = RecordTag
        else:
            items = db.query(Game).all()
            if untagged_only:
                items = [g for g in items if not g.tags]
            apply_fn = lambda item, tags: _apply_game_tags(db, item, tags)
            tag_model = GameTag

        _batch["total"] = len(items)

        for item in items:
            if not _batch["running"]:
                break

            _batch["current"] = item.title

            # Re-fetch the vocabulary each iteration so newly added tags are included
            collection_tags = [t.tag for t in db.query(tag_model).distinct(tag_model.tag).all()]

            # Honour the rate limit — sleep if needed
            wait = ai_tags.rate_limit_check()
            if wait:
                await asyncio.sleep(wait)
                ai_tags.rate_limit_check()  # record the now-allowed call

            try:
                if collection == "records":
                    prompt = ai_tags.record_prompt(item, collection_tags)
                else:
                    prompt = ai_tags.game_prompt(item, collection_tags)
                tags = await ai_tags.suggest_tags(prompt)
                apply_fn(item, tags)
            except Exception:
                _batch["errors"] += 1

            _batch["done"] += 1

            # Wait 15 s between calls → max 4/min, well within free-tier limit
            if _batch["done"] < _batch["total"] and _batch["running"]:
                await asyncio.sleep(15)

    finally:
        db.close()
        _batch["running"] = False
        _batch["current"] = None
