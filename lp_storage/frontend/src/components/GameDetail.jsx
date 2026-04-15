import { useEffect, useState } from 'react'
import { X, Gamepad2, Trash2, Star } from 'lucide-react'
import TagEditor from './TagEditor'

export default function GameDetail({ game: initialGame, onClose, onDelete }) {
  const [game, setGame] = useState(initialGame)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/games/${game.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onDelete?.(game.id)
      onClose()
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const players = game.min_players
    ? game.min_players === game.max_players
      ? `${game.min_players}`
      : `${game.min_players}–${game.max_players}`
    : null

  const playtime = game.min_playtime
    ? game.min_playtime === game.max_playtime
      ? `${game.min_playtime} min`
      : `${game.min_playtime}–${game.max_playtime} min`
    : null

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
        {/* Header */}
        <div className="flex gap-4 p-4">
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-sm shrink-0 overflow-hidden"
            style={{ background: 'var(--color-card)' }}
          >
            {game.cover_path ? (
              <img src={`/api/games/${game.id}/cover`} alt={game.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Gamepad2 size={32} style={{ color: 'var(--color-border)' }} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h2 className="font-semibold text-base leading-snug truncate" style={{ color: 'var(--color-text)' }}>
              {game.title}
            </h2>
            {game.designers && (
              <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>
                {game.designers}
              </p>
            )}

            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {game.year && <Chip>{game.year}</Chip>}
              {players && <Chip>{players} players</Chip>}
              {playtime && <Chip>{playtime}</Chip>}
              {game.min_age && <Chip>{game.min_age}+</Chip>}
              {game.publisher && <Chip>{game.publisher}</Chip>}
            </div>

            {game.bgg_rating && (
              <p className="flex items-center gap-1 text-xs mt-2 font-medium" style={{ color: 'var(--color-accent)' }}>
                <Star size={11} fill="currentColor" />
                {game.bgg_rating.toFixed(2)} BGG
              </p>
            )}

            {game.categories && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--color-muted)' }}>
                {game.categories}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="self-start p-1 rounded transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-muted)' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mechanics */}
        {game.mechanics && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
              Mechanics
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text)' }}>{game.mechanics}</p>
          </div>
        )}

        {/* Tags */}
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>
            Tags
          </p>
          <TagEditor
            recordId={game.id}
            apiBase="/api/games"
            initialTags={game.tags ?? []}
            onChange={updated => setGame(g => ({ ...g, tags: updated }))}
          />
        </div>

        {/* Description */}
        {game.description && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
              Description
            </p>
            <p className="text-xs leading-relaxed line-clamp-6" style={{ color: 'var(--color-text)' }}>
              {game.description}
            </p>
          </div>
        )}

        {/* Notes */}
        {game.notes && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
              Notes
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text)' }}>{game.notes}</p>
          </div>
        )}

        {/* Delete */}
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-muted)' }}
            >
              <Trash2 size={13} />
              Delete game
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
              <button onClick={() => setConfirmDelete(false)} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--color-muted)' }}>
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
    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-card)', color: 'var(--color-muted)' }}>
      {children}
    </span>
  )
}
