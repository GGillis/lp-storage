import { useEffect, useState, useCallback } from 'react'
import { Shuffle } from 'lucide-react'
import CoverCard from '../components/CoverCard'
import RecordDetail from '../components/RecordDetail'

const SORT_OPTIONS = [
  { key: 'random',      label: 'Random'     },
  { key: 'date_desc',   label: 'Newest'     },
  { key: 'date_asc',    label: 'Oldest'     },
  { key: 'artist_asc',  label: 'Artist A–Z' },
  { key: 'year_asc',    label: 'Year ↑'     },
  { key: 'year_desc',   label: 'Year ↓'     },
  { key: 'title_asc',   label: 'Title A–Z'  },
]

export default function Home() {
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState('random')
  const [genreFilter, setGenreFilter] = useState('')
  const [allGenres, setAllGenres] = useState([])

  const fetchRecords = useCallback(async (sortKey, genre) => {
    setLoading(true)
    setError(null)
    try {
      let res
      if (sortKey === 'random') {
        res = await fetch('/api/records/random?limit=80')
      } else {
        const params = new URLSearchParams({ sort: sortKey })
        if (genre) params.set('genre', genre)
        res = await fetch(`/api/records/?${params}`)
      }
      if (!res.ok) throw new Error('Failed to load collection')
      const data = await res.json()
      setRecords(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch available genres for the filter pill row
  useEffect(() => {
    fetch('/api/explore/keywords')
      .then(r => r.json())
      .then(d => setAllGenres(d.genres ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchRecords(sort, genreFilter)
  }, [sort, genreFilter, fetchRecords])

  function handleSort(key) {
    setSort(key)
  }

  function handleGenre(genre) {
    // Toggle: click active genre to clear it
    setGenreFilter(prev => prev === genre ? '' : genre)
    // Genre filter only makes sense with a deterministic sort
    if (sort === 'random') setSort('date_desc')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div
        className="shrink-0 border-b px-3 py-2 space-y-2"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        {/* Sort pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: sort === opt.key ? 'var(--color-accent)' : 'var(--color-card)',
                color: sort === opt.key ? '#000' : 'var(--color-muted)',
                border: sort === opt.key ? 'none' : '1px solid var(--color-border)',
              }}
            >
              {opt.key === 'random' && <Shuffle size={10} />}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Genre filter pills — only shown when genres exist */}
        {allGenres.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {allGenres.map(g => (
              <button
                key={g}
                onClick={() => handleGenre(g)}
                className="shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors"
                style={{
                  background: genreFilter === g ? 'var(--color-card)' : 'transparent',
                  color: genreFilter === g ? 'var(--color-text)' : 'var(--color-muted)',
                  border: genreFilter === g ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingGrid />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchRecords(sort, genreFilter)} />
        ) : records.length === 0 ? (
          <EmptyState hasFilter={!!genreFilter} />
        ) : (
          <div className="p-3 sm:p-4 columns-3 sm:columns-4 md:columns-5 lg:columns-6 xl:columns-7 gap-2 sm:gap-3">
            {records.map(record => (
              <div key={record.id} className="mb-2 sm:mb-3 break-inside-avoid">
                <CoverCard record={record} onClick={setSelected} />
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <RecordDetail
          record={selected}
          onClose={() => setSelected(null)}
          onDelete={id => { setRecords(r => r.filter(x => x.id !== id)); setSelected(null) }}
        />
      )}
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="p-3 sm:p-4 columns-3 sm:columns-4 md:columns-5 lg:columns-6 xl:columns-7 gap-2 sm:gap-3">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="mb-2 sm:mb-3 aspect-square w-full rounded-sm animate-pulse"
          style={{ background: 'var(--color-card)' }}
        />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
      >
        Retry
      </button>
    </div>
  )
}

function EmptyState({ hasFilter }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
        {hasFilter ? 'No records match this genre' : 'No records yet'}
      </p>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        {hasFilter ? 'Try a different filter' : 'Add your first record to get started'}
      </p>
    </div>
  )
}
