import { useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { SealedProduct } from '../lib/api'

// Full sealed product type label map — expanded from TCGCSV product detection
const TYPE_LABELS: Record<string, string> = {
  booster_box: 'Booster Box',
  elite_trainer_box: 'Elite Trainer Box',
  ultra_premium_collection: 'Ultra Premium Collection',
  premium_collection: 'Premium Collection',
  special_collection: 'Special Collection',
  super_premium_collection: 'Super Premium Collection',
  booster_bundle: 'Booster Bundle',
  booster_pack: 'Booster Pack',
  figure_collection: 'Figure Collection',
  poster_collection: 'Poster Collection',
  pin_collection: 'Pin Collection',
  collection_box: 'Collection Box',
  tin: 'Tin',
  mini_tin: 'Mini Tin',
  build_and_battle: 'Build & Battle Box',
  battle_deck: 'Battle Deck',
  blister_pack: 'Blister Pack',
  gift_set: 'Gift Set',
  binder_collection: 'Binder Collection',
  world_championship_deck: 'World Championship Deck',
  theme_deck: 'Theme Deck',
  other: 'Sealed Product',
}

export default function SearchPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedSet, setSelectedSet] = useState('')
  const [refreshingId, setRefreshingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sealed-products'],
    queryFn: () => api.listSealedProducts({ limit: 500 }),
    staleTime: 1000 * 60 * 5,
  })
  const products: SealedProduct[] = data?.products ?? []

  const refreshPrice = useMutation({
    mutationFn: (product: SealedProduct) =>
      api.refreshSealedPrice(product.tcgplayer_product_id!),
    onMutate: (product) => setRefreshingId(product.id),
    onSettled: () => {
      setRefreshingId(null)
      void queryClient.invalidateQueries({ queryKey: ['sealed-products'] })
    },
  })

  // Derive unique set names for the set filter dropdown
  const setNames = useMemo(() => {
    const names = new Set<string>()
    products.forEach((p) => { if (p.set_name) names.add(p.set_name) })
    return Array.from(names).sort()
  }, [products])

  const filtered = useMemo(() => {
    let result = products
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.set_name ?? '').toLowerCase().includes(q),
      )
    }
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.product_type === typeFilter)
    }
    if (selectedSet) {
      result = result.filter((p) => p.set_name === selectedSet)
    }
  }, [products, search, typeFilter, selectedSet])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-cv-muted text-sm">
        Loading sealed products…
      </div>
    )
  }

  return (
    <div className="space-y-4 page-enter">
      <h2 className="text-lg font-bold">Sealed Products</h2>

      {/* Filters */}
      <div className="glass p-4 space-y-3">
        <input
          className="input w-full"
          placeholder="Search by name or set…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <select
            className="input flex-1 min-w-[160px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            className="input flex-1 min-w-[160px]"
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
          >
            <option value="">All Sets</option>
            {setNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {filtered.length !== products.length && (
          <p className="text-xs text-cv-muted">
            Showing {filtered.length} of {products.length} products
            <button
              className="ml-2 text-[var(--primary)] hover:underline"
              type="button"
              onClick={() => { setSearch(''); setTypeFilter('all'); setSelectedSet('') }}
            >
              Clear filters
            </button>
          </p>
        )}
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-cv-muted text-center py-10">No sealed products found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((product) => (
            <div key={product.id} className="glass p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-snug line-clamp-2">{product.name}</h3>
                {product.tcgplayer_url && (
                  <a
                    href={product.tcgplayer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-cv-muted hover:text-[var(--primary)] transition"
                    title="View on TCGPlayer"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>

              {product.set_name && (
                <p className="text-xs text-cv-muted">{product.set_name}</p>
              )}

              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="badge badge-info">
                  {TYPE_LABELS[product.product_type] ?? 'Sealed Product'}
                </span>
                {product.release_date && (
                  <span className="badge">{product.release_date}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--primary)]">
                  {product.market_price_cents != null
                    ? `$${(product.market_price_cents / 100).toFixed(2)}`
                    : 'No price'}
                </span>
                {product.tcgplayer_product_id != null && (
                  <button
                    type="button"
                    className="btn-ghost text-xs flex items-center gap-1 text-cv-muted hover:text-[var(--primary)]"
                    disabled={refreshingId === product.id}
                    onClick={() => refreshPrice.mutate(product)}
                    title="Refresh live price from TCGCSV"
                  >
                    <RefreshCw
                      size={12}
                      className={refreshingId === product.id ? 'animate-spin' : ''}
                    />
                    Refresh
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
