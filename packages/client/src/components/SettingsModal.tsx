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
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', background: 'transparent', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            Port
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 3030 })}
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            Host
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            Indexer URL
            <input
              type="text"
              value={config.indexerUrl}
              onChange={(e) => setConfig({ ...config, indexerUrl: e.target.value })}
              placeholder="http://localhost:9696"
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            Indexer API Key
            <input
              type="password"
              value={config.indexerApiKey}
              onChange={(e) => setConfig({ ...config, indexerApiKey: e.target.value })}
              placeholder="your-api-key"
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            Download Directory
            <input
              type="text"
              value={config.downloadDir}
              onChange={(e) => setConfig({ ...config, downloadDir: e.target.value })}
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </label>

          {message && (
            <div style={{ fontSize: 13, color: '#666', padding: '4px 0' }}>{message}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#0066cc',
              color: '#fff',
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
