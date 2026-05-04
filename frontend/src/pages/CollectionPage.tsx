import { useState } from 'react'
import DashboardPage from './DashboardPage'
import MasterSetTab from './MasterSetTab'
import WishlistTab from './WishlistTab'

type Tab = 'vault' | 'master-set' | 'wishlist'

export default function CollectionPage() {
  const [tab, setTab] = useState<Tab>('vault')

  return (
    <div className="space-y-4 page-enter">
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 20, height: 2, background: 'var(--gold)' }} />
          <span style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: 'uppercase' }}>Vault</span>
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 600, margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.1 }}>My Collection</h1>
      </div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', width: 'fit-content' }}>
        {(['vault', 'master-set', 'wishlist'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            type="button"
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              border: 'none',
              background: tab === t ? 'var(--gold)' : 'transparent',
              color: tab === t ? '#06060A' : 'var(--text-dim)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'vault' ? 'My Vault' : t === 'master-set' ? 'Master Set' : 'Wishlist'}
          </button>
        ))}
      </div>

      {tab === 'vault' && <DashboardPage />}
      {tab === 'master-set' && <MasterSetTab />}
      {tab === 'wishlist' && <WishlistTab />}
    </div>
  )
}
