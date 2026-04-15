import { useEffect, useState } from 'react'
import { Gamepad2, Clock, Star } from 'lucide-react'

const VIEWS = [
  { key: 'by_decade',   label: 'By decade'   },
  { key: 'by_category', label: 'By category' },
  { key: 'by_mechanic', label: 'By mechanic' },
]

export default function GamesStats() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('by_decade')

  useEffect(() => {
    fetch('/api/stats/?collection=games')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />
  if (!data) return (
    <p className="text-sm text-center pt-16" style={{ color: 'var(--color-muted)' }}>
      Could not load stats
    </p>
  )

  const { totals, by_decade, by_category, by_mechanic } = data
  const rows = view === 'by_decade' ? by_decade : view === 'by_category' ? by_category : by_mechanic
  const maxCount = rows.length ? rows[0].records : 1

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Stats</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Gamepad2 size={18} />} label="Games" value={totals.records} />
        <StatCard
          icon={<Clock size={18} />}
          label="Total playtime"
          value={totals.total_playtime > 0 ? `${totals.total_playtime} min` : '—'}
        />
        <StatCard
          icon={<Star size={18} />}
          label="Avg rating"
          value={totals.avg_rating > 0 ? totals.avg_rating.toFixed(1) : '—'}
        />
      </div>

      <div
        className="flex rounded-lg p-1 gap-1 w-fit"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              background: view === v.key ? 'var(--color-card)' : 'transparent',
              color: view === v.key ? 'var(--color-accent)' : 'var(--color-muted)',
              border: view === v.key ? '1px solid var(--color-border)' : '1px solid transparent',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No data</p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <div
            className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{ background: 'var(--color-surface)', color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="col-span-5">{view === 'by_decade' ? 'Decade' : view === 'by_category' ? 'Category' : 'Mechanic'}</span>
            <span className="col-span-2 text-right">Games</span>
            <span className="col-span-5 text-right">Avg rating</span>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
              style={{
                background: i % 2 === 0 ? 'var(--color-card)' : 'var(--color-surface)',
                borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div className="col-span-5">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{row.label}</p>
                <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(row.records / maxCount) * 100}%`, background: 'var(--color-accent)' }}
                  />
                </div>
              </div>
              <span className="col-span-2 text-sm text-right tabular-nums" style={{ color: 'var(--color-text)' }}>
                {row.records}
              </span>
              <span className="col-span-5 text-sm text-right" style={{ color: row.avg_rating > 0 ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                {row.avg_rating > 0 ? `★ ${row.avg_rating.toFixed(1)}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg p-4" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
      <div style={{ color: 'var(--color-accent)' }}>{icon}</div>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{label}</p>
      <p className="text-base font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>{value}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="h-6 w-16 rounded animate-pulse" style={{ background: 'var(--color-card)' }} />
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map(i => <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: 'var(--color-card)' }} />)}
      </div>
      <div className="h-8 w-64 rounded-lg animate-pulse" style={{ background: 'var(--color-card)' }} />
      <div className="h-64 rounded-lg animate-pulse" style={{ background: 'var(--color-card)' }} />
    </div>
  )
}
