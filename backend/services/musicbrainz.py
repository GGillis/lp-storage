"""
MusicBrainz + Cover Art Archive fallback service.

Docs: https://musicbrainz.org/doc/MusicBrainz_API
      https://coverartarchive.org/
No auth required. Rate limit: 1 req/sec.
"""

# TODO: implement as fallback when Discogs has no match
# Endpoints:
#   GET https://musicbrainz.org/ws/2/release?query=<q>&fmt=json
#   GET https://coverartarchive.org/release/<mbid>/front
