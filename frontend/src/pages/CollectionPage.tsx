import { useState } from 'react'
import DashboardPage from './DashboardPage'
import MasterSetTab from './MasterSetTab'
import WishlistTab from './WishlistTab'

type Tab = 'vault' | 'master-set' | 'wishlist'

export default function CollectionPage() {
  const [tab, setTab] = useState<Tab>('vault')

  return (
    <div className="space-y-4 page-enter">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-cv-surface p-1 w-fit">
        {(['vault', 'master-set', 'wishlist'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`px-4 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition capitalize ${
              tab === t ? 'bg-[var(--primary)] text-white' : 'text-cv-muted hover:text-cv-text'
            }`}
            onClick={() => setTab(t)}
            type="button"
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
