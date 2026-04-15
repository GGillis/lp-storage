import { useState, useEffect, useRef } from 'react'
import { Shuffle, RotateCcw, Disc3 } from 'lucide-react'
import RecordDetail from '../components/RecordDetail'

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Explore() {
  const [allKeywords, setAllKeywords] = useState({ genres: [], styles: [], tags: [], decades: [] })
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [keywords, setKeywords] = useState([])         // active filter stack
  const [suggestions, setSuggestions] = useState(null) // { records, related_keywords, total }
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [playedRecords, setPlayedRecords] = useState([]) // [newest, ..., oldest]
  const [related, setRelated] = useState(null)           // { similar, different }
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null) // RecordDetail overlay
  const inputRef = useRef(null)

  const currentRecord = playedRecords[0] ?? null
  const historyRecords = playedRecords.slice(1)

  // Load all available keywords once on mount
  useEffect(() => {
    fetch('/api/explore/keywords')
      .then(r => r.json())
      .then(setAllKeywords)
      .catch(() => {})
  }, [])

  // Re-fetch suggestions whenever the keyword stack changes
  useEffect(() => {
    if (keywords.length === 0) { setSuggestions(null); return }
    fetchSuggestions(keywords)
  }, [keywords]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch related whenever the current record changes
  useEffect(() => {
    if (!currentRecord) return
    setRelatedLoading(true)
    setRelated(null)
    fetch(`/api/explore/related/${currentRecord.id}`)
      .then(r => r.json())
      .then(setRelated)
      .catch(() => {})
      .finally(() => setRelatedLoading(false))
  }, [currentRecord?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // All keywords flat (decades first, then genres, styles, tags)
  const allFlat = [
    ...allKeywords.decades,
    ...allKeywords.genres,
    ...allKeywords.styles,
    ...allKeywords.tags,
  ]
  const available = allFlat.filter(k => !keywords.includes(k))
  const filtered = inputValue.trim()
    ? available.filter(k => k.toLowerCase().includes(inputValue.toLowerCase()))
    : available.slice(0, 16)

  async function fetchSuggestions(kws) {
    setSuggestLoading(true)
    try {
      const params = new URLSearchParams()
      kws.forEach(k => params.append('kw', k))
      const res = await fetch(`/api/explore/suggestions?${params}`)
      setSuggestions(await res.json())
    } catch {
      // ignore
    } finally {
      setSuggestLoading(false)
    }
  }

  function addKeyword(kw) {
    const norm = kw.trim().toLowerCase()
    if (!norm || keywords.includes(norm)) return
    setInputValue('')
    setShowDropdown(false)
    setKeywords(prev => [...prev, norm])
  }

  function removeKeyword(kw) {
    const next = keywords.filter(x => x !== kw)
    setKeywords(next)
    if (next.length === 0) setSuggestions(null)
  }

  // Add a record to the top of the played list (used from Phase 2 and Phase 3 columns)
  function pickRecord(record) {
    setPlayedRecords(prev => [record, ...prev])
  }

  function reset() {
    setKeywords([])
    setSuggestions(null)
    setPlayedRecords([])
    setRelated(null)
    setInputValue('')
  }

  // ── Phase 3: at least one record has been played ───────────────────────────
  if (currentRecord) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Current record — most recently picked, prominent at top */}
        <PickedCard record={currentRecord} onOpenDetail={setDetailRecord} />

        {/* History trail — older picks, compact, newest-first */}
        {historyRecords.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Previously</p>
            {historyRecords.map((r, i) => (
              <HistoryCard key={`${r.id}-${i}`} record={r} onOpenDetail={setDetailRecord} />
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Three columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RelatedColumn
            title="Similar"
            records={related?.similar}
            loading={relatedLoading}
            onPick={pickRecord}
          />
          <RelatedColumn
            title="Contrast"
            records={related?.different}
            loading={relatedLoading}
            onPick={pickRecord}
          />
          <div className="flex flex-col gap-3">
            <ColumnHeader>Explore again</ColumnHeader>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium w-full transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              <RotateCcw size={14} />
              Start over
            </button>
          </div>
        </div>

        {detailRecord && (
          <RecordDetail
            record={detailRecord}
            onClose={() => setDetailRecord(null)}
            onDelete={id => {
              setPlayedRecords(r => r.filter(x => x.id !== id))
              setDetailRecord(null)
            }}
          />
        )}
      </div>
    )
  }

  // ── Phase 1 + 2: browsing ─────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Prompt + input */}
      <div>
        <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          I feel like…
        </h1>

        {/* Active keyword pills */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {keywords.map(k => (
              <span
                key={k}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium"
                style={{ background: 'var(--color-accent)', color: '#000' }}
              >
                {k}
                <button
                  onClick={() => removeKeyword(k)}
                  className="opacity-60 hover:opacity-100 transition-opacity leading-none"
                  aria-label={`Remove ${k}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text input with dropdown */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="type a genre, tag, decade…"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setShowDropdown(true) }}
            onFocus={e => { e.target.style.borderColor = 'var(--color-accent)'; setShowDropdown(true) }}
            onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; setTimeout(() => setShowDropdown(false), 150) }}
            onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim()) addKeyword(inputValue) }}
            className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--color-card)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          />
          {showDropdown && filtered.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-md z-10 overflow-y-auto max-h-48"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
            >
              {filtered.map(kw => (
                <button
                  key={kw}
                  onMouseDown={() => addKeyword(kw)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-text)' }}
                >
                  {kw}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading skeleton for suggestions */}
      {suggestLoading && (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-sm animate-pulse" style={{ background: 'var(--color-card)' }} />
          ))}
        </div>
      )}

      {/* Suggestions results */}
      {suggestions && !suggestLoading && (
        <>
          {suggestions.total === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-muted)' }}>
              No records match these filters
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {suggestions.total} record{suggestions.total !== 1 ? 's' : ''} match · tap one to start
                </p>
                {suggestions.total > 3 && (
                  <button
                    onClick={() => fetchSuggestions(keywords)}
                    className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <Shuffle size={12} /> Shuffle
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {suggestions.records.map(record => (
                  <RecordSquare key={record.id} record={record} onClick={() => pickRecord(record)} />
                ))}
              </div>

              {suggestions.related_keywords.length > 0 && (
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>Refine with…</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.related_keywords.map(kw => (
                      <button
                        key={kw}
                        onClick={() => addKeyword(kw)}
                        className="px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-70"
                        style={{ background: 'var(--color-card)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Popular keywords before any filter is applied */}
      {keywords.length === 0 && !suggestLoading && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>Popular</p>
          <div className="flex flex-wrap gap-1.5">
            {filtered.map(kw => (
              <button
                key={kw}
                onClick={() => addKeyword(kw)}
                className="px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-70"
                style={{ background: 'var(--color-card)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RecordSquare({ record, onClick }) {
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-sm overflow-hidden relative group transition-opacity hover:opacity-90"
      style={{ background: 'var(--color-card)' }}
    >
      {record.cover_path ? (
        <img
          src={`/api/records/${record.id}/cover`}
          alt={record.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Disc3 size={32} style={{ color: 'var(--color-border)' }} />
        </div>
      )}
      <div
        className="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }}
      >
        <p className="text-xs font-medium text-white truncate">{record.title}</p>
        <p className="text-xs text-white/60 truncate">{record.artist}</p>
      </div>
    </button>
  )
}

// Large card for the current (most recent) record — tap to see details
function PickedCard({ record, onOpenDetail }) {
  return (
    <button
      onClick={() => onOpenDetail(record)}
      className="w-full flex gap-4 rounded-lg p-3 text-left transition-opacity hover:opacity-90"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-accent)', borderOpacity: 0.4 }}
    >
      <div
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm shrink-0 overflow-hidden"
        style={{ background: 'var(--color-border)' }}
      >
        {record.cover_path ? (
          <img src={`/api/records/${record.id}/cover`} alt={record.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Disc3 size={28} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-base font-semibold truncate" style={{ color: 'var(--color-text)' }}>{record.title}</p>
        <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>{record.artist}</p>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
          {record.year && <span>{record.year}</span>}
          {record.label && <span>{record.label}</span>}
          {record.genre && <span>{record.genre}</span>}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-accent)', opacity: 0.7 }}>Tap for details</p>
      </div>
    </button>
  )
}

// Compact card for previously played records
function HistoryCard({ record, onOpenDetail }) {
  return (
    <button
      onClick={() => onOpenDetail(record)}
      className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-opacity hover:opacity-80"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="w-8 h-8 rounded-sm shrink-0 overflow-hidden"
        style={{ background: 'var(--color-border)' }}
      >
        {record.cover_path ? (
          <img src={`/api/records/${record.id}/cover`} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Disc3 size={12} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate" style={{ color: 'var(--color-text)' }}>{record.title}</p>
        <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{record.artist}</p>
      </div>
    </button>
  )
}

// Column in phase 3 — clicking a record picks it (adds to top of played list)
function RelatedColumn({ title, records, loading, onPick }) {
  return (
    <div className="flex flex-col gap-3">
      <ColumnHeader>{title}</ColumnHeader>
      {loading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 rounded-md animate-pulse" style={{ background: 'var(--color-card)' }} />
        ))
      ) : records?.length > 0 ? (
        records.map(r => (
          <button
            key={r.id}
            onClick={() => onPick(r)}
            className="flex items-center gap-2 rounded-md p-2 text-left transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <div
              className="w-10 h-10 rounded-sm shrink-0 overflow-hidden"
              style={{ background: 'var(--color-border)' }}
            >
              {r.cover_path ? (
                <img src={`/api/records/${r.id}/cover`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc3 size={14} style={{ color: 'var(--color-muted)' }} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>{r.title}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{r.artist}</p>
            </div>
          </button>
        ))
      ) : (
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>None found</p>
      )}
    </div>
  )
}

function ColumnHeader({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
      {children}
    </p>
  )
}
