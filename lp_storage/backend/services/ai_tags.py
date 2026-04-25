"""
AI tag suggestion via Claude API (Anthropic).

Rate limiting: free tier allows 5 req/min.
We track call timestamps in a module-level deque and refuse early calls,
returning the number of seconds the caller should wait.
"""

import json
import os
import time
from collections import deque
from typing import Optional

import anthropic

_MODEL = "claude-sonnet-4-6"
_MAX_CALLS_PER_MINUTE = 5

# In-memory sliding-window rate limiter
_call_times: deque = deque()


def _client() -> anthropic.AsyncAnthropic:
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")
    return anthropic.AsyncAnthropic(api_key=key)


def api_key_configured() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


def rate_limit_check() -> Optional[int]:
    """
    Check (and record) a new API call.
    Returns the number of seconds to wait if rate-limited, None if OK.
    """
    now = time.monotonic()
    while _call_times and _call_times[0] < now - 60:
        _call_times.popleft()
    if len(_call_times) >= _MAX_CALLS_PER_MINUTE:
        wait = int(60 - (now - _call_times[0])) + 1
        return wait
    _call_times.append(now)
    return None


def calls_this_minute() -> int:
    now = time.monotonic()
    while _call_times and _call_times[0] < now - 60:
        _call_times.popleft()
    return len(_call_times)


# ── Prompt builders ───────────────────────────────────────────────────────────

def record_prompt(r, collection_tags: list[str] | None = None) -> str:
    lines = [f"Title: {r.title}", f"Artist: {r.artist}"]
    if r.year:       lines.append(f"Year: {r.year}")
    if r.genre:      lines.append(f"Genre: {r.genre}")
    if r.styles:     lines.append(f"Styles: {r.styles}")
    if r.label:      lines.append(f"Label: {r.label}")
    if r.tracklist:
        try:
            tracks = json.loads(r.tracklist)
            titles = [t.get("title", "") for t in tracks[:6] if t.get("title")]
            if titles:
                lines.append(f"Tracks: {', '.join(titles)}")
        except Exception:
            pass
    existing = ", ".join(r.tags) if r.tags else "none"
    lines.append(f"Already tagged: {existing}")

    vocab_section = ""
    if collection_tags:
        vocab_section = (
            "\nExisting tag vocabulary (reuse these exact forms when they fit — "
            "do not invent variations):\n"
            f"  {', '.join(sorted(collection_tags))}\n"
        )

    return (
        "You are tagging a vinyl record for a personal music collection app.\n\n"
        "Record:\n" + "\n".join(f"  {l}" for l in lines) + "\n"
        + vocab_section + "\n"
        "Suggest 8-10 short, lowercase tags to help the owner rediscover this record.\n"
        "Focus on mood, era feel, instrumentation, or listening context "
        "(e.g. 'late-night', 'road-trip', 'piano-driven', 'melancholic').\n"
        "Prefer reusing tags from the vocabulary above when they apply. "
        "Only invent a new tag if nothing in the vocabulary fits.\n"
        "Do NOT repeat the genre or styles. Do NOT repeat already-tagged tags.\n"
        "Return ONLY a JSON array, e.g. [\"tag1\", \"tag2\", \"tag3\"]"
    )


def game_prompt(g, collection_tags: list[str] | None = None) -> str:
    lines = [f"Title: {g.title}"]
    if g.year:         lines.append(f"Year: {g.year}")
    if g.categories:   lines.append(f"Categories: {g.categories}")
    if g.mechanics:    lines.append(f"Mechanics: {g.mechanics}")
    if g.designers:    lines.append(f"Designers: {g.designers}")
    if g.min_players and g.max_players:
        lines.append(f"Players: {g.min_players}–{g.max_players}")
    if g.min_playtime and g.max_playtime:
        lines.append(f"Playtime: {g.min_playtime}–{g.max_playtime} min")
    existing = ", ".join(g.tags) if g.tags else "none"
    lines.append(f"Already tagged: {existing}")

    vocab_section = ""
    if collection_tags:
        vocab_section = (
            "\nExisting tag vocabulary (reuse these exact forms when they fit — "
            "do not invent variations):\n"
            f"  {', '.join(sorted(collection_tags))}\n"
        )

    return (
        "You are tagging a board game for a personal collection app.\n\n"
        "Game:\n" + "\n".join(f"  {l}" for l in lines) + "\n"
        + vocab_section + "\n"
        "Suggest 8-10 short, lowercase tags to help the owner rediscover this game.\n"
        "Focus on complexity level, vibe (e.g. 'gateway game', 'heavy euro'), "
        "best player count, or theme feel (e.g. 'negotiation-heavy', 'puzzle-like').\n"
        "Prefer reusing tags from the vocabulary above when they apply. "
        "Only invent a new tag if nothing in the vocabulary fits.\n"
        "Do NOT repeat categories or mechanics. Do NOT repeat already-tagged tags.\n"
        "Return ONLY a JSON array, e.g. [\"tag1\", \"tag2\", \"tag3\"]"
    )


# ── API call ──────────────────────────────────────────────────────────────────

async def suggest_tags(prompt: str) -> list[str]:
    """Call Claude and parse the returned tag array. Raises on failure."""
    client = _client()
    msg = await client.messages.create(
        model=_MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        return []
    tags = json.loads(text[start:end])
    return [t.strip().lower() for t in tags if isinstance(t, str) and t.strip()]
