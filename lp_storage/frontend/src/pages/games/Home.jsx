import { useEffect, useState, useCallback } from 'react'
import { Shuffle } from 'lucide-react'
import GameCard from '../../components/GameCard'
import GameDetail from '../../components/GameDetail'

const SORT_OPTIONS = [
  { key: 'random',           label: 'Random'       },
  { key: 'date_desc',        label: 'Newest'       },
  { key: 'date_asc',         label: 'Oldest'       },
  { key: 'title_asc',        label: 'Title A–Z'    },
  { key: 'year_asc',         label: 'Year ↑'       },
  { key: 'year_desc',        label: 'Year ↓'       },
  { key: 'rating_desc',      label: 'Top rated'    },
  { key: 'plays_desc',       label: 'Most played'  },
  { key: 'last_played_desc', label: 'Last played'  },
  { key: 'first_played_asc', label: 'First played' },
]

export default function GamesHome() {
  const [games, setGames] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState('random')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [neverPlayed, setNeverPlayed] = useState(false)
  const [allCategories, setAllCategories] = useState([])

  const fetchGames = useCallback(async (sortKey, category, np) => {
    setLoading(true)
    setError(null)
    try {
      let res
      if (sortKey === 'random') {
        res = await fetch('/api/games/random?limit=80')
      } else {
        const params = new URLSearchParams({ sort: sortKey })
        if (category) params.set('category', category)
        if (np) params.set('never_played', 'true')
        res = await fetch(`/api/games/?${params}`)
      }
      if (!res.ok) throw new Error('Failed to load collection')
      setGames(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/explore/keywords?collection=games')
      .then(r => r.json())
      .then(d => setAllCategories(d.categories ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchGames(sort, categoryFilter, neverPlayed) }, [sort, categoryFilter, neverPlayed, fetchGames])

  function handleCategory(cat) {
    setCategoryFilter(prev => prev === cat ? '' : cat)
    if (sort === 'random') setSort('date_desc')
  }

  function handleNeverPlayed() {
    setNeverPlayed(prev => !prev)
    if (sort === 'random') setSort('date_desc')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b px-3 py-2 space-y-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
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

        {/* Filter pills — never played + category */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={handleNeverPlayed}
            className="shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors"
            style={{
              background: neverPlayed ? 'var(--color-card)' : 'transparent',
              color: neverPlayed ? 'var(--color-text)' : 'var(--color-muted)',
              border: neverPlayed ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
            }}
          >
            Never played
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className="shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors"
              style={{
                background: categoryFilter === cat ? 'var(--color-card)' : 'transparent',
                color: categoryFilter === cat ? 'var(--color-text)' : 'var(--color-muted)',
                border: categoryFilter === cat ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? <LoadingGrid /> : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{error}</p>
            <button onClick={() => fetchGames(sort, categoryFilter, neverPlayed)} className="px-4 py-2 rounded-md text-sm" style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>Retry</button>
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {neverPlayed ? 'All games have been played' : categoryFilter ? 'No games in this category' : 'No games yet'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {neverPlayed ? 'Great job!' : categoryFilter ? 'Try a different filter' : 'Add your first game to get started'}
            </p>
          </div>
        ) : (
          <div className="p-3 sm:p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
            {games.map(game => (
              <GameCard key={game.id} game={game} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <GameDetail
          game={selected}
          onClose={() => setSelected(null)}
          onDelete={id => { setGames(g => g.filter(x => x.id !== id)); setSelected(null) }}
        />
      )}
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="p-3 sm:p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="aspect-square w-full rounded-sm animate-pulse" style={{ background: 'var(--color-card)' }} />
      ))}
    </div>
  )
}
