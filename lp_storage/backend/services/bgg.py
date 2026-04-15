"""
BoardGameGeek XML API 2 service.
Docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
No authentication required. Be polite — BGG asks for max ~2 req/sec.
"""

import asyncio
import os
import xml.etree.ElementTree as ET
from typing import Optional

import httpx

BASE_URL = "https://boardgamegeek.com/xmlapi2"
COVERS_DIR = os.getenv(
    "COVERS_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "covers")
)


def _headers() -> dict:
    """Build request headers, including the BGG Bearer token if configured."""
    h = {"User-Agent": "LPStorage/1.0 (https://github.com/gilliskruisselbrink/lp-storage)"}
    token = os.getenv("BGG_TOKEN", "").strip()
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


# ── Helpers ───────────────────────────────────────────────────────────────────

def _abs(url: str | None) -> Optional[str]:
    """Make protocol-relative URLs absolute."""
    if not url or not url.strip():
        return None
    url = url.strip()
    return f"https:{url}" if url.startswith("//") else url


def _attr(el, path: str, attrib: str, default=None):
    found = el.find(path)
    return found.get(attrib, default) if found is not None else default


def _int(val) -> Optional[int]:
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _float(val) -> Optional[float]:
    try:
        v = float(val)
        return round(v, 2) if v > 0 else None
    except (TypeError, ValueError):
        return None


def _links(item, link_type: str) -> Optional[str]:
    vals = [el.get("value") for el in item.findall(f"link[@type='{link_type}']") if el.get("value")]
    return ", ".join(vals) if vals else None


# ── Search ────────────────────────────────────────────────────────────────────

async def search_games(query: str, limit: int = 10) -> list[dict]:
    """Full-text search for board games. Returns lightweight candidates."""
    async with httpx.AsyncClient(headers=_headers()) as client:
        resp = await client.get(
            f"{BASE_URL}/search",
            params={"query": query, "type": "boardgame"},
            timeout=15.0,
        )
        resp.raise_for_status()

    root = ET.fromstring(resp.text)
    results = []
    for item in root.findall("item")[:limit]:
        name_el = item.find("name[@type='primary']")
        year_el = item.find("yearpublished")
        results.append({
            "bgg_id": item.get("id"),
            "title": name_el.get("value") if name_el is not None else "Unknown",
            "year": _int(year_el.get("value")) if year_el is not None else None,
            "cover_url": None,  # search API doesn't return images
            "min_players": None,
            "max_players": None,
            "min_playtime": None,
            "max_playtime": None,
            "bgg_rating": None,
        })
    return results


# ── Full game details ─────────────────────────────────────────────────────────

async def get_game(bgg_id: str) -> Optional[dict]:
    """Fetch full metadata for a single game by BGG ID."""
    async with httpx.AsyncClient(headers=_headers()) as client:
        resp = await client.get(
            f"{BASE_URL}/thing",
            params={"id": bgg_id, "stats": 1},
            timeout=15.0,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()

    root = ET.fromstring(resp.text)
    item = root.find("item")
    if item is None:
        return None

    primary = item.find("name[@type='primary']")
    title = primary.get("value") if primary is not None else "Unknown"

    # Description may contain HTML entities — ET handles that automatically
    desc_el = item.find("description")
    description = desc_el.text if desc_el is not None else None

    # BGG rating
    avg_el = item.find(".//statistics/ratings/average")
    bgg_rating = _float(avg_el.get("value")) if avg_el is not None else None

    thumbnail = _abs(_attr(item, "thumbnail", "value") or (item.find("thumbnail").text if item.find("thumbnail") is not None else None))
    image_el = item.find("image")
    image = _abs(image_el.text if image_el is not None else None)

    return {
        "bgg_id": item.get("id"),
        "title": title,
        "year": _int(_attr(item, "yearpublished", "value")),
        "designers": _links(item, "boardgamedesigner"),
        "artists": _links(item, "boardgameartist"),
        "publisher": _links(item, "boardgamepublisher"),
        "min_players": _int(_attr(item, "minplayers", "value")),
        "max_players": _int(_attr(item, "maxplayers", "value")),
        "min_playtime": _int(_attr(item, "minplaytime", "value")),
        "max_playtime": _int(_attr(item, "maxplaytime", "value")),
        "min_age": _int(_attr(item, "minage", "value")),
        "categories": _links(item, "boardgamecategory"),
        "mechanics": _links(item, "boardgamemechanic"),
        "bgg_rating": bgg_rating,
        "description": description,
        "cover_url": image or thumbnail,
    }


# ── User collection import ────────────────────────────────────────────────────

async def get_user_collection(username: str) -> list[dict]:
    """
    Fetch all owned games from a BGG user's collection.
    BGG may return 202 (still queuing) — we retry up to 5 times.
    """
    async with httpx.AsyncClient(headers=_headers()) as client:
        for attempt in range(6):
            resp = await client.get(
                f"{BASE_URL}/collection",
                params={"username": username, "own": 1, "stats": 1, "subtype": "boardgame"},
                timeout=30.0,
            )
            if resp.status_code == 202:
                await asyncio.sleep(3)
                continue
            if resp.status_code == 401:
                raise Exception(
                    "BGG collection is private — go to boardgamegeek.com → Settings → "
                    "Privacy and set your collection to Public, then try again."
                )
            resp.raise_for_status()
            break
        else:
            raise Exception("BGG is taking too long — try again in a moment")

    root = ET.fromstring(resp.text)

    error_el = root.find("error")
    if error_el is not None:
        msg_el = error_el.find("message")
        raise Exception(msg_el.text if msg_el is not None else "BGG error")

    games = []
    for item in root.findall("item"):
        name_el = item.find("name")
        year_el = item.find("yearpublished")
        thumb_el = item.find("thumbnail")
        stats_el = item.find("stats")

        bgg_rating = None
        min_players = max_players = min_playtime = max_playtime = None

        if stats_el is not None:
            min_players = _int(stats_el.get("minplayers"))
            max_players = _int(stats_el.get("maxplayers"))
            min_playtime = _int(stats_el.get("minplaytime"))
            max_playtime = _int(stats_el.get("maxplaytime"))
            avg = stats_el.find(".//average")
            if avg is not None:
                bgg_rating = _float(avg.get("value"))

        games.append({
            "bgg_id": item.get("objectid"),
            "title": name_el.text if name_el is not None else "Unknown",
            "year": _int(year_el.text) if year_el is not None else None,
            "cover_url": _abs(thumb_el.text) if thumb_el is not None else None,
            "min_players": min_players,
            "max_players": max_players,
            "min_playtime": min_playtime,
            "max_playtime": max_playtime,
            "bgg_rating": bgg_rating,
            # Full metadata fetched individually on confirm, not in bulk
        })
    return games


# ── Barcode lookup ────────────────────────────────────────────────────────────

async def lookup_barcode(barcode: str) -> Optional[str]:
    """
    Look up a product name by UPC/EAN barcode via UPCitemdb free tier.
    Returns the product title on success, None on failure.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.upcitemdb.com/prod/trial/lookup",
                params={"upc": barcode},
                timeout=10.0,
                headers={"Accept": "application/json"},
            )
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                if items:
                    return items[0].get("title")
    except Exception:
        pass
    return None


# ── Cover download ────────────────────────────────────────────────────────────

async def download_cover(url: str, bgg_id: str) -> Optional[str]:
    """Download cover image to COVERS_DIR/game_{bgg_id}.jpg."""
    dest = os.path.join(COVERS_DIR, f"game_{bgg_id}.jpg")
    try:
        async with httpx.AsyncClient(headers=_headers(), follow_redirects=True) as client:
            resp = await client.get(url, timeout=15.0)
            resp.raise_for_status()
        os.makedirs(COVERS_DIR, exist_ok=True)
        with open(dest, "wb") as f:
            f.write(resp.content)
        return dest
    except Exception:
        return None
