import { useState } from 'react'
import { Search, Plus, Check, Gamepad2, ScanBarcode, Users } from 'lucide-react'
import TagEditor from '../../components/TagEditor'

const MODE = { SEARCH: 'search', BARCODE: 'barcode', IMPORT: 'import' }
const STEP = { INPUT: 'input', RESULTS: 'results', CONFIRM: 'confirm', DONE: 'done', IMPORT_LIST: 'import_list' }

export default function AddGame() {
  const [mode, setMode] = useState(MODE.SEARCH)
  const [step, setStep] = useState(STEP.INPUT)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [detail, setDetail] = useState(null)
  const [importList, setImportList] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [importProgress, setImportProgress] = useState(null) // {done, total}

  function reset() {
    setStep(STEP.INPUT); setQuery(''); setResults([]); setDetail(null)
    setImportList([]); setSelected(new Set()); setNotes(''); setTags([])
    setError(null); setImportProgress(null)
  }
  function switchMode(m) { setMode(m); reset() }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(null)
    try {
      const endpoint = mode === MODE.BARCODE
        ? `/api/games/lookup/barcode/${encodeURIComponent(query.trim())}`
        : `/api/games/lookup/search?q=${encodeURIComponent(query.trim())}`
      const res = await fetch(endpoint)
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Search failed') }
      setResults(await res.json())
      setStep(STEP.RESULTS)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handlePickResult(candidate) {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/games/lookup/game/${candidate.bgg_id}`)
      if (!res.ok) throw new Error('Could not fetch game details')
      setDetail(await res.json())
      setStep(STEP.CONFIRM)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!detail) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/games/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...detail, notes, tags }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Save failed') }
      const saved = await res.json()
      // Fire-and-forget: auto-suggest tags in background (ignore rate-limit errors)
      fetch(`/api/ai/suggest/games/${saved.id}`, { method: 'POST' }).catch(() => {})
      setStep(STEP.DONE)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // BGG import
  async function handleFetchImport(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/games/lookup/import-bgg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: query.trim() }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Import failed') }
      const list = await res.json()
      setImportList(list)
      setSelected(new Set(list.map(g => g.bgg_id)))
      setStep(STEP.IMPORT_LIST)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleImportSelected() {
    const toImport = importList.filter(g => selected.has(g.bgg_id))
    setImportProgress({ done: 0, total: toImport.length })
    setError(null)
    let done = 0
    for (const game of toImport) {
      try {
        await fetch('/api/games/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...game, tags: [] }),
        })
      } catch { /* skip individual failures */ }
      done++
      setImportProgress({ done, total: toImport.length })
    }
    setStep(STEP.DONE)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === STEP.DONE) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
          <Check size={26} color="#000" />
        </div>
        <p className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
          {importProgress ? `Imported ${importProgress.done} game${importProgress.done !== 1 ? 's' : ''}!` : 'Added to your collection!'}
        </p>
        <button onClick={reset} className="px-4 py-2 rounded-md text-sm" style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
          Add another
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Add Game</h1>

      {/* Mode tabs */}
      {step === STEP.INPUT && (
        <div className="flex rounded-lg p-1 gap-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <TabButton active={mode === MODE.SEARCH} onClick={() => switchMode(MODE.SEARCH)} icon={<Search size={14} />}>Search</TabButton>
          <TabButton active={mode === MODE.BARCODE} onClick={() => switchMode(MODE.BARCODE)} icon={<ScanBarcode size={14} />}>Barcode</TabButton>
          <TabButton active={mode === MODE.IMPORT} onClick={() => switchMode(MODE.IMPORT)} icon={<Users size={14} />}>BGG Import</TabButton>
        </div>
      )}

      {/* Input step */}
      {step === STEP.INPUT && (
        <form onSubmit={mode === MODE.IMPORT ? handleFetchImport : handleSearch} className="space-y-3">
          {mode === MODE.SEARCH && (
            <>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Search by game title on BoardGameGeek.</p>
              <SearchField placeholder="e.g. Gloomhaven" value={query} onChange={setQuery} loading={loading} submitLabel="Search" />
            </>
          )}
          {mode === MODE.BARCODE && (
            <>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Enter the barcode (UPC/EAN) from the game box.</p>
              <SearchField placeholder="Barcode number" value={query} onChange={setQuery} loading={loading} submitLabel="Look up" />
            </>
          )}
          {mode === MODE.IMPORT && (
            <>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Enter your BoardGameGeek username to import your owned collection. You can deselect individual games before importing.
              </p>
              <SearchField placeholder="BGG username" value={query} onChange={setQuery} loading={loading} submitLabel="Fetch" />
            </>
          )}
        </form>
      )}

      {error && <p className="text-xs px-1" style={{ color: '#f87171' }}>{error}</p>}

      {/* Results step */}
      {step === STEP.RESULTS && (
        <div className="space-y-2">
          <StepHeader title="Pick the game" onBack={() => { setStep(STEP.INPUT); setError(null) }} />
          {results.map(r => (
            <button
              key={r.bgg_id}
              onClick={() => handlePickResult(r)}
              disabled={loading}
              className="w-full flex items-center gap-3 rounded-md p-3 text-left transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
            >
              <Thumb url={r.cover_url} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{r.title}</p>
                <div className="flex flex-wrap gap-x-2 mt-0.5">
                  {r.year && <Badge>{r.year}</Badge>}
                  {r.min_players && <Badge>{r.min_players === r.max_players ? `${r.min_players}p` : `${r.min_players}–${r.max_players}p`}</Badge>}
                  {r.min_playtime && <Badge>{r.min_playtime}–{r.max_playtime} min</Badge>}
                  {r.bgg_rating && <Badge>★ {r.bgg_rating}</Badge>}
                </div>
              </div>
            </button>
          ))}
          {loading && <p className="text-xs text-center py-2" style={{ color: 'var(--color-muted)' }}>Fetching details…</p>}
        </div>
      )}

      {/* BGG import list */}
      {step === STEP.IMPORT_LIST && (
        <div className="space-y-3">
          <StepHeader title={`${importList.length} games found`} onBack={() => { setStep(STEP.INPUT); setError(null) }} />
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Deselect any games you don't want to import.</p>
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {importList.map(g => (
              <label key={g.bgg_id} className="flex items-center gap-3 rounded-md p-2 cursor-pointer" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                <input
                  type="checkbox"
                  checked={selected.has(g.bgg_id)}
                  onChange={e => {
                    const next = new Set(selected)
                    e.target.checked ? next.add(g.bgg_id) : next.delete(g.bgg_id)
                    setSelected(next)
                  }}
                  className="accent-amber-400"
                />
                <Thumb url={g.cover_url} small />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>{g.title}</p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{g.year ?? '—'}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={handleImportSelected}
            disabled={loading || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            <Plus size={15} />
            {loading && importProgress
              ? `Importing… ${importProgress.done}/${importProgress.total}`
              : `Import ${selected.size} game${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Confirm step */}
      {step === STEP.CONFIRM && detail && (
        <div className="space-y-3">
          <StepHeader title="Confirm & save" onBack={() => { setStep(STEP.RESULTS); setError(null) }} />
          <div className="flex gap-4 rounded-lg p-3" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <div className="w-20 h-20 rounded-sm overflow-hidden shrink-0" style={{ background: 'var(--color-border)' }}>
              {detail.cover_url
                ? <img src={detail.cover_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Gamepad2 size={24} style={{ color: 'var(--color-muted)' }} /></div>}
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <Field label="Title" value={detail.title} />
              <Field label="Year" value={detail.year} />
              <Field label="Designer" value={detail.designers} />
              <Field label="Publisher" value={detail.publisher} />
              <Field label="Players" value={detail.min_players && `${detail.min_players}${detail.min_players !== detail.max_players ? `–${detail.max_players}` : ''}`} />
              <Field label="Playtime" value={detail.min_playtime && `${detail.min_playtime}${detail.min_playtime !== detail.max_playtime ? `–${detail.max_playtime}` : ''} min`} />
              <Field label="Age" value={detail.min_age && `${detail.min_age}+`} />
              <Field label="Category" value={detail.categories} />
              <Field label="Mechanics" value={detail.mechanics} />
              {detail.bgg_rating && <Field label="BGG rating" value={detail.bgg_rating.toFixed(2)} accent />}
            </div>
          </div>

          <textarea
            placeholder="Personal notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
            style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />

          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>Tags (optional)</p>
            <TagEditor initialTags={tags} onChange={setTags} />
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            <Plus size={15} />
            {loading ? 'Saving…' : 'Add to collection'}
          </button>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button type="button" onClick={onClick} className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
      style={{ background: active ? 'var(--color-card)' : 'transparent', color: active ? 'var(--color-accent)' : 'var(--color-muted)', border: active ? '1px solid var(--color-border)' : '1px solid transparent' }}>
      {icon}{children}
    </button>
  )
}

function SearchField({ placeholder, value, onChange, loading, submitLabel }) {
  return (
    <div className="flex gap-2">
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} autoFocus
        className="flex-1 rounded-md px-3 py-2.5 text-sm outline-none"
        style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
      />
      <button type="submit" disabled={loading || !value.trim()} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40" style={{ background: 'var(--color-accent)', color: '#000' }}>
        <Search size={14} />{loading ? '…' : submitLabel}
      </button>
    </div>
  )
}

function StepHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <button onClick={onBack} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--color-muted)' }}>← Back</button>
      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{title}</span>
    </div>
  )
}

function Thumb({ url, small }) {
  const size = small ? 'w-8 h-8' : 'w-12 h-12'
  return (
    <div className={`${size} rounded-sm shrink-0 overflow-hidden`} style={{ background: 'var(--color-border)' }}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Gamepad2 size={small ? 12 : 16} style={{ color: 'var(--color-muted)' }} /></div>}
    </div>
  )
}

function Badge({ children }) {
  return <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{children}</span>
}

function Field({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-xs" style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span className="text-xs flex-1 truncate" style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text)' }}>{value}</span>
    </div>
  )
}
