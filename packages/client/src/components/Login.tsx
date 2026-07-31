import { useState, type FormEvent } from 'react'
import { useLang } from '../i18n'
import { api, setAuthToken } from '../api/client'
import trackIcon from '../../public/trackIcon.svg'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useLang()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await api.login(username, password)
      setAuthToken(res.token)
      onLogin()
    } catch (err) {
      setError((err as Error).message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)',
        opacity: 0.3,
        animation: 'neonPulse 4s ease-in-out infinite',
      }} />
      <form onSubmit={handleSubmit} style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px',
        width: 360,
        boxShadow: 'var(--shadow-lg)',
        animation: 'slideUp .35s ease',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--danger), var(--primary), var(--secondary), transparent)',
          animation: 'dataStream 3s linear infinite',
        }} />
        <div style={{
          width: 56, height: 56,
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--danger), var(--primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: 'var(--glow-cyan)',
          animation: 'cyberGlow 2s ease-in-out infinite',
        }}>
          <img
            src={trackIcon}
            alt=""
            style={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
          />
        </div>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: 28,
          fontWeight: 700,
          textAlign: 'center',
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: '3px',
          color: 'var(--primary)',
          textShadow: '0 0 10px var(--primary)',
        }}>
          TRACKTORR
        </h1>
        <p style={{
          margin: '0 0 24px',
          fontSize: 11,
          textAlign: 'center',
          color: 'var(--text-muted)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
        }}>
          ACCESS TERMINAL
        </p>
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--danger-bg)',
            borderRadius: 'var(--radius)',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--danger)',
            border: '1px solid var(--danger)',
            boxShadow: '0 0 10px rgba(255,0,102,0.3)',
            animation: 'fadeIn .3s ease',
          }}>
            {error}
          </div>
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('auth.username')}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
            marginBottom: 12,
            boxSizing: 'border-box',
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
            marginBottom: 20,
            boxSizing: 'border-box',
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
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: loading ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--danger), var(--primary))',
            color: '#000',
            cursor: loading ? 'default' : 'pointer',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontFamily: "'Orbitron', sans-serif",
            boxShadow: loading ? 'none' : 'var(--glow-cyan)',
            transition: 'all .2s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = loading ? 'none' : 'var(--glow-cyan)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 16, height: 16,
                border: '2px solid rgba(0,0,0,0.3)',
                borderTopColor: '#000',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin .6s linear infinite',
              }} />
              {t('auth.logging_in')}
            </span>
          ) : t('auth.login')}
        </button>
      </form>
    </div>
  )
}
