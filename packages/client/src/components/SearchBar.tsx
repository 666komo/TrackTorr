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
        style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}
      />
      <button
        type="submit"
        disabled={searching}
        style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#0066cc', color: '#fff', cursor: searching ? 'default' : 'pointer', opacity: searching ? 0.6 : 1 }}
      >
        {searching ? 'Searching...' : 'Search'}
      </button>
    </form>
  )
}
