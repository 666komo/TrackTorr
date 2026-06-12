import { useState, type FormEvent } from 'react'
import { useLang } from '../i18n'

interface SearchBarProps {
  onSearch: (query: string) => void
  searching?: boolean
}

export default function SearchBar({ onSearch, searching }: SearchBarProps) {
  const { t } = useLang()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim() && !searching) onSearch(query.trim())
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            left: 14,
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          style={{
            flex: 1,
            padding: '10px 14px 10px 42px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
      </div>
      <button
        type="submit"
        disabled={searching}
        style={{
          padding: '10px 28px',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          background: searching ? 'var(--text-muted)' : 'var(--primary)',
          color: '#fff',
          cursor: searching ? 'default' : 'pointer',
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: '0.2px',
          boxShadow: searching ? 'none' : '0 2px 8px var(--primary-glow)',
          transition: 'all .15s ease',
        }}
      >
        {searching ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin .6s linear infinite',
            }} />
            {t('search.searching')}
          </span>
        ) : t('search.button')}
      </button>
    </form>
  )
}
