import { useEffect, useState, useRef } from 'react'
import { Sparkles, Play, Square, RefreshCw } from 'lucide-react'

export default function Admin() {
  const [status, setStatus] = useState(null)
  const pollRef = useRef(null)

  async function fetchStatus() {
    try {
      const res = await fetch('/api/ai/status')
      if (res.ok) setStatus(await res.json())
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 3000)
    return () => clearInterval(pollRef.current)
  }, [])

  async function startBatch(collection) {
    await fetch(`/api/ai/batch/start?collection=${collection}&untagged_only=true`, { method: 'POST' })
    fetchStatus()
  }

  async function startBatchAll(collection) {
    await fetch(`/api/ai/batch/start?collection=${collection}&untagged_only=false`, { method: 'POST' })
    fetchStatus()
  }

  async function stopBatch() {
    await fetch('/api/ai/batch/stop', { method: 'POST' })
    fetchStatus()
  }

  const batch = status?.batch
  const running = batch?.running

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
        <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
        AI Tag Settings
      </h1>

      {/* API key status */}
      <div className="rounded-lg p-4 space-y-1" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>API key</p>
        {status === null ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>
        ) : status.api_key_configured ? (
          <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Configured ✓</p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: '#f87171' }}>Not configured</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Set <code style={{ color: 'var(--color-accent)' }}>ANTHROPIC_API_KEY</code> in the add-on settings
              or in <code style={{ color: 'var(--color-accent)' }}>local/dev.sh</code> for local dev.
              Get a key at <span style={{ color: 'var(--color-accent)' }}>console.anthropic.com</span>.
            </p>
          </div>
        )}
        {status && (
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {status.calls_this_minute} / {status.max_per_minute} calls used this minute
          </p>
        )}
      </div>

      {/* Batch tagging */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
          Batch tag existing entries
        </p>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Runs at 4 calls/minute to stay within the free tier limit (5/min).
          Only untagged entries are processed by default.
        </p>

        {/* Batch progress */}
        {running && (
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium capitalize" style={{ color: 'var(--color-text)' }}>
                {batch.collection} — {batch.done} / {batch.total}
                {batch.errors > 0 && <span style={{ color: '#f87171' }}> ({batch.errors} errors)</span>}
              </p>
              <button
                onClick={stopBatch}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                <Square size={11} /> Stop
              </button>
            </div>
            {batch.current && (
              <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                Processing: {batch.current}
              </p>
            )}
            {batch.total > 0 && (
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(batch.done / batch.total) * 100}%`, background: 'var(--color-accent)' }}
                />
              </div>
            )}
          </div>
        )}

        {!running && (
          <div className="grid grid-cols-2 gap-3">
            <BatchCard
              title="Records"
              subtitle="untagged only"
              disabled={!status?.api_key_configured}
              onStart={() => startBatch('records')}
              onStartAll={() => startBatchAll('records')}
            />
            <BatchCard
              title="Games"
              subtitle="untagged only"
              disabled={!status?.api_key_configured}
              onStart={() => startBatch('games')}
              onStartAll={() => startBatchAll('games')}
            />
          </div>
        )}
      </div>

      {/* Last batch result */}
      {!running && batch?.total > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Last batch: <span style={{ color: 'var(--color-text)' }}>{batch.done}</span> {batch.collection} tagged
            {batch.errors > 0 && <>, <span style={{ color: '#f87171' }}>{batch.errors} errors</span></>}
          </p>
        </div>
      )}

      <button
        onClick={fetchStatus}
        className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-muted)' }}
      >
        <RefreshCw size={11} /> Refresh
      </button>
    </div>
  )
}

function BatchCard({ title, subtitle, disabled, onStart, onStartAll }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{title}</p>
      <button
        onClick={onStart}
        disabled={disabled}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        <Play size={11} /> Tag untagged
      </button>
      <button
        onClick={onStartAll}
        disabled={disabled}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
        style={{ background: 'var(--color-surface)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
      >
        <Play size={11} /> Tag all
      </button>
    </div>
  )
}
