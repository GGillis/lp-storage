export default function CoverCard({ record, onClick }) {
  const coverSrc = record.cover_path
    ? `/api/records/${record.id}/cover`
    : null

  return (
    <button
      onClick={() => onClick?.(record)}
      className="group relative aspect-square w-full overflow-hidden rounded-sm transition-transform duration-150 hover:scale-[1.03] focus:outline-none focus:ring-2"
      style={{ background: 'var(--color-card)', '--tw-ring-color': 'var(--color-accent)' }}
      aria-label={`${record.title} by ${record.artist}`}
    >
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={`${record.title} cover`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <PlaceholderCover record={record} />
      )}

      {/* Hover overlay */}
      <div
        className="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }}
      >
        <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--color-text)' }}>
          {record.title}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
          {record.artist}
        </p>
      </div>
    </button>
  )
}

function PlaceholderCover({ record }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
      <div
        className="w-10 h-10 rounded-full border-4 flex items-center justify-center"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-border)' }} />
      </div>
      <p className="text-xs text-center leading-tight line-clamp-2 mt-1" style={{ color: 'var(--color-muted)' }}>
        {record.title}
      </p>
    </div>
  )
}
