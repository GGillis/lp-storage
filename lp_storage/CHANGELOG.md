# Changelog

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
