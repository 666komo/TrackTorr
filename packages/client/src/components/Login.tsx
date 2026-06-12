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
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        width: 320,
        boxShadow: 'var(--shadow)',
        animation: 'slideUp .35s ease',
      }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--primary), #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 4px 12px var(--primary-glow)',
        }}>
          <img
            src={trackIcon}
            alt=""
            style={{ width: 22, height: 22, filter: 'brightness(0) invert(1)' }}
          />
        </div>
        <h1 style={{
          margin: '0 0 20px',
          fontSize: 20,
          fontWeight: 700,
          textAlign: 'center',
          color: 'var(--text)',
        }}>
          TrackTorr
        </h1>
        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'var(--danger-bg)',
            borderRadius: 'var(--radius)',
            marginBottom: 12,
            fontSize: 13,
            color: 'var(--danger)',
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
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
            marginBottom: 10,
            boxSizing: 'border-box',
          }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: loading ? 'var(--text-muted)' : 'var(--primary)',
            color: '#fff',
            cursor: loading ? 'default' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: loading ? 'none' : '0 2px 8px var(--primary-glow)',
            transition: 'all .15s ease',
          }}
        >
          {loading ? t('auth.logging_in') : t('auth.login')}
        </button>
      </form>
    </div>
  )
}
