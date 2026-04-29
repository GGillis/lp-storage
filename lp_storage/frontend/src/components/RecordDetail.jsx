import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Disc3, Trash2, Sparkles, Compass } from 'lucide-react'
import TagEditor from './TagEditor'

export default function RecordDetail({ record: initialRecord, onClose, onDelete, showExplore = true }) {
  const navigate = useNavigate()
  const [record, setRecord] = useState(initialRecord)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)  // null | string
  const [retryIn, setRetryIn] = useState(null)  // seconds countdown

  async function handleSuggestTags() {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/ai/suggest/records/${record.id}`, { method: 'POST' })
      if (res.status === 429) {
        const data = await res.json()
        const secs = parseInt(res.headers.get('Retry-After') || '60', 10)
        setAiError(data.detail)
        setRetryIn(secs)
        const iv = setInterval(() => setRetryIn(s => { if (s <= 1) { clearInterval(iv); return null } return s - 1 }), 1000)
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setAiError(data.detail || 'Tag suggestion failed')
        return
      }
      const data = await res.json()
      setRecord(r => ({ ...r, tags: data.tags }))
    } catch {
      setAiError('Could not reach server')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/records/${record.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onDelete?.(record.id)
      onClose()
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const tracklist = (() => {
    try { return record.tracklist ? JSON.parse(record.tracklist) : [] }
    catch { return [] }
  })()

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl overflow-y-auto max-h-[90dvh]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header: cover + main info */}
        <div className="flex gap-4 p-4">
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-sm shrink-0 overflow-hidden"
            style={{ background: 'var(--color-card)' }}
          >
            {record.cover_path ? (
              <img
                src={`/api/records/${record.id}/cover`}
                alt={`${record.title} cover`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Disc3 size={32} style={{ color: 'var(--color-border)' }} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h2
              className="font-semibold text-base leading-snug truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {record.title}
            </h2>
            <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>
              {record.artist}
            </p>

            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {record.year && <Chip>{record.year}</Chip>}
              {record.label && <Chip>{record.label}</Chip>}
              {record.catalog_number && <Chip>{record.catalog_number}</Chip>}
              {record.country && <Chip>{record.country}</Chip>}
              {record.format && <Chip>{record.format}</Chip>}
            </div>

            {record.genre && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                {[record.genre, record.styles].filter(Boolean).join(' · ')}
              </p>
            )}

            {record.lowest_price != null && (
              <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--color-accent)' }}>
                From {record.price_currency} {record.lowest_price.toFixed(2)} (at time of adding)
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1 rounded transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            {showExplore && (
              <button
                onClick={() => { onClose(); navigate('/explore', { state: { seedRecord: record } }) }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-opacity hover:opacity-80"
                style={{ background: 'var(--color-card)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
                title="Start explore session from this record"
              >
                <Compass size={11} />
                Explore
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Tags</p>
            <button
              onClick={handleSuggestTags}
              disabled={aiLoading || retryIn !== null}
              className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: 'var(--color-accent)' }}
            >
              <Sparkles size={11} />
              {aiLoading ? 'Suggesting…' : retryIn ? `Retry in ${retryIn}s` : 'Suggest tags'}
            </button>
          </div>
          {aiError && (
            <p className="text-xs mb-2" style={{ color: '#f87171' }}>{aiError}</p>
          )}
          <TagEditor
            recordId={record.id}
            initialTags={record.tags ?? []}
            onChange={updated => setRecord(r => ({ ...r, tags: updated }))}
          />
        </div>

        {/* Tracklist */}
        {tracklist.length > 0 && (
          <div
            className="border-t px-4 py-3 max-h-52 overflow-y-auto"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>
              Tracklist
            </p>
            <ol className="space-y-1">
              {tracklist.map((track, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs">
                  <span className="w-6 shrink-0 text-right" style={{ color: 'var(--color-muted)' }}>
                    {track.position || i + 1}
                  </span>
                  <span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>
                    {track.title}
                  </span>
                  {track.duration && (
                    <span style={{ color: 'var(--color-muted)' }}>{track.duration}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Notes */}
        {record.notes && (
          <div
            className="border-t px-4 py-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
              Notes
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text)' }}>{record.notes}</p>
          </div>
        )}

        {/* Delete */}
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
            >
              <Trash2 size={13} />
              Delete record
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Remove from collection?</p>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-muted)' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded"
      style={{ background: 'var(--color-card)', color: 'var(--color-muted)' }}
    >
      {children}
    </span>
  )
}
