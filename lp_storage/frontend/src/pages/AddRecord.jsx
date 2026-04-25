import { useState } from 'react'
import { Search, Plus, Check, Hash, Disc3, Fingerprint, ScanBarcode } from 'lucide-react'
import TagEditor from '../components/TagEditor'

const MODE = { CATNO: 'catno', TITLE: 'title', DEADWAX: 'deadwax', BARCODE: 'barcode' }
const STEP = { INPUT: 'input', MASTERS: 'masters', PRESSINGS: 'pressings', CONFIRM: 'confirm', DONE: 'done' }

export default function AddRecord() {
  const [mode, setMode] = useState(MODE.CATNO)
  const [step, setStep] = useState(STEP.INPUT)

  // shared state across steps
  const [query, setQuery] = useState('')
  const [masters, setMasters] = useState([])
  const [pressings, setPressings] = useState([])
  const [detail, setDetail] = useState(null)
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function reset() {
    setStep(STEP.INPUT)
    setQuery('')
    setMasters([])
    setPressings([])
    setDetail(null)
    setNotes('')
    setTags([])
    setError(null)
  }

  function switchMode(m) {
    setMode(m)
    reset()
  }

  // ── Step handlers ──────────────────────────────────────────────────────────

  async function handleDeadwaxSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lookup/deadwax?q=${encodeURIComponent(query.trim())}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Search failed')
      }
      const data = await res.json()
      setPressings(data)
      setStep(STEP.PRESSINGS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleBarcodeSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lookup/barcode/${encodeURIComponent(query.trim())}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Barcode lookup failed')
      }
      const data = await res.json()
      setPressings(data)
      setStep(STEP.PRESSINGS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCatnoSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lookup/catno?q=${encodeURIComponent(query.trim())}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      if (data.length === 0) throw new Error('No vinyl releases found for that catalog number')
      setPressings(data)
      setStep(STEP.PRESSINGS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleMasterSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lookup/masters?q=${encodeURIComponent(query.trim())}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      if (data.length === 0) throw new Error('No results found — try a different query')
      setMasters(data)
      setStep(STEP.MASTERS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePickMaster(master) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lookup/masters/${master.master_id}/versions`)
      if (!res.ok) throw new Error('Could not fetch pressings')
      const data = await res.json()
      if (data.length === 0) throw new Error('No vinyl pressings found for this release')
      setPressings(data)
      setStep(STEP.PRESSINGS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePickPressing(pressing) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lookup/release/${pressing.discogs_id}`)
      if (!res.ok) throw new Error('Could not fetch release details')
      setDetail(await res.json())
      setStep(STEP.CONFIRM)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!detail) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/records/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...detail, notes, tags }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Save failed')
      }
      const saved = await res.json()
      // Fire-and-forget: auto-suggest tags in background (ignore rate-limit errors)
      fetch(`/api/ai/suggest/records/${saved.id}`, { method: 'POST' }).catch(() => {})
      setStep(STEP.DONE)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === STEP.DONE) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-accent)' }}
        >
          <Check size={26} color="#000" />
        </div>
        <p className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
          Added to your collection!
        </p>
        <button onClick={reset} className="btn-secondary">
          Add another
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
        Add Record
      </h1>

      {/* Mode tabs */}
      {step === STEP.INPUT && (
        <div
          className="flex rounded-lg p-1 gap-1"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <TabButton active={mode === MODE.CATNO} onClick={() => switchMode(MODE.CATNO)} icon={<Hash size={14} />}>
            Catalog no.
          </TabButton>
          <TabButton active={mode === MODE.TITLE} onClick={() => switchMode(MODE.TITLE)} icon={<Search size={14} />}>
            Artist / title
          </TabButton>
          <TabButton active={mode === MODE.BARCODE} onClick={() => switchMode(MODE.BARCODE)} icon={<ScanBarcode size={14} />}>
            Barcode
          </TabButton>
          <TabButton active={mode === MODE.DEADWAX} onClick={() => switchMode(MODE.DEADWAX)} icon={<Fingerprint size={14} />}>
            Dead wax
          </TabButton>
        </div>
      )}

      {/* Step: Input */}
      {step === STEP.INPUT && (
        <form
          onSubmit={
            mode === MODE.CATNO    ? handleCatnoSearch
            : mode === MODE.DEADWAX  ? handleDeadwaxSearch
            : mode === MODE.BARCODE  ? handleBarcodeSearch
            : handleMasterSearch
          }
          className="space-y-3"
        >
          {mode === MODE.CATNO && (
            <>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Find the catalog number on the record label — e.g. <span style={{ color: 'var(--color-text)' }}>ILPS 9114</span> or <span style={{ color: 'var(--color-text)' }}>K 50595</span>
              </p>
              <SearchField placeholder="Catalog number" value={query} onChange={setQuery} loading={loading} submitLabel="Look up" />
            </>
          )}
          {mode === MODE.TITLE && (
            <>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Search by artist and/or album title. You'll pick the exact pressing in the next step.
              </p>
              <SearchField placeholder="e.g. Radiohead OK Computer" value={query} onChange={setQuery} loading={loading} submitLabel="Search" />
            </>
          )}
          {mode === MODE.BARCODE && (
            <>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Enter the barcode (UPC/EAN) printed on the record sleeve or inner sleeve.
              </p>
              <SearchField placeholder="Barcode number" value={query} onChange={setQuery} loading={loading} submitLabel="Look up" />
            </>
          )}
          {mode === MODE.DEADWAX && (
            <>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Enter the code etched in the dead wax (runout groove) — the area between the last track and the label. Usually looks like <span style={{ color: 'var(--color-text)' }}>ILPS 9114 A</span> or <span style={{ color: 'var(--color-text)' }}>BST-84371-A</span>
              </p>
              <SearchField placeholder="Dead wax / matrix code" value={query} onChange={setQuery} loading={loading} submitLabel="Look up" />
            </>
          )}
        </form>
      )}

      {error && (
        <p className="text-xs px-1" style={{ color: '#f87171' }}>{error}</p>
      )}

      {/* Step: Master results */}
      {step === STEP.MASTERS && (
        <div className="space-y-2">
          <StepHeader
            title="Pick the album"
            onBack={() => { setStep(STEP.INPUT); setError(null) }}
          />
          {masters.map(m => (
            <button
              key={m.master_id}
              onClick={() => handlePickMaster(m)}
              disabled={loading}
              className="w-full flex items-center gap-3 rounded-md p-3 text-left transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
            >
              <Thumbnail url={m.cover_url} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{m.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{m.artist}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  {[m.year, m.genre].filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
          {loading && <LoadingHint text="Loading pressings…" />}
        </div>
      )}

      {/* Step: Pressing list (used by both modes) */}
      {step === STEP.PRESSINGS && (
        <div className="space-y-2">
          <StepHeader
            title="Pick the pressing"
            onBack={() => {
              setError(null)
              setStep(mode === MODE.TITLE ? STEP.MASTERS : STEP.INPUT)
            }}
          />
          <p className="text-xs pb-1" style={{ color: 'var(--color-muted)' }}>
            {pressings.length} vinyl pressing{pressings.length !== 1 ? 's' : ''} found
          </p>
          {pressings.map(p => (
            <button
              key={p.discogs_id}
              onClick={() => handlePickPressing(p)}
              disabled={loading}
              className="w-full flex items-center gap-3 rounded-md p-3 text-left transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
            >
              <Thumbnail url={p.cover_url} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{p.artist}</p>
                <div className="flex flex-wrap gap-x-2 mt-0.5">
                  {p.year      && <Badge>{p.year}</Badge>}
                  {p.country   && <Badge>{p.country}</Badge>}
                  {p.label     && <Badge>{p.label}</Badge>}
                  {p.catalog_number && <Badge>{p.catalog_number}</Badge>}
                  {p.format    && <Badge>{p.format}</Badge>}
                </div>
              </div>
            </button>
          ))}
          {loading && <LoadingHint text="Fetching release details…" />}
        </div>
      )}

      {/* Step: Confirm */}
      {step === STEP.CONFIRM && detail && (
        <div className="space-y-3">
          <StepHeader
            title="Confirm & save"
            onBack={() => { setStep(STEP.PRESSINGS); setError(null) }}
          />

          {/* Cover + summary */}
          <div
            className="flex gap-4 rounded-lg p-3"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="w-20 h-20 rounded-sm overflow-hidden shrink-0" style={{ background: 'var(--color-border)' }}>
              {detail.cover_url ? (
                <img src={detail.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc3 size={24} style={{ color: 'var(--color-muted)' }} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <Field label="Title"   value={detail.title} />
              <Field label="Artist"  value={detail.artist} />
              <Field label="Year"    value={detail.year} />
              <Field label="Label"   value={detail.label} />
              <Field label="Cat. no" value={detail.catalog_number} />
              <Field label="Format"  value={detail.format} />
              <Field label="Country" value={detail.country} />
              <Field label="Genre"   value={[detail.genre, detail.styles].filter(Boolean).join(' · ')} />
              {detail.lowest_price != null && (
                <Field
                  label="Price"
                  value={`${detail.price_currency} ${Number(detail.lowest_price).toFixed(2)} (lowest at time of adding)`}
                  accent
                />
              )}
            </div>
          </div>

          <textarea
            placeholder="Personal notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
            style={{
              background: 'var(--color-card)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
          />

          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>
              Tags (optional)
            </p>
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

// ── Sub-components ─────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
      style={{
        background: active ? 'var(--color-card)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
        border: active ? '1px solid var(--color-border)' : '1px solid transparent',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

function SearchField({ placeholder, value, onChange, loading, submitLabel }) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus
        className="flex-1 rounded-md px-3 py-2.5 text-sm outline-none"
        style={{
          background: 'var(--color-card)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        <Search size={14} />
        {loading ? '…' : submitLabel}
      </button>
    </div>
  )
}

function StepHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <button
        onClick={onBack}
        className="text-xs transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-muted)' }}
      >
        ← Back
      </button>
      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{title}</span>
    </div>
  )
}

function Thumbnail({ url }) {
  return (
    <div className="w-12 h-12 rounded-sm shrink-0 overflow-hidden" style={{ background: 'var(--color-border)' }}>
      {url
        ? <img src={url} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center"><Disc3 size={16} style={{ color: 'var(--color-muted)' }} /></div>
      }
    </div>
  )
}

function Badge({ children }) {
  return (
    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{children}</span>
  )
}

function Field({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-xs" style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span className="text-xs flex-1 truncate" style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  )
}

function LoadingHint({ text }) {
  return (
    <p className="text-xs text-center py-2" style={{ color: 'var(--color-muted)' }}>{text}</p>
  )
}
