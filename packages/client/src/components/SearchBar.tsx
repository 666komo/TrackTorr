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
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
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
            left: 16,
            color: 'var(--primary)',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 4px var(--primary))',
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
            padding: '12px 16px 12px 46px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontSize: 14,
            transition: 'all .2s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.boxShadow = 'var(--glow-cyan)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
      </div>
      <button
        type="submit"
        disabled={searching}
        style={{
          padding: '12px 32px',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          background: searching ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--danger), var(--primary))',
          color: '#000',
          cursor: searching ? 'default' : 'pointer',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontFamily: "'Orbitron', sans-serif",
          boxShadow: searching ? 'none' : 'var(--glow-cyan)',
          transition: 'all .2s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          if (!searching) {
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = searching ? 'none' : 'var(--glow-cyan)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {searching ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 16, height: 16,
              border: '2px solid rgba(0,0,0,0.3)',
              borderTopColor: '#000',
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
