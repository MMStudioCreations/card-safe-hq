import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Plus, Search, Download, Trash2,
  BarChart2, Star, Package, Layers, X, Eye, EyeOff,
  ArrowUpRight, ArrowDownRight, CheckSquare, Square, LogIn, UserPlus
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth, useCollection } from '../lib/hooks'
import type { CollectionItem } from '../lib/api'
import ProductDetailsModal from '../components/ProductDetailsModal'
import { PortfolioStatsSkeleton, CardGridSkeleton } from '../components/SkeletonLoader'

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return (item.latest_sold_price_cents ?? item.estimated_value_cents ?? 0) * (item.quantity ?? 1)
}
function getUnitValue(item: CollectionItem): number {
  return item.latest_sold_price_cents ?? item.estimated_value_cents ?? 0
}
function getPurchaseCost(item: CollectionItem): number {
  return (item.purchase_price_cents ?? 0) * (item.quantity ?? 1)
}
function getCardImage(item: CollectionItem): string | null {
  return item.front_image_url ?? item.card?.image_url ?? item.image_url ?? null
}
function getDisplayName(item: CollectionItem): string {
  return item.card_name ?? item.card?.card_name ?? item.product_name ?? 'Unknown Card'
}
function getSetName(item: CollectionItem): string {
  return item.set_name ?? item.card?.set_name ?? ''
}
function getGameLabel(item: CollectionItem): string {
  return item.game ?? item.card?.game ?? item.sport ?? item.card?.sport ?? ''
}
function getCardDelta(item: CollectionItem): number | null {
  if (item.latest_sold_price_cents != null && (item as any).previous_sold_price_cents != null) {
    return (item.latest_sold_price_cents - (item as any).previous_sold_price_cents) * (item.quantity ?? 1)
  }
  return null
}
function getPctChange(item: CollectionItem): number | null {
  const prev = (item as any).previous_sold_price_cents
  if (item.latest_sold_price_cents != null && prev != null && prev > 0) {
    return ((item.latest_sold_price_cents - prev) / prev) * 100
  }
  return null
}

// ── Condition badge ───────────────────────────────────────────────────────────
const CONDITION_COLORS: Record<string, string> = {
  'Near Mint': '#4ECBA0', 'NM': '#4ECBA0',
  'Lightly Played': '#D4AF37', 'LP': '#D4AF37',
  'Moderately Played': '#D4AF37', 'MP': '#D4AF37',
  'Heavily Played': '#F06060', 'HP': '#F06060',
  'Damaged': '#F06060',
  'PSA 10': '#D4AF37', 'PSA 9': '#D4AF37', 'BGS 9.5': '#4ECBA0',
}
function conditionColor(cond: string | null | undefined): string {
  if (!cond) return 'rgba(255,255,255,0.3)'
  for (const [k, v] of Object.entries(CONDITION_COLORS)) {
    if (cond.toLowerCase().includes(k.toLowerCase())) return v
  }
  return 'rgba(255,255,255,0.3)'
}

// ── Sparkline (simple SVG path) ───────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 120, H = 40
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill={`${color}18`} stroke="none" />
    </svg>
  )
}

// ── Portfolio Card Tile ───────────────────────────────────────────────────────
function PortfolioCardTile({
  item, onEdit, selected, selectMode, onToggleSelect,
}: {
  item: CollectionItem; onEdit: (item: CollectionItem) => void
  selected: boolean; selectMode: boolean; onToggleSelect: (id: number) => void
}) {
  const value = getCardValue(item)
  const unitValue = getUnitValue(item)
  const pct = getPctChange(item)
  const img = getCardImage(item)
  const name = getDisplayName(item)
  const set = getSetName(item)
  const cond = item.condition_note ?? item.estimated_grade ?? null
  const qty = item.quantity ?? 1
  const paid = getPurchaseCost(item)
  const unrealized = paid > 0 ? value - paid : null

  return (
    <div
      className="glass card-hover relative flex flex-col overflow-hidden cursor-pointer group"
      style={{
        borderRadius: 'var(--radius-md)',
        border: selected ? '1.5px solid var(--primary)' : unrealized != null && unrealized >= 0 ? '1px solid rgba(78,203,160,0.20)' : unrealized != null ? '1px solid rgba(240,96,96,0.18)' : '1px solid rgba(212,175,55,0.10)',
      }}
      onClick={() => selectMode ? onToggleSelect(item.id) : onEdit(item)}
    >
      {/* Select checkbox */}
      {selectMode && (
        <div
          className="absolute top-2 left-2 z-10 h-5 w-5 rounded-full flex items-center justify-center"
          style={{ background: selected ? 'var(--primary)' : 'rgba(0,0,0,0.6)', border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.3)' }}
        >
          {selected && <span className="text-black text-xs font-bold">✓</span>}
        </div>
      )}

      {/* Sold badge */}
      {item.is_sold ? (
        <div className="absolute top-2 right-2 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(240,96,96,0.15)', color: '#F06060' }}>SOLD</div>
      ) : null}

      {/* Card image */}
      <div className="relative w-full" style={{ paddingBottom: '140%', background: 'rgba(0,0,0,0.3)' }}>
        {img ? (
          <img src={img} alt={name} className="absolute inset-0 h-full w-full object-contain p-1" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-8 w-8 text-cv-muted opacity-30" />
          </div>
        )}
        {/* Market value badge — always shown when available */}
        {unitValue > 0 && (
          <div className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(0,0,0,0.82)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)' }}>
            {fmtShort(unitValue)}
          </div>
        )}
        {/* Tap hint for unpriced cards */}
        {unitValue > 0 && paid === 0 && (
          <div className="absolute bottom-1.5 left-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.4)' }}>
            Set price
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2">
        <p className="text-xs font-semibold truncate leading-tight">{name}</p>
        {set && <p className="text-[10px] text-cv-muted truncate">{set}</p>}
        <div className="flex items-center justify-between mt-0.5">
          {cond && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${conditionColor(cond)}22`, color: conditionColor(cond) }}>
              {cond}
            </span>
          )}
          {qty > 1 && <span className="text-[9px] text-cv-muted ml-auto">×{qty}</span>}
        </div>

        {/* Market value row — always visible */}
        {value > 0 && (
          <div className="flex items-center justify-between mt-1 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-[9px] text-cv-muted">Market</span>
            <span className="text-[11px] font-bold" style={{ color: '#D4AF37' }}>{fmtShort(value)}</span>
          </div>
        )}

        {/* Unrealized gain/loss — shown once price paid is set */}
        {unrealized != null && (
          <div
            className="flex items-center justify-between px-1.5 py-1 rounded-lg mt-0.5"
            style={{ background: unrealized >= 0 ? 'rgba(78,203,160,0.10)' : 'rgba(240,96,96,0.10)' }}
          >
            <span className="text-[9px] font-medium" style={{ color: unrealized >= 0 ? '#4ECBA0' : '#F06060' }}>
              {unrealized >= 0 ? 'Gain' : 'Loss'}
            </span>
            <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: unrealized >= 0 ? '#4ECBA0' : '#F06060' }}>
              {unrealized >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
              {unrealized >= 0 ? '+' : ''}{fmtShort(unrealized)}
            </span>
          </div>
        )}

        {pct != null && (
          <div className="flex items-center gap-0.5 text-[10px] font-medium mt-0.5" style={{ color: pct >= 0 ? '#4ECBA0' : '#F06060' }}>
            {pct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(pct).toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  )
}

// ── Portfolio List Row ────────────────────────────────────────────────────────
function PortfolioListRow({ item, onEdit }: { item: CollectionItem; onEdit: (item: CollectionItem) => void }) {
  const value = getCardValue(item)
  const pct = getPctChange(item)
  const img = getCardImage(item)
  const name = getDisplayName(item)
  const set = getSetName(item)
  const cond = item.condition_note ?? item.estimated_grade ?? null
  const qty = item.quantity ?? 1
  const paid = getPurchaseCost(item)
  const gain = paid > 0 ? value - paid : null

  return (
    <div className="flex items-center gap-3 py-3 border-b border-cv-border last:border-0 cursor-pointer hover:bg-cv-surface/30 transition-colors" onClick={() => onEdit(item)}>
      <div className="shrink-0 rounded-[var(--radius-sm)] overflow-hidden" style={{ width: 40, height: 56, background: 'rgba(0,0,0,0.3)' }}>
        {img ? <img src={img} alt={name} className="h-full w-full object-contain" loading="lazy" /> : <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-cv-muted opacity-30" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-xs text-cv-muted truncate">{set}</p>
        {cond && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block" style={{ background: `${conditionColor(cond)}22`, color: conditionColor(cond) }}>
            {cond}
          </span>
        )}
      </div>
      <div className="text-xs text-cv-muted shrink-0">×{qty}</div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold" style={{ color: '#D4AF37' }}>{fmt(value)}</p>
        {pct != null && (
          <p className="text-[10px] font-medium" style={{ color: pct >= 0 ? '#4ECBA0' : '#F06060' }}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </p>
        )}
        {gain != null && (
          <p className="text-[10px]" style={{ color: gain >= 0 ? '#4ECBA0' : '#F06060' }}>
            {gain >= 0 ? '+' : ''}{fmt(gain)}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main PortfolioPage ────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { data: user, isLoading: authLoading } = useAuth()
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
  const [sortBy, setSortBy] = useState<'value-desc' | 'value-asc' | 'name-asc' | 'added-desc' | 'gain-desc'>('value-desc')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'collection'>('overview')
  const [editItem, setEditItem] = useState<CollectionItem | null>(null)
  const [hideValues, setHideValues] = useState(false)
  const [perfRange, setPerfRange] = useState<'1D' | '7D' | '1M' | '3M' | '6M' | 'MAX'>('1M')

  // Derive game list
  const games = useMemo(() => {
    const s = new Set<string>()
    collection.forEach(item => { const g = getGameLabel(item); if (g) s.add(g) })
    return ['All', ...Array.from(s).sort()]
  }, [collection])

  // Active (not sold) vs sold items
  const activeItems = useMemo(() => collection.filter(i => !i.is_sold), [collection])
  const soldItems = useMemo(() => collection.filter(i => i.is_sold), [collection])

  // Portfolio totals (active only)
  const totalMarketValue = useMemo(() => activeItems.reduce((s, i) => s + getCardValue(i), 0), [activeItems])
  const totalCostBasis = useMemo(() => activeItems.reduce((s, i) => s + getPurchaseCost(i), 0), [activeItems])
  const unrealizedGain = totalCostBasis > 0 ? totalMarketValue - totalCostBasis : null
  const unrealizedPct = totalCostBasis > 0 ? ((totalMarketValue - totalCostBasis) / totalCostBasis) * 100 : null

  // Realized gains from sold items
  const realizedGain = useMemo(() => {
    let gain = 0
    soldItems.forEach(i => {
      if (i.sold_price_cents != null && i.purchase_price_cents != null) {
        gain += (i.sold_price_cents - i.purchase_price_cents) * (i.quantity ?? 1)
      }
    })
    return gain
  }, [soldItems])

  // Filtered + sorted collection
  const filtered = useMemo(() => {
    let items = [...collection]
    if (gameFilter !== 'All') items = items.filter(i => getGameLabel(i) === gameFilter)
    if (condFilter !== 'All') items = items.filter(i => {
      const c = i.condition_note ?? i.estimated_grade ?? ''
      return c.toLowerCase().includes(condFilter.toLowerCase())
    })
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(i => getDisplayName(i).toLowerCase().includes(q) || getSetName(i).toLowerCase().includes(q))
    }
    switch (sortBy) {
      case 'value-desc': items.sort((a, b) => getCardValue(b) - getCardValue(a)); break
      case 'value-asc': items.sort((a, b) => getCardValue(a) - getCardValue(b)); break
      case 'name-asc': items.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))); break
      case 'added-desc': items.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()); break
      case 'gain-desc': items.sort((a, b) => {
        const ga = getCardValue(a) - getPurchaseCost(a)
        const gb = getCardValue(b) - getPurchaseCost(b)
        return gb - ga
      }); break
    }
    return items
  }, [collection, gameFilter, condFilter, search, sortBy])

  // Most valuable (top 5, active only)
  const mostValuable = useMemo(() =>
    [...activeItems].sort((a, b) => getCardValue(b) - getCardValue(a)).slice(0, 5),
    [activeItems]
  )

  // Batch remove
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
        if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map(i => i.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function handleExport() {
    const rows = [
      ['Name', 'Set', 'Condition', 'Qty', 'Market Value', 'Cost Basis', 'Unrealized Gain', 'Status'],
      ...collection.map(i => {
        const mv = getCardValue(i)
        const cb = getPurchaseCost(i)
        return [
          getDisplayName(i), getSetName(i),
          i.condition_note ?? i.estimated_grade ?? '',
          String(i.quantity ?? 1),
          fmt(mv), fmt(cb),
          cb > 0 ? fmt(mv - cb) : '—',
          i.is_sold ? 'Sold' : 'Active',
        ]
      })
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'cardsafehq-portfolio.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const TABS = ['overview', 'performance', 'collection'] as const

  // Guest sign-in prompt — shown when auth check is done and no user found
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 page-enter">
        <div className="glass p-8 rounded-2xl max-w-sm w-full text-center space-y-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-2"
            style={{ background: 'rgba(212,175,55,0.12)', border: '1.5px solid rgba(212,175,55,0.3)' }}>
            <BarChart2 className="h-8 w-8" style={{ color: '#D4AF37' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">My Portfolio</h2>
            <p className="text-sm text-cv-muted">
              Sign in to track your card collection, monitor market values, and see your gains and losses.
            </p>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="btn-ghost w-full flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4" /> Create Account
            </button>
          </div>
          <p className="text-xs text-cv-muted">
            Free to join · No subscription required
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 page-enter pb-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">My Portfolio</h1>
            <button type="button" onClick={() => setHideValues(v => !v)} className="text-cv-muted hover:text-cv-text transition">
              {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-sm text-cv-muted mt-0.5">
            {activeItems.length} active · <span className="font-semibold" style={{ color: '#D4AF37' }}>{hideValues ? '••••••' : fmt(totalMarketValue)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => navigate('/search?addToPortfolio=1')} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
            <Plus className="h-4 w-4" /> Add Cards
          </button>
          <button type="button" onClick={handleExport} className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-2">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {selectMode ? (
            <>
              <button type="button" onClick={selectAll} className="btn-ghost text-sm px-3 py-2">Select All</button>
              <button type="button" onClick={deselectAll} className="btn-ghost text-sm px-3 py-2">Deselect All</button>
              <button
                type="button"
                onClick={() => { if (selectedIds.size > 0 && confirm(`Remove ${selectedIds.size} cards from your portfolio?`)) batchRemoveMutation.mutate(Array.from(selectedIds)) }}
                className="text-sm px-3 py-2 rounded-full font-semibold"
                style={{ background: 'rgba(240,96,96,0.15)', color: '#F06060' }}
                disabled={selectedIds.size === 0 || batchRemoveMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                {batchRemoveMutation.isPending ? 'Removing…' : `Remove (${selectedIds.size})`}
              </button>
              <button type="button" onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }} className="btn-ghost text-sm px-3 py-2">Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setSelectMode(true)} className="btn-ghost text-sm px-3 py-2">
              <CheckSquare className="h-3.5 w-3.5 inline mr-1" /> Select
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-cv-surface p-1 w-fit">
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => setActiveTab(t)}
            className="px-4 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition capitalize"
            style={activeTab === t ? { background: 'var(--primary)', color: '#0A0A0C' } : { color: 'var(--muted)' }}
          >
            {t === 'overview' ? 'Overview' : t === 'performance' ? 'Performance' : 'Collection'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Value summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Market Value', value: fmt(hideValues ? null : totalMarketValue), color: '#D4AF37' },
              { label: 'Cost Basis', value: hideValues ? '••••••' : (totalCostBasis > 0 ? fmt(totalCostBasis) : '—'), color: 'var(--text)' },
              { label: 'Unrealized Gain', value: hideValues ? '••••••' : (unrealizedGain != null ? fmt(unrealizedGain) : '—'), color: unrealizedGain != null ? (unrealizedGain >= 0 ? '#4ECBA0' : '#F06060') : 'var(--text)' },
              { label: 'Realized Gain', value: hideValues ? '••••••' : (realizedGain !== 0 ? fmt(realizedGain) : '—'), color: realizedGain >= 0 ? '#4ECBA0' : '#F06060' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass p-4 rounded-[var(--radius-md)]">
                <p className="text-xs text-cv-muted uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-black" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Most Valuable */}
          <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-cv-border">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" style={{ color: '#D4AF37' }} />
                <h2 className="font-bold text-sm">Most Valuable</h2>
              </div>
              <button type="button" onClick={() => setActiveTab('collection')} className="text-xs" style={{ color: '#D4AF37' }}>View All →</button>
            </div>
            {mostValuable.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-cv-muted text-sm">No cards yet.</p>
                <button type="button" onClick={() => navigate('/search?addToPortfolio=1')} className="btn-primary mt-3 text-sm px-4 py-2">
                  <Plus className="h-4 w-4 inline mr-1" /> Add Your First Card
                </button>
              </div>
            ) : (
              <div className="divide-y divide-cv-border">
                {mostValuable.map((item, i) => {
                  const value = getCardValue(item)
                  const pct = getPctChange(item)
                  const img = getCardImage(item)
                  const cond = item.condition_note ?? item.estimated_grade ?? null
                  return (
                    <button key={item.id} type="button" onClick={() => setEditItem(item)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-cv-surface/40 transition-colors text-left"
                    >
                      <span className="text-xs text-cv-muted w-4 shrink-0">{i + 1}</span>
                      <div className="shrink-0 rounded overflow-hidden" style={{ width: 32, height: 44, background: 'rgba(0,0,0,0.3)' }}>
                        {img && <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{getDisplayName(item)}</p>
                        <p className="text-xs text-cv-muted truncate">{getSetName(item)}</p>
                        {cond && <span className="text-[9px] font-medium" style={{ color: conditionColor(cond) }}>{cond}</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: '#D4AF37' }}>{hideValues ? '••••' : fmt(value)}</p>
                        {pct != null && (
                          <p className="text-[10px]" style={{ color: pct >= 0 ? '#4ECBA0' : '#F06060' }}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Plus, label: 'Add Cards', action: () => navigate('/search?addToPortfolio=1'), gold: true },
              { icon: BarChart2, label: 'Performance', action: () => setActiveTab('performance'), gold: false },
              { icon: Layers, label: 'Deck Builder', action: () => navigate('/deck'), gold: false },
              { icon: Download, label: 'Export CSV', action: handleExport, gold: false },
            ].map(({ icon: Icon, label, action, gold }) => (
              <button key={label} type="button" onClick={action}
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

      {/* ── PERFORMANCE TAB ── */}
      {activeTab === 'performance' && (
        <div className="space-y-5">
          {/* Hero gain block */}
          <div className="glass rounded-[var(--radius-lg)] p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-cv-muted font-medium">Portfolio</span>
                <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>Main</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(212,175,55,0.10)', color: '#D4AF37' }}>Unrealized ▾</span>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>USD</span>
              </div>
            </div>

            {unrealizedGain != null ? (
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-black" style={{ color: unrealizedGain >= 0 ? '#4ECBA0' : '#F06060' }}>
                  {hideValues ? '••••••' : `${unrealizedGain >= 0 ? '+' : ''}${fmt(unrealizedGain)}`}
                </span>
                <button type="button" onClick={() => setHideValues(v => !v)} className="text-cv-muted">
                  {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <p className="text-2xl font-black text-cv-muted mt-2">Add purchase prices to see gains</p>
            )}

            <div className="flex gap-4 mt-1 text-sm text-cv-muted">
              <span>Paid <span className="text-cv-text font-medium">{hideValues ? '••••••' : fmt(totalCostBasis || null)}</span></span>
              <span>Market Value <span className="text-cv-text font-medium">{hideValues ? '••••••' : fmt(totalMarketValue)}</span></span>
            </div>

            {/* Sparkline placeholder */}
            <div className="mt-4 rounded-xl overflow-hidden" style={{ height: 80, background: 'rgba(255,255,255,0.03)' }}>
              <div className="h-full flex items-center justify-center">
                <Sparkline
                  data={mostValuable.map(i => getCardValue(i))}
                  color={unrealizedGain != null && unrealizedGain >= 0 ? '#4ECBA0' : '#D4AF37'}
                />
              </div>
            </div>

            {/* Time range */}
            <div className="flex items-center justify-around mt-4">
              {(['1D', '7D', '1M', '3M', '6M', 'MAX'] as const).map(r => (
                <button key={r} type="button" onClick={() => setPerfRange(r)}
                  className="text-sm font-medium px-3 py-1.5 rounded-full transition"
                  style={perfRange === r
                    ? { background: 'rgba(255,255,255,0.15)', color: 'var(--text)' }
                    : { color: 'var(--muted)' }
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Most Valuable with % change */}
          <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
            <div className="px-5 py-4 border-b border-cv-border">
              <h2 className="font-bold text-sm">Most Valuable</h2>
            </div>
            {mostValuable.length === 0 ? (
              <div className="px-5 py-8 text-center text-cv-muted text-sm">No cards in portfolio.</div>
            ) : (
              <div className="divide-y divide-cv-border">
                {mostValuable.map(item => {
                  const value = getCardValue(item)
                  const pct = getPctChange(item)
                  const cond = item.condition_note ?? item.estimated_grade ?? null
                  const img = getCardImage(item)
                  return (
                    <button key={item.id} type="button" onClick={() => setEditItem(item)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-cv-surface/40 transition-colors text-left"
                    >
                      <div className="shrink-0 rounded overflow-hidden" style={{ width: 32, height: 44, background: 'rgba(0,0,0,0.3)' }}>
                        {img && <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{getDisplayName(item)}</p>
                        <p className="text-xs text-cv-muted truncate">
                          {cond ?? 'Unknown Condition'}
                          {item.rarity && <span className="ml-1">· {item.rarity}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{hideValues ? '••••' : fmt(value)}</p>
                        {pct != null && (
                          <p className="text-xs font-medium" style={{ color: pct >= 0 ? '#4ECBA0' : '#F06060' }}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Realized gains summary */}
          {soldItems.length > 0 && (
            <div className="glass rounded-[var(--radius-lg)] p-5">
              <h2 className="font-bold text-sm mb-3">Realized Gains</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-cv-muted">Items Sold</p>
                  <p className="text-xl font-black">{soldItems.length}</p>
                </div>
                <div>
                  <p className="text-xs text-cv-muted">Total Sold</p>
                  <p className="text-xl font-black">{fmt(soldItems.reduce((s, i) => s + (i.sold_price_cents ?? 0) * (i.quantity ?? 1), 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-cv-muted">Net Gain</p>
                  <p className="text-xl font-black" style={{ color: realizedGain >= 0 ? '#4ECBA0' : '#F06060' }}>
                    {realizedGain >= 0 ? '+' : ''}{fmt(realizedGain)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COLLECTION TAB ── */}
      {activeTab === 'collection' && (
        <div className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cv-muted" />
              <input className="input pl-8 text-sm py-2" placeholder="Search your collection…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {games.length > 2 && (
              <select className="input text-sm py-2 w-auto" value={gameFilter} onChange={e => setGameFilter(e.target.value)}>
                {games.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            <select className="input text-sm py-2 w-auto" value={condFilter} onChange={e => setCondFilter(e.target.value)}>
              {['All', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Graded'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className="input text-sm py-2 w-auto" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
              <option value="value-desc">Value: High → Low</option>
              <option value="value-asc">Value: Low → High</option>
              <option value="gain-desc">Gain: High → Low</option>
              <option value="name-asc">Name: A → Z</option>
              <option value="added-desc">Recently Added</option>
            </select>
            <div className="flex rounded-[var(--radius-sm)] overflow-hidden border border-cv-border">
              {(['grid', 'list'] as const).map(v => (
                <button key={v} type="button" onClick={() => setView(v)}
                  className="px-3 py-2 text-xs font-medium transition"
                  style={view === v ? { background: 'var(--primary)', color: '#0A0A0C' } : { color: 'var(--muted)', background: 'transparent' }}
                >
                  {v === 'grid' ? '⊞' : '☰'}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-cv-muted">{filtered.length} of {collection.length} items{search && ` matching "${search}"`}</p>

          {isLoading && <CardGridSkeleton count={12} />}

          {!isLoading && filtered.length === 0 && (
            <div className="glass rounded-[var(--radius-lg)] p-10 text-center space-y-3">
              <Package className="h-10 w-10 mx-auto text-cv-muted opacity-40" />
              <p className="text-cv-muted text-sm">
                {collection.length === 0 ? 'Your portfolio is empty. Add cards from the search page.' : 'No cards match your filters.'}
              </p>
              {collection.length === 0 && (
                <button type="button" onClick={() => navigate('/search?addToPortfolio=1')} className="btn-primary text-sm px-4 py-2">
                  <Plus className="h-4 w-4 inline mr-1" /> Add Cards from Search
                </button>
              )}
            </div>
          )}

          {!isLoading && filtered.length > 0 && view === 'grid' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map(item => (
                <PortfolioCardTile
                  key={item.id} item={item}
                  onEdit={setEditItem}
                  selected={selectedIds.has(item.id)}
                  selectMode={selectMode}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}

          {!isLoading && filtered.length > 0 && view === 'list' && (
            <div className="glass rounded-[var(--radius-lg)] px-4">
              {filtered.map(item => (
                <PortfolioListRow key={item.id} item={item} onEdit={setEditItem} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Product Details Modal ── */}
      {editItem && (
        <ProductDetailsModal item={editItem} onClose={() => setEditItem(null)} />
      )}
    </div>
  )
}
