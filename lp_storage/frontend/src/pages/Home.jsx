import { useEffect, useState, useCallback } from 'react'
import CoverCard from '../components/CoverCard'
import RecordDetail from '../components/RecordDetail'

export default function Home() {
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRandom = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/records/random?limit=80')
      if (!res.ok) throw new Error('Failed to load collection')
      setRecords(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRandom() }, [fetchRandom])

  if (loading) return <LoadingGrid />
  if (error) return <ErrorState message={error} onRetry={fetchRandom} />
  if (records.length === 0) return <EmptyState />

  return (
    <>
      <div className="p-3 sm:p-4 columns-3 sm:columns-4 md:columns-5 lg:columns-6 xl:columns-7 gap-2 sm:gap-3">
        {records.map(record => (
          <div key={record.id} className="mb-2 sm:mb-3 break-inside-avoid">
            <CoverCard record={record} onClick={setSelected} />
          </div>
        ))}
      </div>

      {selected && (
        <RecordDetail
          record={selected}
          onClose={() => setSelected(null)}
          onDelete={id => { setRecords(r => r.filter(x => x.id !== id)); setSelected(null) }}
        />
      )}
    </>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>No records yet</p>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Add your first record to get started
      </p>
    </div>
  )
}
