import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Plus, Search, Download, Trash2,
  BarChart2, Star, Package, Layers, X,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth, useCollection } from '../lib/hooks'
import type { CollectionItem } from '../lib/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtShort(cents: number | null | undefined): string {
  if (cents == null) return '—'
  const v = cents / 100
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(2)}`
}

function getCardValue(item: CollectionItem): number {
  return item.latest_sold_price_cents ?? item.estimated_value_cents ?? 0
}

function getCardDelta(item: CollectionItem): number | null {
  if (item.latest_sold_price_cents != null && (item as any).previous_sold_price_cents != null) {
    return item.latest_sold_price_cents - (item as any).previous_sold_price_cents
  }
  return null
}

function getCardImage(item: CollectionItem): string | null {
  if (item.front_image_url) return item.front_image_url
  if (item.card?.image_url) return item.card.image_url
  if (item.image_url) return item.image_url
  return null
}

function getDisplayName(item: CollectionItem): string {
  return item.card_name ?? item.card?.card_name ?? item.product_name ?? 'Unknown Card'
}

function getSetName(item: CollectionItem): string {
  return item.set_name ?? item.card?.set_name ?? ''
}

function getGameLabel(item: CollectionItem): string {
  const g = item.game ?? item.card?.game ?? item.sport ?? item.card?.sport ?? ''
  return g
}

// ── Condition badge ───────────────────────────────────────────────────────────
const CONDITION_COLORS: Record<string, string> = {
  'Near Mint': '#4ECBA0',
  'NM': '#4ECBA0',
  'Lightly Played': '#D4AF37',
  'LP': '#D4AF37',
  'Moderately Played': '#D4AF37',
  'MP': '#D4AF37',
  'Heavily Played': '#F06060',
  'HP': '#F06060',
  'Damaged': '#F06060',
  'PSA 10': '#D4AF37',
  'PSA 9': '#D4AF37',
}

function conditionColor(cond: string | null | undefined): string {
  if (!cond) return 'rgba(255,255,255,0.3)'
  for (const [k, v] of Object.entries(CONDITION_COLORS)) {
    if (cond.toLowerCase().includes(k.toLowerCase())) return v
  }
  return 'rgba(255,255,255,0.3)'
}

// ── Portfolio Card Tile ───────────────────────────────────────────────────────
function PortfolioCardTile({
  item,
  onRemove,
  selected,
  selectMode,
  onToggleSelect,
}: {
  item: CollectionItem
  onRemove: (id: number) => void
  selected: boolean
  selectMode: boolean
  onToggleSelect: (id: number) => void
}) {
  const value = getCardValue(item)
  const delta = getCardDelta(item)
  const img = getCardImage(item)
  const name = getDisplayName(item)
  const set = getSetName(item)
  const cond = item.condition_note ?? item.condition_notes ?? item.estimated_grade ?? null
  const qty = item.quantity ?? 1

  return (
    <div
      className="glass card-hover relative flex flex-col overflow-hidden cursor-pointer"
      style={{
        borderRadius: 'var(--radius-md)',
        border: selected ? '1.5px solid var(--primary)' : '1px solid rgba(212,175,55,0.10)',
      }}
      onClick={() => selectMode ? onToggleSelect(item.id) : undefined}
    >
      {/* Select checkbox */}
      {selectMode && (
        <div
          className="absolute top-2 left-2 z-10 h-5 w-5 rounded-full flex items-center justify-center"
          style={{
            background: selected ? 'var(--primary)' : 'rgba(0,0,0,0.6)',
            border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
          }}
        >
          {selected && <span className="text-black text-xs font-bold">✓</span>}
        </div>
      )}

      {/* Card image */}
      <div className="relative w-full" style={{ paddingBottom: '140%', background: 'rgba(0,0,0,0.3)' }}>
        {img ? (
          <img
            src={img}
            alt={name}
            className="absolute inset-0 h-full w-full object-contain p-1"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-8 w-8 text-cv-muted opacity-30" />
          </div>
        )}
        {/* Value badge */}
        {value > 0 && (
          <div
            className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(0,0,0,0.75)', color: '#D4AF37' }}
          >
            {fmtShort(value)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2">
        <p className="text-xs font-semibold truncate leading-tight">{name}</p>
        {set && <p className="text-[10px] text-cv-muted truncate">{set}</p>}
        <div className="flex items-center justify-between mt-0.5">
          {cond && (
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: `${conditionColor(cond)}22`, color: conditionColor(cond) }}
            >
              {cond}
            </span>
          )}
          {qty > 1 && (
            <span className="text-[9px] text-cv-muted ml-auto">×{qty}</span>
          )}
        </div>
        {/* Delta */}
        {delta != null && (
          <div
            className="flex items-center gap-0.5 text-[10px] font-medium mt-0.5"
            style={{ color: delta >= 0 ? '#4ECBA0' : '#F06060' }}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {fmt(Math.abs(delta))}
          </div>
        )}
      </div>

      {/* Remove button (non-select mode) */}
      {!selectMode && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(240,96,96,0.15)', color: '#F06060' }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ── Portfolio List Row ────────────────────────────────────────────────────────
function PortfolioListRow({
  item,
  onRemove,
}: {
  item: CollectionItem
  onRemove: (id: number) => void
}) {
  const value = getCardValue(item)
  const delta = getCardDelta(item)
  const img = getCardImage(item)
  const name = getDisplayName(item)
  const set = getSetName(item)
  const cond = item.condition_note ?? item.condition_notes ?? item.estimated_grade ?? null
  const qty = item.quantity ?? 1

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-cv-border last:border-0 group">
      {/* Image */}
      <div
        className="shrink-0 rounded-[var(--radius-sm)] overflow-hidden"
        style={{ width: 40, height: 56, background: 'rgba(0,0,0,0.3)' }}
      >
        {img ? (
          <img src={img} alt={name} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-4 w-4 text-cv-muted opacity-30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-xs text-cv-muted truncate">{set}</p>
        {cond && (
          <span
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
            style={{ background: `${conditionColor(cond)}22`, color: conditionColor(cond) }}
          >
            {cond}
          </span>
        )}
      </div>

      {/* Qty */}
      <div className="text-xs text-cv-muted shrink-0">×{qty}</div>

      {/* Value + delta */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold" style={{ color: '#D4AF37' }}>{fmt(value)}</p>
        {delta != null && (
          <p
            className="text-[10px] font-medium"
            style={{ color: delta >= 0 ? '#4ECBA0' : '#F06060' }}
          >
            {delta >= 0 ? '+' : ''}{fmt(delta)}
          </p>
        )}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(240,96,96,0.10)', color: '#F06060' }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Main PortfolioPage ────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { data: user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: collection = [], isLoading } = useCollection(true)
  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.getDashboardSummary(),
    enabled: !!user,
  })

  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [gameFilter, setGameFilter] = useState('All')
  const [condFilter, setCondFilter] = useState('All')
  const [sortBy, setSortBy] = useState<'value-desc' | 'value-asc' | 'name-asc' | 'added-desc'>('value-desc')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<'overview' | 'collection'>('overview')

  // Derive game list
  const games = useMemo(() => {
    const s = new Set<string>()
    collection.forEach(item => {
      const g = getGameLabel(item)
      if (g) s.add(g)
    })
    return ['All', ...Array.from(s).sort()]
  }, [collection])

  // Filtered + sorted collection
  const filtered = useMemo(() => {
    let items = [...collection]
    if (gameFilter !== 'All') items = items.filter(i => getGameLabel(i) === gameFilter)
    if (condFilter !== 'All') items = items.filter(i => {
      const c = i.condition_note ?? i.condition_notes ?? i.estimated_grade ?? ''
      return c.toLowerCase().includes(condFilter.toLowerCase())
    })
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(i =>
        getDisplayName(i).toLowerCase().includes(q) ||
        getSetName(i).toLowerCase().includes(q)
      )
    }
    switch (sortBy) {
      case 'value-desc': items.sort((a, b) => getCardValue(b) - getCardValue(a)); break
      case 'value-asc': items.sort((a, b) => getCardValue(a) - getCardValue(b)); break
      case 'name-asc': items.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))); break
      case 'added-desc': items.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()); break
    }
    return items
  }, [collection, gameFilter, condFilter, search, sortBy])

  // Portfolio totals
  const totalValue = useMemo(() => collection.reduce((s, i) => s + getCardValue(i), 0), [collection])
  const totalDelta = useMemo(() => {
    let d = 0
    collection.forEach(i => {
      const delta = getCardDelta(i)
      if (delta != null) d += delta
    })
    return d
  }, [collection])

  // Most valuable (top 5)
  const mostValuable = useMemo(() =>
    [...collection].sort((a, b) => getCardValue(b) - getCardValue(a)).slice(0, 5),
    [collection]
  )

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: (id: number) => api.deleteCollectionItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collection'] }),
  })

  const batchRemoveMutation = useMutation({
    mutationFn: (ids: number[]) => api.batchDeleteCollectionItems(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      setSelectedIds(new Set())
      setSelectMode(false)
    },
  })

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleExport() {
    const rows = [
      ['Name', 'Set', 'Condition', 'Qty', 'Value'],
      ...collection.map(i => [
        getDisplayName(i),
        getSetName(i),
        i.condition_note ?? i.condition_notes ?? '',
        String(i.quantity ?? 1),
        fmt(getCardValue(i)),
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'cardsafehq-portfolio.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 page-enter pb-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Portfolio</h1>
          <p className="text-sm text-cv-muted mt-0.5">
            {collection.length} item{collection.length !== 1 ? 's' : ''} · Total value{' '}
            <span className="font-semibold" style={{ color: '#D4AF37' }}>{fmt(totalValue)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/search?addToPortfolio=1')}
            className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2"
          >
            <Plus className="h-4 w-4" /> Add Cards
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-2"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {selectMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.size > 0) batchRemoveMutation.mutate(Array.from(selectedIds))
                }}
                className="text-sm px-3 py-2 rounded-full font-semibold"
                style={{ background: 'rgba(240,96,96,0.15)', color: '#F06060' }}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                Remove ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
                className="btn-ghost text-sm px-3 py-2"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="btn-ghost text-sm px-3 py-2"
            >
              Select
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-cv-surface p-1 w-fit">
        {(['overview', 'collection'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className="px-4 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition capitalize"
            style={activeTab === t
              ? { background: 'var(--primary)', color: '#0A0A0C' }
              : { color: 'var(--muted)' }
            }
          >
            {t === 'overview' ? 'Overview' : 'Collection'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Value summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass p-4 rounded-[var(--radius-md)]">
              <p className="text-xs text-cv-muted uppercase tracking-wider mb-1">Total Value</p>
              <p className="text-2xl font-black" style={{ color: '#D4AF37' }}>{fmt(totalValue)}</p>
            </div>
            <div className="glass p-4 rounded-[var(--radius-md)]">
              <p className="text-xs text-cv-muted uppercase tracking-wider mb-1">Price Change</p>
              <p
                className="text-2xl font-black flex items-center gap-1"
                style={{ color: totalDelta >= 0 ? '#4ECBA0' : '#F06060' }}
              >
                {totalDelta >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {fmt(Math.abs(totalDelta))}
              </p>
            </div>
            <div className="glass p-4 rounded-[var(--radius-md)]">
              <p className="text-xs text-cv-muted uppercase tracking-wider mb-1">Cards</p>
              <p className="text-2xl font-black">{collection.length}</p>
            </div>
            <div className="glass p-4 rounded-[var(--radius-md)]">
              <p className="text-xs text-cv-muted uppercase tracking-wider mb-1">Avg Value</p>
              <p className="text-2xl font-black">{fmt(collection.length > 0 ? Math.round(totalValue / collection.length) : 0)}</p>
            </div>
          </div>

          {/* Most Valuable */}
          <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-cv-border">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" style={{ color: '#D4AF37' }} />
                <h2 className="font-bold text-sm">Most Valuable</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('collection')}
                className="text-xs text-cv-muted hover:underline"
                style={{ color: '#D4AF37' }}
              >
                View All →
              </button>
            </div>
            {mostValuable.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-cv-muted text-sm">No cards yet.</p>
                <button
                  type="button"
                  onClick={() => navigate('/search?addToPortfolio=1')}
                  className="btn-primary mt-3 text-sm px-4 py-2"
                >
                  <Plus className="h-4 w-4 inline mr-1" /> Add Your First Card
                </button>
              </div>
            ) : (
              <div className="divide-y divide-cv-border">
                {mostValuable.map((item, i) => {
                  const value = getCardValue(item)
                  const delta = getCardDelta(item)
                  const img = getCardImage(item)
                  return (
                    <Link
                      key={item.id}
                      to={`/card/${item.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-cv-surface/40 transition-colors"
                    >
                      <span className="text-xs text-cv-muted w-4 shrink-0">{i + 1}</span>
                      <div
                        className="shrink-0 rounded overflow-hidden"
                        style={{ width: 32, height: 44, background: 'rgba(0,0,0,0.3)' }}
                      >
                        {img && <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{getDisplayName(item)}</p>
                        <p className="text-xs text-cv-muted truncate">{getSetName(item)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: '#D4AF37' }}>{fmt(value)}</p>
                        {delta != null && (
                          <p
                            className="text-[10px]"
                            style={{ color: delta >= 0 ? '#4ECBA0' : '#F06060' }}
                          >
                            {delta >= 0 ? '+' : ''}{fmt(delta)}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Plus, label: 'Add Cards', action: () => navigate('/search?addToPortfolio=1'), gold: true },
              { icon: BarChart2, label: 'Market Movers', action: () => setActiveTab('collection'), gold: false },
              { icon: Layers, label: 'Deck Builder', action: () => navigate('/deck'), gold: false },
              { icon: Download, label: 'Export CSV', action: handleExport, gold: false },
            ].map(({ icon: Icon, label, action, gold }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className="glass flex flex-col items-center gap-2 p-4 rounded-[var(--radius-md)] text-sm font-medium transition hover:brightness-110"
                style={gold ? { border: '1px solid rgba(212,175,55,0.35)', color: '#D4AF37' } : {}}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── COLLECTION TAB ── */}
      {activeTab === 'collection' && (
        <div className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cv-muted" />
              <input
                className="input pl-8 text-sm py-2"
                placeholder="Search your collection..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Game filter */}
            {games.length > 2 && (
              <select
                className="input text-sm py-2 w-auto"
                value={gameFilter}
                onChange={e => setGameFilter(e.target.value)}
              >
                {games.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            {/* Condition filter */}
            <select
              className="input text-sm py-2 w-auto"
              value={condFilter}
              onChange={e => setCondFilter(e.target.value)}
            >
              {['All', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Graded'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              className="input text-sm py-2 w-auto"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="value-desc">Value: High → Low</option>
              <option value="value-asc">Value: Low → High</option>
              <option value="name-asc">Name: A → Z</option>
              <option value="added-desc">Recently Added</option>
            </select>

            {/* View toggle */}
            <div className="flex rounded-[var(--radius-sm)] overflow-hidden border border-cv-border">
              {(['grid', 'list'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className="px-3 py-2 text-xs font-medium transition"
                  style={view === v
                    ? { background: 'var(--primary)', color: '#0A0A0C' }
                    : { color: 'var(--muted)', background: 'transparent' }
                  }
                >
                  {v === 'grid' ? '⊞' : '☰'}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-cv-muted">
            {filtered.length} of {collection.length} items
            {search && ` matching "${search}"`}
          </p>

          {/* Empty state */}
          {isLoading && (
            <div className="text-center py-12 text-cv-muted text-sm">Loading your collection...</div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="glass rounded-[var(--radius-lg)] p-10 text-center space-y-3">
              <Package className="h-10 w-10 mx-auto text-cv-muted opacity-40" />
              <p className="text-cv-muted text-sm">
                {collection.length === 0
                  ? 'Your portfolio is empty. Add cards from the search page.'
                  : 'No cards match your filters.'}
              </p>
              {collection.length === 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/search?addToPortfolio=1')}
                  className="btn-primary text-sm px-4 py-2"
                >
                  <Plus className="h-4 w-4 inline mr-1" /> Add Cards from Search
                </button>
              )}
            </div>
          )}

          {/* Grid view */}
          {!isLoading && filtered.length > 0 && view === 'grid' && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map(item => (
                <PortfolioCardTile
                  key={item.id}
                  item={item}
                  onRemove={id => removeMutation.mutate(id)}
                  selected={selectedIds.has(item.id)}
                  selectMode={selectMode}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}

          {/* List view */}
          {!isLoading && filtered.length > 0 && view === 'list' && (
            <div className="glass rounded-[var(--radius-lg)] px-4">
              {filtered.map(item => (
                <PortfolioListRow
                  key={item.id}
                  item={item}
                  onRemove={id => removeMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
