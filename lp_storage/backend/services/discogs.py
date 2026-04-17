"""
Discogs API service.

Docs: https://www.discogs.com/developers
Auth: Personal access token via Authorization header.
Rate limit: 60 req/min (authenticated).
"""

import json
import os
import re
from datetime import datetime, timezone
from typing import Optional

import httpx

from schemas import DiscogsCandidate, MasterCandidate

DISCOGS_TOKEN = os.getenv("DISCOGS_TOKEN", "")
DISCOGS_USER_AGENT = os.getenv("DISCOGS_USER_AGENT", "LPStorage/0.1")
COVERS_DIR = os.getenv(
    "COVERS_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "covers")
)
BASE_URL = "https://api.discogs.com"


def _headers() -> dict:
    return {
        "User-Agent": DISCOGS_USER_AGENT,
        "Authorization": f"Discogs token={DISCOGS_TOKEN}",
    }


def _clean_artist(name: str) -> str:
    """Remove Discogs disambiguation suffixes like '(2)' from artist names."""
    return re.sub(r"\s*\(\d+\)\s*$", "", name).strip()


def _parse_search_result(item: dict) -> DiscogsCandidate:
    """
    Parse a release search result into a DiscogsCandidate.
    Discogs combines artist + album as "Artist - Title" in the title field.
    """
    raw_title = item.get("title", "")
    if " - " in raw_title:
        artist_part, album_part = raw_title.split(" - ", 1)
        artist = _clean_artist(artist_part.strip())
        title = album_part.strip()
    else:
        artist = "Unknown"
        title = raw_title

    labels = item.get("label", [])
    formats = item.get("format", [])
    year_raw = item.get("year")
    catno = item.get("catno") or item.get("catalog_number")

    return DiscogsCandidate(
        discogs_id=str(item["id"]),
        title=title,
        artist=artist,
        year=int(year_raw) if year_raw and str(year_raw).isdigit() else None,
        label=labels[0] if labels else None,
        catalog_number=catno if catno and catno != "none" else None,
        format=", ".join(formats) if formats else None,
        country=item.get("country"),
        cover_url=item.get("cover_image") or item.get("thumb"),
        resource_url=item.get("resource_url", ""),
    )


def _parse_master_result(item: dict) -> MasterCandidate:
    """Parse a master search result."""
    raw_title = item.get("title", "")
    if " - " in raw_title:
        artist_part, album_part = raw_title.split(" - ", 1)
        artist = _clean_artist(artist_part.strip())
        title = album_part.strip()
    else:
        artist = "Unknown"
        title = raw_title

    year_raw = item.get("year")

    return MasterCandidate(
        master_id=str(item["id"]),
        title=title,
        artist=artist,
        year=int(year_raw) if year_raw and str(year_raw).isdigit() else None,
        genre=item.get("genre", [None])[0] if item.get("genre") else None,
        cover_url=item.get("cover_image") or item.get("thumb"),
    )


async def search_by_barcode(barcode: str) -> list[DiscogsCandidate]:
    """Search by UPC/EAN barcode. Discogs indexes barcodes on releases."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/database/search",
            params={"barcode": barcode, "type": "release", "format": "Vinyl", "per_page": 10, "page": 1},
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
    return [_parse_search_result(r) for r in resp.json().get("results", [])]


async def search_by_deadwax(matrix: str) -> list[DiscogsCandidate]:
    """Search by dead wax / matrix code etched in the runout groove."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/database/search",
            params={"q": matrix, "type": "release", "format": "Vinyl", "per_page": 10, "page": 1},
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
    return [_parse_search_result(r) for r in resp.json().get("results", [])]


async def search_by_catno(catno: str) -> list[DiscogsCandidate]:
    """Search by catalog number, vinyl releases only."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/database/search",
            params={"catno": catno, "type": "release", "format": "Vinyl", "per_page": 10, "page": 1},
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
    return [_parse_search_result(r) for r in resp.json().get("results", [])]


async def search_masters(q: str, limit: int = 8) -> list[MasterCandidate]:
    """Search for master releases (one per album, all formats grouped)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/database/search",
            params={"q": q, "type": "master", "per_page": limit, "page": 1},
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
    return [_parse_master_result(r) for r in resp.json().get("results", [])]


async def get_master_versions(master_id: str) -> list[DiscogsCandidate]:
    """Get vinyl-only pressings of a master release, sorted by year."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/masters/{master_id}/versions",
            params={"format": "Vinyl", "per_page": 25, "page": 1, "sort": "released", "sort_order": "asc"},
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()

    versions = resp.json().get("versions", [])
    results = []
    for v in versions:
        catno = v.get("catno")
        results.append(DiscogsCandidate(
            discogs_id=str(v["id"]),
            title=v.get("title", ""),
            artist=_clean_artist(v.get("artist", "Unknown")),
            year=v.get("released") or None,
            label=v.get("label"),
            catalog_number=catno if catno and catno != "none" else None,
            format=v.get("format"),
            country=v.get("country"),
            cover_url=v.get("thumb"),
            resource_url=v.get("resource_url", ""),
        ))
    return results


async def search(q: str, limit: int = 5) -> list[DiscogsCandidate]:
    """Legacy free-text release search (kept for direct use if needed)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/database/search",
            params={"q": q, "type": "release", "per_page": limit, "page": 1},
            headers=_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
    return [_parse_search_result(item) for item in resp.json().get("results", [])]


async def get_release(discogs_id: str) -> Optional[dict]:
    """
    Fetch full release metadata and marketplace lowest price.
    Returns a dict ready to populate RecordCreate (plus cover_url).
    """
    async with httpx.AsyncClient() as client:
        release_resp = await client.get(
            f"{BASE_URL}/releases/{discogs_id}",
            headers=_headers(),
            timeout=10.0,
        )
        if release_resp.status_code == 404:
            return None
        release_resp.raise_for_status()
        release = release_resp.json()

        # Marketplace stats — best-effort, don't fail if unavailable
        lowest_price: Optional[float] = None
        price_currency: Optional[str] = None
        try:
            stats_resp = await client.get(
                f"{BASE_URL}/marketplace/stats/{discogs_id}",
                headers=_headers(),
                timeout=10.0,
            )
            if stats_resp.status_code == 200:
                lp = stats_resp.json().get("lowest_price")
                if lp:
                    lowest_price = lp.get("value")
                    price_currency = lp.get("currency")
        except Exception:
            pass

    artists = release.get("artists", [])
    artist = _clean_artist(artists[0]["name"]) if artists else "Unknown"

    genres: list[str] = release.get("genres", [])
    styles: list[str] = release.get("styles", [])

    labels = release.get("labels", [])
    label = labels[0]["name"] if labels else None

    formats = release.get("formats", [])
    fmt = formats[0]["name"] if formats else None

    # Catalog number from labels list
    catno = labels[0].get("catno") if labels else None

    images = release.get("images", [])
    cover_url: Optional[str] = None
    if images:
        primary = next(
            (img for img in images if img.get("type") == "primary"), images[0]
        )
        cover_url = primary.get("uri") or primary.get("uri150")

    tracklist = [
        {
            "position": t.get("position"),
            "title": t.get("title"),
            "duration": t.get("duration"),
        }
        for t in release.get("tracklist", [])
        if t.get("type_", "track") == "track" or not t.get("type_")
    ]

    return {
        "discogs_id": str(release["id"]),
        "title": release.get("title", ""),
        "artist": artist,
        "year": release.get("year"),
        "genre": genres[0] if genres else None,
        "styles": ", ".join(styles) if styles else None,
        "label": label,
        "catalog_number": catno if catno and catno != "none" else None,
        "country": release.get("country"),
        "format": fmt,
        "tracklist": json.dumps(tracklist),
        "cover_url": cover_url,
        "lowest_price": lowest_price,
        "price_currency": price_currency,
        "price_checked_at": datetime.now(timezone.utc).isoformat(),
    }


async def download_cover(url: str, discogs_id: str) -> Optional[str]:
    """
    Download a cover image and save it to COVERS_DIR/{discogs_id}.jpg.
    Returns the local file path on success, None on failure.
    """
    dest_path = os.path.join(COVERS_DIR, f"{discogs_id}.jpg")
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(url, headers=_headers(), timeout=15.0)
            resp.raise_for_status()
        os.makedirs(COVERS_DIR, exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(resp.content)
        return dest_path
    except Exception:
        return None
