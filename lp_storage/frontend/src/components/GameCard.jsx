import { Gamepad2 } from 'lucide-react'

export default function GameCard({ game, onClick }) {
  const coverSrc = game.cover_path ? `/api/games/${game.id}/cover` : null

  return (
    <button
      onClick={() => onClick?.(game)}
      className="group relative aspect-square w-full overflow-hidden rounded-sm transition-transform duration-150 hover:scale-[1.03] focus:outline-none focus:ring-2"
      style={{ background: 'var(--color-card)', '--tw-ring-color': 'var(--color-accent)' }}
      aria-label={game.title}
    >
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={`${game.title} cover`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <PlaceholderCover game={game} />
      )}

      <div
        className="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }}
      >
        <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--color-text)' }}>
          {game.title}
        </p>
        {game.min_players && (
          <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
            {game.min_players === game.max_players
              ? `${game.min_players} players`
              : `${game.min_players}–${game.max_players} players`}
          </p>
        )}
      </div>
    </button>
  )
}

function PlaceholderCover({ game }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
      <Gamepad2 size={28} style={{ color: 'var(--color-border)' }} />
      <p className="text-xs text-center leading-tight line-clamp-2 mt-1" style={{ color: 'var(--color-muted)' }}>
        {game.title}
      </p>
    </div>
  )
}
