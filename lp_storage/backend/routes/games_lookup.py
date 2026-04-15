from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from schemas import BGGCandidate
from services import bgg

router = APIRouter(tags=["games-lookup"])


@router.get("/search", response_model=list[BGGCandidate])
async def search_games(
    q: str = Query(..., min_length=1, description="Game title to search"),
):
    try:
        return await bgg.search_games(q)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"BGG search failed: {exc}")


@router.get("/game/{bgg_id}")
async def get_game(bgg_id: str):
    """Fetch full metadata for a single BGG game ID."""
    try:
        result = await bgg.get_game(bgg_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"BGG fetch failed: {exc}")
    if not result:
        raise HTTPException(status_code=404, detail="Game not found on BGG")
    return result


@router.get("/barcode/{barcode}", response_model=list[BGGCandidate])
async def lookup_barcode(barcode: str):
    """
    Look up a board game by barcode (UPC/EAN).
    Resolves the product name via UPCitemdb, then searches BGG.
    """
    product_name = await bgg.lookup_barcode(barcode)
    if not product_name:
        raise HTTPException(status_code=404, detail="Barcode not found — try searching by title")
    try:
        results = await bgg.search_games(product_name)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"BGG search failed: {exc}")
    if not results:
        raise HTTPException(status_code=404, detail=f"No BGG results for '{product_name}'")
    return results


class ImportRequest(BaseModel):
    username: str


@router.post("/import-bgg")
async def import_bgg_collection(payload: ImportRequest):
    """
    Fetch a BGG user's owned collection. Returns a list of games to preview
    before the user selects which ones to add.
    """
    if not payload.username.strip():
        raise HTTPException(status_code=422, detail="Username is required")
    try:
        games = await bgg.get_user_collection(payload.username.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    if not games:
        raise HTTPException(status_code=404, detail="No owned games found for that username")
    return games
