import { useEffect, useState, useCallback } from 'react'
import { Shuffle } from 'lucide-react'
import GameCard from '../../components/GameCard'
import GameDetail from '../../components/GameDetail'

const SORT_OPTIONS = [
  { key: 'random',      label: 'Random'    },
  { key: 'date_desc',   label: 'Newest'    },
  { key: 'date_asc',    label: 'Oldest'    },
  { key: 'title_asc',   label: 'Title A–Z' },
  { key: 'year_asc',    label: 'Year ↑'    },
  { key: 'year_desc',   label: 'Year ↓'    },
  { key: 'rating_desc', label: 'Top rated' },
]

export default function GamesHome() {
  const [games, setGames] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState('random')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [allCategories, setAllCategories] = useState([])

  const fetchGames = useCallback(async (sortKey, category) => {
    setLoading(true)
    setError(null)
    try {
      let res
      if (sortKey === 'random') {
        res = await fetch('/api/games/random?limit=80')
      } else {
        const params = new URLSearchParams({ sort: sortKey })
        if (category) params.set('category', category)
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

  useEffect(() => { fetchGames(sort, categoryFilter) }, [sort, categoryFilter, fetchGames])

  function handleCategory(cat) {
    setCategoryFilter(prev => prev === cat ? '' : cat)
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

        {allCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
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
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? <LoadingGrid /> : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{error}</p>
            <button onClick={() => fetchGames(sort, categoryFilter)} className="px-4 py-2 rounded-md text-sm" style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>Retry</button>
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{categoryFilter ? 'No games in this category' : 'No games yet'}</p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{categoryFilter ? 'Try a different filter' : 'Add your first game to get started'}</p>
          </div>
        ) : (
          <div className="p-3 sm:p-4 columns-3 sm:columns-4 md:columns-5 lg:columns-6 xl:columns-7 gap-2 sm:gap-3">
            {games.map(game => (
              <div key={game.id} className="mb-2 sm:mb-3 break-inside-avoid">
                <GameCard game={game} onClick={setSelected} />
              </div>
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
    <div className="p-3 sm:p-4 columns-3 sm:columns-4 md:columns-5 lg:columns-6 xl:columns-7 gap-2 sm:gap-3">
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="mb-2 sm:mb-3 aspect-square w-full rounded-sm animate-pulse" style={{ background: 'var(--color-card)' }} />
      ))}
    </div>
  )
}
