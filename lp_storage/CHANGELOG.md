# Changelog

## [1.0.10] - 2026-04-29
### Added
- "Explore" button on every record detail sheet — starts an explore session seeded
  from that record, skipping the keyword flow and landing directly in the
  similar/contrast view
- `showExplore={false}` prop suppresses the button when RecordDetail is rendered
  inside the Explore page itself (where navigating to the same route would be a no-op)

## [1.0.9] - 2026-04-25
### Fixed
- Direct URL navigation to subpages (e.g. `/games`, `/admin`) now works; FastAPI
  was returning 404 for client-side routes — added a 404 exception handler that
  serves `index.html` so React Router handles the path
- Home / Games home grid now fills left-to-right before top-to-bottom (switched
  from CSS `columns` to `grid`)
- AI-suggested tags now appear immediately in the detail sheet without a refresh;
  `TagEditor` was not re-syncing its local state when the parent updated `initialTags`

## [1.0.8] - 2026-04-25
### Added
- AI tag suggestions via Claude API (Sonnet) for records and games
  - "Suggest tags" button in the tags section of every record/game detail sheet
  - Auto-suggest fires in the background when a new entry is saved
  - Rate-limit guard (5 req/min free tier): button shows live countdown when limited
  - Collection-wide tag vocabulary passed to every prompt so Claude reuses existing
    tag forms instead of inventing variations (e.g. always "2 players", never "2-player")
  - Prompts request 8-10 tags per item
- Hidden `/admin` page: API key status, calls-this-minute counter, batch tagging
  controls for records and games (untagged-only or all) at 4 calls/min with
  live progress bar and stop button
- `anthropic_api_key` add-on option in config.yaml / run.sh

## [1.0.7] - 2026-04-17
### Added
- Add Record: barcode tab (UPC/EAN) — searches Discogs directly by barcode,
  drops straight into the pressing picker
- Explore: Similar and Contrast columns are side by side on mobile (scaled-down
  square covers); Start over button moves below the columns on small screens

## [1.0.6] - 2026-04-17
### Fixed
- Explore similar/contrast results were always empty: SQLAlchemy ORM objects were not
  serialized before being placed in `RelatedResponse`, causing FastAPI to return empty dicts
- Stats breakdown table length column was always "—": `_build_breakdown` did not accumulate
  duration per bucket; added `duration_fn` parameter wired to `_record_seconds_estimated`

### Added
- Explore: 3 similar and 3 contrast records (up from 2); shuffle button on each column
  re-fetches excluding currently shown records
- Explore: previously played records are soft-excluded from similar/contrast results
  (included as fallback if fewer than 3 candidates remain without them)
- Explore: all record cards (similar, contrast, history) now use the same square cover
  style with hover title/artist overlay as the Phase 2 suggestion grid
- Stats: records without tracklist durations get a 16 min/side estimate (sides inferred
  from tracklist position labels A/B/C/D, then format string e.g. 2xLP, defaulting to 2)
- Stats: collection value card now shows a Euro sign instead of a dollar sign
- Sidebar: switching between Records and Games navigates to the equivalent page
  (e.g. /search ↔ /games/search) instead of staying on the current URL

## [1.0.5] - 2026-04-15
### Fixed
- BGG API now requires a Bearer token (mandatory as of July 2025); added `bgg_token`
  add-on option — set it in HA app settings after registering at boardgamegeek.com/using_the_xml_api
- Token is passed via `Authorization: Bearer` header on all BGG requests
- Token is optional; requests still work if BGG ever lifts the requirement

## [1.0.4] - 2026-04-15
### Fixed
- BGG API 401 errors: all requests now send a proper User-Agent header (BGG blocks the default httpx UA)
- BGG collection import with a private profile now shows a clear error message with instructions to make the collection public

## [1.0.3] - 2026-04-15
### Added
- Board games collection alongside vinyl records, toggled from the sidebar
- Games data via BoardGameGeek XML API 2 (no account needed): title search, full metadata, cover art
- Add game by: BGG title search, barcode/UPC scan, or bulk import from a BGG username
- Duplicate detection on BGG ID when adding games
- Games Home page with sort toolbar (Random, Newest, Oldest, Title A–Z, Year ↑/↓, Top rated) and category filter pills
- Games Search page with filters: title, designer, category, mechanic, tag, player count, year range
- Games Explore page: "I feel like playing…" keyword flow (categories, mechanics, tags, decades, player count)
- Games Stats page: totals (game count, total playtime, average BGG rating) with breakdowns by decade, category, and mechanic
- Tags on games (same TagEditor component, wired to /api/games API)
- Sidebar Records ↔ Games switcher, persisted to localStorage

## [1.0.2] - 2026-04-15
### Added
- Stats page: total records, total collection length, total value at time of adding;
  breakdown table by decade and by genre with proportional bar and value column
- Home page sort toolbar: Random (default), Newest, Oldest, Artist A–Z, Year ↑/↓, Title A–Z
- Home page genre filter pills drawn from the collection, toggle to narrow the grid
- Sort parameter on GET /api/records/ (date_desc, date_asc, artist_asc, artist_desc,
  title_asc, year_asc, year_desc)

## [1.0.1] - 2026-04-15
### Added
- Dead wax / matrix code search (third tab in Add Record)
- Duplicate detection: blocks adding a record whose Discogs ID is already in the collection
- Delete record from the detail sheet, with inline confirmation
- Vinyl record SVG favicon

## [1.0.0] - 2026-04-15
### Added
- Collection home page with random masonry cover grid
- Search page with 8 filters: artist, album title, track title, tag, genre, style, year from/to
- Add Record wizard: catalog number or artist/title → master → pressing → confirm
  - Auto-fills metadata from Discogs (title, artist, year, label, catalog number, country, format, tracklist, cover art)
  - Records lowest marketplace price at time of adding
  - Personal notes and custom tags at save time
- Explore page: "I feel like…" keyword flow with genre/style/tag/decade filters
  - 3 random matching covers to pick from, with shuffle
  - Refinement chips drawn from the matching set
  - After picking: similar and contrast recommendations (Jaccard similarity), chained play history
- Custom tags: add/remove on any record from the detail sheet or at save time; searchable
- RecordDetail sheet: cover, metadata, tags, tracklist, notes
- Dark theme throughout
- Home Assistant add-on packaging (aarch64 / amd64 / armv7)
- Nginx Proxy Manager + AdGuard Home compatible for local domain access
