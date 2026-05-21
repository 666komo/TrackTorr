import { useState, type FormEvent } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  searching?: boolean
}

export default function SearchBar({ onSearch, searching }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim() && !searching) onSearch(query.trim())
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search torrents..."
        style={{
          flex: 1,
          padding: '10px 14px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
          color: 'var(--text)',
        }}
      />
      <button
        type="submit"
        disabled={searching}
        style={{
          padding: '10px 24px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: searching ? 'var(--text-muted)' : 'var(--primary)',
          color: '#fff',
          cursor: searching ? 'default' : 'pointer',
          fontWeight: 500,
        }}
      >
        {searching ? 'Searching\u2026' : 'Search'}
      </button>
    </form>
  )
}
