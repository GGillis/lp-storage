import { useState, useEffect, useRef } from 'react'
import { Shuffle, RotateCcw, Gamepad2 } from 'lucide-react'
import GameDetail from '../../components/GameDetail'

export default function GamesExplore() {
  const [allKeywords, setAllKeywords] = useState({ categories: [], mechanics: [], tags: [], decades: [], players: [] })
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [keywords, setKeywords] = useState([])
  const [suggestions, setSuggestions] = useState(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [playedGames, setPlayedGames] = useState([])
  const [related, setRelated] = useState(null)
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [detailGame, setDetailGame] = useState(null)
  const inputRef = useRef(null)

  const currentGame = playedGames[0] ?? null
  const historyGames = playedGames.slice(1)

  useEffect(() => {
    fetch('/api/explore/keywords?collection=games')
      .then(r => r.json()).then(setAllKeywords).catch(() => {})
  }, [])

  useEffect(() => {
    if (keywords.length === 0) { setSuggestions(null); return }
    fetchSuggestions(keywords)
  }, [keywords]) // eslint-disable-line

  useEffect(() => {
    if (!currentGame) return
    setRelatedLoading(true); setRelated(null)
    fetch(`/api/explore/related/${currentGame.id}?collection=games`)
      .then(r => r.json()).then(setRelated).catch(() => {})
      .finally(() => setRelatedLoading(false))
  }, [currentGame?.id]) // eslint-disable-line

  const allFlat = [...allKeywords.decades, ...allKeywords.categories, ...allKeywords.mechanics, ...allKeywords.players, ...allKeywords.tags]
  const available = allFlat.filter(k => !keywords.includes(k))
  const filtered = inputValue.trim() ? available.filter(k => k.toLowerCase().includes(inputValue.toLowerCase())) : available.slice(0, 16)

  async function fetchSuggestions(kws) {
    setSuggestLoading(true)
    try {
      const params = new URLSearchParams()
      kws.forEach(k => params.append('kw', k))
      params.set('collection', 'games')
      const res = await fetch(`/api/explore/suggestions?${params}`)
      setSuggestions(await res.json())
    } catch { } finally { setSuggestLoading(false) }
  }

  function addKeyword(kw) {
    const norm = kw.trim().toLowerCase()
    if (!norm || keywords.includes(norm)) return
    setInputValue(''); setShowDropdown(false)
    setKeywords(prev => [...prev, norm])
  }

  function removeKeyword(kw) {
    const next = keywords.filter(x => x !== kw)
    setKeywords(next)
    if (next.length === 0) setSuggestions(null)
  }

  function pickGame(game) { setPlayedGames(prev => [game, ...prev]) }

  function reset() {
    setKeywords([]); setSuggestions(null); setPlayedGames([]); setRelated(null); setInputValue('')
  }

  if (currentGame) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <PickedCard game={currentGame} onOpenDetail={setDetailGame} />
        {historyGames.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Previously</p>
            {historyGames.map((g, i) => <HistoryCard key={`${g.id}-${i}`} game={g} onOpenDetail={setDetailGame} />)}
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RelatedColumn title="Similar" games={related?.similar} loading={relatedLoading} onPick={pickGame} />
          <RelatedColumn title="Contrast" games={related?.different} loading={relatedLoading} onPick={pickGame} />
          <div className="flex flex-col gap-3">
            <ColHeader>Explore again</ColHeader>
            <button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium w-full transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
              <RotateCcw size={14} /> Start over
            </button>
          </div>
        </div>
        {detailGame && <GameDetail game={detailGame} onClose={() => setDetailGame(null)} onDelete={id => { setPlayedGames(g => g.filter(x => x.id !== id)); setDetailGame(null) }} />}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>I feel like playing…</h1>

      <div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {keywords.map(k => (
              <span key={k} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium" style={{ background: 'var(--color-accent)', color: '#000' }}>
                {k}
                <button onClick={() => removeKeyword(k)} className="opacity-60 hover:opacity-100 transition-opacity leading-none">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input ref={inputRef} type="text" placeholder="type a category, mechanic, decade…" value={inputValue}
            onChange={e => { setInputValue(e.target.value); setShowDropdown(true) }}
            onFocus={e => { e.target.style.borderColor = 'var(--color-accent)'; setShowDropdown(true) }}
            onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; setTimeout(() => setShowDropdown(false), 150) }}
            onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim()) addKeyword(inputValue) }}
            className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          />
          {showDropdown && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-md z-10 overflow-y-auto max-h-48" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              {filtered.map(kw => <button key={kw} onMouseDown={() => addKeyword(kw)} className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-70" style={{ color: 'var(--color-text)' }}>{kw}</button>)}
            </div>
          )}
        </div>
      </div>

      {suggestLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map(i => <div key={i} className="aspect-square rounded-sm animate-pulse" style={{ background: 'var(--color-card)' }} />)}
        </div>
      )}

      {suggestions && !suggestLoading && (
        suggestions.total === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-muted)' }}>No games match these filters</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{suggestions.total} game{suggestions.total !== 1 ? 's' : ''} match · tap one to start</p>
              {suggestions.total > 3 && <button onClick={() => fetchSuggestions(keywords)} className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--color-muted)' }}><Shuffle size={12} /> Shuffle</button>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {suggestions.games.map(game => <GameSquare key={game.id} game={game} onClick={() => pickGame(game)} />)}
            </div>
            {suggestions.related_keywords.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>Refine with…</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.related_keywords.map(kw => (
                    <button key={kw} onClick={() => addKeyword(kw)} className="px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-70" style={{ background: 'var(--color-card)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{kw}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {keywords.length === 0 && !suggestLoading && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>Popular</p>
          <div className="flex flex-wrap gap-1.5">
            {filtered.map(kw => <button key={kw} onClick={() => addKeyword(kw)} className="px-2.5 py-1 rounded-full text-xs transition-opacity hover:opacity-70" style={{ background: 'var(--color-card)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{kw}</button>)}
          </div>
        </div>
      )}
    </div>
  )
}

function GameSquare({ game, onClick }) {
  return (
    <button onClick={onClick} className="aspect-square rounded-sm overflow-hidden relative group transition-opacity hover:opacity-90" style={{ background: 'var(--color-card)' }}>
      {game.cover_path ? <img src={`/api/games/${game.id}/cover`} alt={game.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Gamepad2 size={32} style={{ color: 'var(--color-border)' }} /></div>}
      <div className="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }}>
        <p className="text-xs font-medium text-white truncate">{game.title}</p>
      </div>
    </button>
  )
}

function PickedCard({ game, onOpenDetail }) {
  return (
    <button onClick={() => onOpenDetail(game)} className="w-full flex gap-4 rounded-lg p-3 text-left transition-opacity hover:opacity-90" style={{ background: 'var(--color-card)', border: '1px solid var(--color-accent)' }}>
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm shrink-0 overflow-hidden" style={{ background: 'var(--color-border)' }}>
        {game.cover_path ? <img src={`/api/games/${game.id}/cover`} alt={game.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Gamepad2 size={28} style={{ color: 'var(--color-muted)' }} /></div>}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-base font-semibold truncate" style={{ color: 'var(--color-text)' }}>{game.title}</p>
        {game.designers && <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>{game.designers}</p>}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
          {game.year && <span>{game.year}</span>}
          {game.min_players && <span>{game.min_players === game.max_players ? `${game.min_players}p` : `${game.min_players}–${game.max_players}p`}</span>}
          {game.min_playtime && <span>{game.min_playtime}–{game.max_playtime} min</span>}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-accent)', opacity: 0.7 }}>Tap for details</p>
      </div>
    </button>
  )
}

function HistoryCard({ game, onOpenDetail }) {
  return (
    <button onClick={() => onOpenDetail(game)} className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-opacity hover:opacity-80" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="w-8 h-8 rounded-sm shrink-0 overflow-hidden" style={{ background: 'var(--color-border)' }}>
        {game.cover_path ? <img src={`/api/games/${game.id}/cover`} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Gamepad2 size={12} style={{ color: 'var(--color-muted)' }} /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate" style={{ color: 'var(--color-text)' }}>{game.title}</p>
      </div>
    </button>
  )
}

function RelatedColumn({ title, games, loading, onPick }) {
  return (
    <div className="flex flex-col gap-3">
      <ColHeader>{title}</ColHeader>
      {loading ? [0,1].map(i => <div key={i} className="h-16 rounded-md animate-pulse" style={{ background: 'var(--color-card)' }} />) :
        games?.length > 0 ? games.map(g => (
          <button key={g.id} onClick={() => onPick(g)} className="flex items-center gap-2 rounded-md p-2 text-left transition-opacity hover:opacity-80" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <div className="w-10 h-10 rounded-sm shrink-0 overflow-hidden" style={{ background: 'var(--color-border)' }}>
              {g.cover_path ? <img src={`/api/games/${g.id}/cover`} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Gamepad2 size={14} style={{ color: 'var(--color-muted)' }} /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>{g.title}</p>
              {g.designers && <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{g.designers}</p>}
            </div>
          </button>
        )) : <p className="text-xs" style={{ color: 'var(--color-muted)' }}>None found</p>}
    </div>
  )
}

function ColHeader({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{children}</p>
}
