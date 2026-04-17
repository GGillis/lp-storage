from fastapi import APIRouter, HTTPException, Query
from schemas import DiscogsCandidate, MasterCandidate
from services import discogs

router = APIRouter(tags=["lookup"])


@router.get("/catno", response_model=list[DiscogsCandidate])
async def search_by_catno(
    q: str = Query(..., min_length=1, description="Catalog number printed on the record label"),
):
    """Search vinyl releases by catalog number. Returns tight, accurate results."""
    try:
        return await discogs.search_by_catno(q)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Discogs search failed: {exc}")


@router.get("/masters", response_model=list[MasterCandidate])
async def search_masters(
    q: str = Query(..., min_length=1, description="Artist and/or album title"),
):
    """Search for master releases (one result per album, all formats grouped)."""
    try:
        return await discogs.search_masters(q)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Discogs search failed: {exc}")


@router.get("/masters/{master_id}/versions", response_model=list[DiscogsCandidate])
async def get_master_versions(master_id: str):
    """Get vinyl-only pressings of a master release, sorted by year."""
    try:
        return await discogs.get_master_versions(master_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Discogs fetch failed: {exc}")


@router.get("/release/{discogs_id}")
async def get_release(discogs_id: str):
    """Fetch full release metadata + marketplace lowest price."""
    try:
        release = await discogs.get_release(discogs_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Discogs fetch failed: {exc}")
    if not release:
        raise HTTPException(status_code=404, detail="Release not found on Discogs")
    return release


@router.get("/deadwax", response_model=list[DiscogsCandidate])
async def search_by_deadwax(
    q: str = Query(..., min_length=1, description="Dead wax / matrix code etched in the runout groove"),
):
    """Search vinyl releases by dead wax (matrix) code."""
    try:
        results = await discogs.search_by_deadwax(q)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Discogs search failed: {exc}")
    if not results:
        raise HTTPException(status_code=404, detail="No vinyl releases found for that matrix code")
    return results


@router.get("/barcode/{barcode}", response_model=list[DiscogsCandidate])
async def lookup_barcode(barcode: str):
    """Search vinyl releases by UPC/EAN barcode."""
    try:
        results = await discogs.search_by_barcode(barcode)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Discogs search failed: {exc}")
    if not results:
        raise HTTPException(status_code=404, detail="No vinyl releases found for that barcode — try searching by title")
    return results
