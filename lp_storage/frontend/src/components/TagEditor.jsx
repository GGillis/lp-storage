import { useState } from 'react'
import { X, Plus } from 'lucide-react'

/**
 * TagEditor — display tags as pills, add new ones, remove existing ones.
 *
 * Two modes:
 *   - controlled (recordId provided): persists changes immediately via the API
 *   - uncontrolled (no recordId): calls onChange(newTagsArray) for parent to handle
 */
export default function TagEditor({ recordId, apiBase = '/api/records', initialTags = [], onChange }) {
  const [tags, setTags] = useState(initialTags)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function addTag(raw) {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    setInput('')

    if (recordId) {
      setLoading(true)
      try {
        const res = await fetch(`${apiBase}/${recordId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag }),
        })
        if (!res.ok) return
        const updated = await res.json()
        setTags(updated)
        onChange?.(updated)
      } finally {
        setLoading(false)
      }
    } else {
      const updated = [...tags, tag].sort()
      setTags(updated)
      onChange?.(updated)
    }
  }

  async function removeTag(tag) {
    if (recordId) {
      setLoading(true)
      try {
        const res = await fetch(`${apiBase}/${recordId}/tags/${encodeURIComponent(tag)}`, {
          method: 'DELETE',
        })
        if (!res.ok) return
        const updated = await res.json()
        setTags(updated)
        onChange?.(updated)
      } finally {
        setLoading(false)
      }
    } else {
      const updated = tags.filter(t => t !== tag)
      setTags(updated)
      onChange?.(updated)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(tag => (
          <span
            key={tag}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--color-card)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              disabled={loading}
              className="opacity-60 hover:opacity-100 transition-opacity"
              aria-label={`Remove tag ${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add tag…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="flex-1 rounded-md px-3 py-1.5 text-xs outline-none disabled:opacity-50"
          style={{
            background: 'var(--color-card)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <button
          type="button"
          onClick={() => addTag(input)}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-opacity hover:opacity-80 disabled:opacity-30"
          style={{ background: 'var(--color-card)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
          aria-label="Add tag"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--color-muted)', opacity: 0.6 }}>
        Press Enter to add · Backspace to remove last
      </p>
    </div>
  )
}
