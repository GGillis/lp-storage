from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, func, select
from database import get_db
from models import Game, GameTag, GamePlay
from schemas import GameCreate, GameResponse, TagCreate, PlayStats
from services import bgg

router = APIRouter(tags=["games"])


def _get_or_404(game_id: int, db: Session) -> Game:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


_SORT_MAP = {
    "date_desc":   desc(Game.date_added),
    "date_asc":    asc(Game.date_added),
    "title_asc":   asc(Game.title),
    "title_desc":  desc(Game.title),
    "year_asc":    asc(Game.year),
    "year_desc":   desc(Game.year),
    "rating_desc": desc(Game.bgg_rating),
}

_PLAY_SORT_KEYS = frozenset({"plays_desc", "last_played_desc", "last_played_asc", "first_played_desc", "first_played_asc"})


def _play_subquery():
    return (
        select(
            GamePlay.game_id.label("game_id"),
            func.count(GamePlay.id).label("play_count"),
            func.min(GamePlay.played_at).label("first_played"),
            func.max(GamePlay.played_at).label("last_played"),
        )
        .group_by(GamePlay.game_id)
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


@router.get("/", response_model=list[GameResponse])
def list_games(
    title: Optional[str] = None,
    designer: Optional[str] = None,
    category: Optional[str] = None,
    mechanic: Optional[str] = None,
    tag: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    players: Optional[int] = None,
    never_played: bool = False,
    sort: Optional[str] = "date_desc",
    db: Session = Depends(get_db),
):
    query = db.query(Game)
    if title:
        query = query.filter(Game.title.ilike(f"%{title}%"))
    if designer:
        query = query.filter(Game.designers.ilike(f"%{designer}%"))
    if category:
        query = query.filter(Game.categories.ilike(f"%{category}%"))
    if mechanic:
        query = query.filter(Game.mechanics.ilike(f"%{mechanic}%"))
    if tag:
        query = query.filter(
            Game.tag_objects.any(GameTag.tag == tag.strip().lower())
        )
    if year_from is not None:
        query = query.filter(Game.year >= year_from)
    if year_to is not None:
        query = query.filter(Game.year <= year_to)
    if players is not None:
        query = query.filter(Game.min_players <= players, Game.max_players >= players)

    if sort in _PLAY_SORT_KEYS or never_played:
        sq = _play_subquery()
        query = query.outerjoin(sq, Game.id == sq.c.game_id)
        if never_played:
            query = query.filter(sq.c.play_count == None)
        if sort in _PLAY_SORT_KEYS:
            order = _play_order(sort, sq)
        else:
            order = _SORT_MAP.get(sort, desc(Game.date_added))
    else:
        order = _SORT_MAP.get(sort, desc(Game.date_added))

    return query.order_by(order).all()


@router.get("/random", response_model=list[GameResponse])
def random_games(limit: int = 50, db: Session = Depends(get_db)):
    from sqlalchemy.sql.expression import func as sqlfunc
    return db.query(Game).order_by(sqlfunc.random()).limit(limit).all()


@router.get("/{game_id}", response_model=GameResponse)
def get_game(game_id: int, db: Session = Depends(get_db)):
    return _get_or_404(game_id, db)


@router.post("/", response_model=GameResponse, status_code=201)
async def create_game(payload: GameCreate, db: Session = Depends(get_db)):
    if payload.bgg_id:
        existing = db.query(Game).filter(Game.bgg_id == payload.bgg_id).first()
        if existing:
            added = existing.date_added.strftime("%-d %b %Y")
            raise HTTPException(
                status_code=409,
                detail=f"Already in your collection (added {added})",
            )

    data = payload.model_dump(exclude={"cover_url", "tags"})

    if payload.cover_url and not data.get("cover_path"):
        cover_id = payload.bgg_id or "manual"
        local_path = await bgg.download_cover(payload.cover_url, cover_id)
        if local_path:
            data["cover_path"] = local_path

    db_game = Game(**data)
    for tag in payload.tags:
        db_game.tag_objects.append(GameTag(tag=tag))

    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game


@router.delete("/{game_id}", status_code=204)
def delete_game(game_id: int, db: Session = Depends(get_db)):
    game = _get_or_404(game_id, db)
    db.delete(game)
    db.commit()


@router.get("/{game_id}/cover")
def get_cover(game_id: int, db: Session = Depends(get_db)):
    game = _get_or_404(game_id, db)
    if not game.cover_path:
        raise HTTPException(status_code=404, detail="Cover not found")
    return FileResponse(game.cover_path, media_type="image/jpeg")


# ── Tag endpoints ──────────────────────────────────────────────────────────────

@router.get("/{game_id}/tags", response_model=list[str])
def list_tags(game_id: int, db: Session = Depends(get_db)):
    return _get_or_404(game_id, db).tags


@router.post("/{game_id}/tags", response_model=list[str], status_code=201)
def add_tag(game_id: int, payload: TagCreate, db: Session = Depends(get_db)):
    game = _get_or_404(game_id, db)
    if not any(t.tag == payload.tag for t in game.tag_objects):
        game.tag_objects.append(GameTag(game_id=game_id, tag=payload.tag))
        db.commit()
        db.refresh(game)
    return game.tags


@router.delete("/{game_id}/tags/{tag}", response_model=list[str])
def remove_tag(game_id: int, tag: str, db: Session = Depends(get_db)):
    game = _get_or_404(game_id, db)
    tag = tag.strip().lower()
    existing = next((t for t in game.tag_objects if t.tag == tag), None)
    if not existing:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(existing)
    db.commit()
    db.refresh(game)
    return game.tags


# ── Play endpoints ─────────────────────────────────────────────────────────────

def _play_stats(game_id: int, db: Session) -> dict:
    row = db.query(
        func.count(GamePlay.id).label("plays"),
        func.min(GamePlay.played_at).label("first_played"),
        func.max(GamePlay.played_at).label("last_played"),
    ).filter(GamePlay.game_id == game_id).first()
    return {
        "plays": row.plays or 0,
        "first_played": row.first_played,
        "last_played": row.last_played,
    }


@router.get("/{game_id}/plays", response_model=PlayStats)
def get_plays(game_id: int, db: Session = Depends(get_db)):
    _get_or_404(game_id, db)
    return _play_stats(game_id, db)


@router.post("/{game_id}/plays", response_model=PlayStats, status_code=201)
def log_play(game_id: int, db: Session = Depends(get_db)):
    _get_or_404(game_id, db)
    db.add(GamePlay(game_id=game_id, played_at=datetime.now(timezone.utc)))
    db.commit()
    return _play_stats(game_id, db)


@router.delete("/{game_id}/plays/last", response_model=PlayStats)
def undo_last_play(game_id: int, db: Session = Depends(get_db)):
    _get_or_404(game_id, db)
    last = (
        db.query(GamePlay)
        .filter(GamePlay.game_id == game_id)
        .order_by(desc(GamePlay.played_at))
        .first()
    )
    if not last:
        raise HTTPException(status_code=404, detail="No plays to undo")
    db.delete(last)
    db.commit()
    return _play_stats(game_id, db)
