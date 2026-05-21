import { useState, useEffect, type FormEvent } from 'react'
import { api } from '../api/client'
import type { AppConfig } from '../types'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<AppConfig>({
    port: 3030, host: '0.0.0.0', indexerUrl: '', indexerApiKey: '', downloadDir: '/tmp/tracktorr-downloads',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveConfig(config)
      setMessage(res.message)
    } catch {
      setMessage('Failed to save configuration')
    }
    setSaving(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          width: 420,
          maxWidth: '90vw',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>Settings</h2>
          <button
            onClick={onClose}
            style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            Port
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 3030 })}
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            Host
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            Indexer URL
            <input
              type="text"
              value={config.indexerUrl}
              onChange={(e) => setConfig({ ...config, indexerUrl: e.target.value })}
              placeholder="http://localhost:9696"
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            Indexer API Key
            <input
              type="password"
              value={config.indexerApiKey}
              onChange={(e) => setConfig({ ...config, indexerApiKey: e.target.value })}
              placeholder="your-api-key"
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            Download Directory
            <input
              type="text"
              value={config.downloadDir}
              onChange={(e) => setConfig({ ...config, downloadDir: e.target.value })}
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </label>

          {message && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '6px 0' }}>{message}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: saving ? 'var(--text-muted)' : 'var(--primary)',
              color: '#fff',
              cursor: saving ? 'default' : 'pointer',
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
