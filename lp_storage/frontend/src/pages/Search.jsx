import { useState, useCallback } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import CoverCard from '../components/CoverCard'
import RecordDetail from '../components/RecordDetail'

const EMPTY_FILTERS = {
  artist: '',
  title: '',
  genre: '',
  style: '',
  tag: '',
  track: '',
  year_from: '',
  year_to: '',
}

export default function Search() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const hasFilters = Object.values(filters).some(v => v !== '')

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v !== '') params.set(k, v) })
      const res = await fetch(`/api/records/?${params}`)
      if (!res.ok) throw new Error('Search failed')
      setResults(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setResults(null)
    setError(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter panel */}
      <form
        onSubmit={handleSearch}
        className="border-b p-4 space-y-3"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <FilterInput
            placeholder="Artist"
            value={filters.artist}
            onChange={v => setFilters(f => ({ ...f, artist: v }))}
          />
          <FilterInput
            placeholder="Album title"
            value={filters.title}
            onChange={v => setFilters(f => ({ ...f, title: v }))}
          />
          <FilterInput
            placeholder="Track title"
            value={filters.track}
            onChange={v => setFilters(f => ({ ...f, track: v }))}
          />
          <FilterInput
            placeholder="Tag"
            value={filters.tag}
            onChange={v => setFilters(f => ({ ...f, tag: v }))}
          />
          <FilterInput
            placeholder="Genre"
            value={filters.genre}
            onChange={v => setFilters(f => ({ ...f, genre: v }))}
          />
          <FilterInput
            placeholder="Style"
            value={filters.style}
            onChange={v => setFilters(f => ({ ...f, style: v }))}
          />
          <FilterInput
            placeholder="Year from"
            type="number"
            value={filters.year_from}
            onChange={v => setFilters(f => ({ ...f, year_from: v }))}
          />
          <FilterInput
            placeholder="Year to"
            type="number"
            value={filters.year_to}
            onChange={v => setFilters(f => ({ ...f, year_to: v }))}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            <SearchIcon size={14} />
            Search
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-opacity hover:opacity-70"
              style={{ background: 'var(--color-card)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </form>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {error && (
          <p className="text-sm text-center pt-8" style={{ color: 'var(--color-muted)' }}>{error}</p>
        )}
        {results === null && !loading && (
          <p className="text-sm text-center pt-8" style={{ color: 'var(--color-muted)' }}>
            Enter filters and press Search
          </p>
        )}
        {loading && (
          <div className="columns-3 sm:columns-4 md:columns-5 gap-2 sm:gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="mb-2 sm:mb-3 aspect-square w-full rounded-sm animate-pulse"
                style={{ background: 'var(--color-card)' }}
              />
            ))}
          </div>
        )}
        {results !== null && !loading && results.length === 0 && (
          <p className="text-sm text-center pt-8" style={{ color: 'var(--color-muted)' }}>
            No records match your filters
          </p>
        )}
        {results !== null && !loading && results.length > 0 && (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            <div className="columns-3 sm:columns-4 md:columns-5 gap-2 sm:gap-3">
              {results.map(record => (
                <div key={record.id} className="mb-2 sm:mb-3 break-inside-avoid">
                  <CoverCard record={record} onClick={setSelected} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (
        <RecordDetail
          record={selected}
          onClose={() => setSelected(null)}
          onDelete={id => { setResults(r => r.filter(x => x.id !== id)); setSelected(null) }}
        />
      )}
    </div>
  )
}

function FilterInput({ placeholder, value, onChange, type = 'text' }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors placeholder:opacity-40"
      style={{
        background: 'var(--color-card)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
      }}
      onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
    />
  )
}
