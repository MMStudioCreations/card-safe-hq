import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Minus, Plus, Trash2, Tag, ChevronRight, ExternalLink } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { CollectionItem } from '../lib/api'
import { useScrollLock } from '../hooks/useScrollLock'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  return item.game ?? item.card?.game ?? item.sport ?? ''
}

function getMarketValue(item: CollectionItem): number {
  return item.latest_sold_price_cents ?? item.estimated_value_cents ?? 0
}

function getTotalValue(item: CollectionItem, qty: number): number {
  return getMarketValue(item) * qty
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  item: CollectionItem
  onClose: () => void
}

const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged', 'PSA 10', 'PSA 9', 'PSA 8', 'BGS 9.5', 'BGS 9', 'CGC 10', 'CGC 9.5']

// Condition multipliers (TCGPlayer industry standard)
const COND_MULT: Record<string, number> = {
  'Near Mint': 1.00, 'Lightly Played': 0.77, 'Moderately Played': 0.50,
  'Heavily Played': 0.27, 'Damaged': 0.10,
  'PSA 10': 3.00, 'PSA 9': 1.35, 'PSA 8': 1.10,
  'BGS 9.5': 3.00, 'BGS 9': 1.20, 'CGC 10': 2.50, 'CGC 9.5': 1.80,
}
const COND_COLOR: Record<string, string> = {
  'Near Mint': '#34d399', 'Lightly Played': '#D4AF37',
  'Moderately Played': '#fb923c', 'Heavily Played': '#f87171', 'Damaged': '#94a3b8',
  'PSA 10': '#D4AF37', 'PSA 9': '#D4AF37', 'PSA 8': '#D4AF37',
  'BGS 9.5': '#D4AF37', 'BGS 9': '#D4AF37', 'CGC 10': '#D4AF37', 'CGC 9.5': '#D4AF37',
}

function buildEbayUrl(name: string, setName: string, cond?: string, sold = false): string {
  const q = encodeURIComponent([name, setName].filter(Boolean).join(' '))
  let url = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=2536`
  if (sold) url += '&LH_Sold=1&LH_Complete=1'
  if (cond === 'Near Mint') url += '&LH_ItemCondition=2750'
  else if (cond === 'Lightly Played') url += '&LH_ItemCondition=3000'
  else if (cond === 'Moderately Played' || cond === 'Heavily Played') url += '&LH_ItemCondition=4000'
  return url
}

export default function ProductDetailsModal({ item, onClose }: Props) {
  const queryClient = useQueryClient()

  useScrollLock(true)

  // Local form state
  const [qty, setQty] = useState(item.quantity ?? 1)
  const [pricePaid, setPricePaid] = useState(
    item.purchase_price_cents != null ? (item.purchase_price_cents / 100).toFixed(2) : ''
  )
  const [dateAcquired, setDateAcquired] = useState(item.date_acquired ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(item.notes ?? '')
  const [showNotes, setShowNotes] = useState(!!item.notes)
  const [condition, setCondition] = useState(item.condition_note ?? item.estimated_grade ?? 'Near Mint')
  const [isSold, setIsSold] = useState(!!(item.is_sold))
  const [soldPrice, setSoldPrice] = useState(
    item.sold_price_cents != null ? (item.sold_price_cents / 100).toFixed(2) : ''
  )
  const [showSoldFields, setShowSoldFields] = useState(!!(item.is_sold))

  // Sync if item changes
  useEffect(() => {
    setQty(item.quantity ?? 1)
    setPricePaid(item.purchase_price_cents != null ? (item.purchase_price_cents / 100).toFixed(2) : '')
    setDateAcquired(item.date_acquired ?? new Date().toISOString().slice(0, 10))
    setNotes(item.notes ?? '')
    setShowNotes(!!item.notes)
    setCondition(item.condition_note ?? item.estimated_grade ?? 'Near Mint')
    setIsSold(!!(item.is_sold))
    setSoldPrice(item.sold_price_cents != null ? (item.sold_price_cents / 100).toFixed(2) : '')
    setShowSoldFields(!!(item.is_sold))
  }, [item.id])

  const marketValue = getMarketValue(item)
  const totalValue = getTotalValue(item, qty)
  const paidCents = pricePaid ? Math.round(parseFloat(pricePaid) * 100) : null
  const unrealizedGain = paidCents != null ? totalValue - paidCents : null
  const soldCents = soldPrice ? Math.round(parseFloat(soldPrice) * 100) : null
  const realizedGain = soldCents != null && paidCents != null ? soldCents - paidCents : null

  const saveMutation = useMutation({
    mutationFn: () => api.updateCollectionItem(item.id, {
      quantity: qty,
      condition_note: condition,
      purchase_price_cents: paidCents ?? undefined,
      date_acquired: dateAcquired || undefined,
      notes: notes || undefined,
      is_sold: isSold ? 1 : 0,
      sold_price_cents: soldCents ?? undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCollectionItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      onClose()
    },
  })

  const img = getCardImage(item)
  const name = getDisplayName(item)
  const setName = getSetName(item)
  const game = getGameLabel(item)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#111111',
          border: '1px solid rgba(212,175,55,0.15)',
          maxHeight: '92vh',
        }}
      >
        {/* Card image hero */}
        {img && (
          <div className="relative w-full" style={{ height: 200, background: '#0A0A0A', overflow: 'hidden' }}>
            <img src={img} alt={name} className="w-full h-full object-contain" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #111111 100%)' }} />
          </div>
        )}

        {/* Card name + set */}
        <div className="px-5 pt-3 pb-2 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold leading-tight">{name}</h2>
            <p className="text-sm text-cv-muted mt-0.5">
              {game && <span className="capitalize">{game}</span>}
              {game && setName && <span className="mx-1.5" style={{ color: '#D4AF37' }}>•</span>}
              {setName && <span style={{ color: '#D4AF37' }}>{setName}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider text-cv-muted">Product Details</span>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="text-sm font-semibold"
            style={{ color: '#D4AF37' }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* ── Value hero block ── */}
        <div
          className="mx-5 mt-4 rounded-2xl overflow-hidden"
          style={{
            background: unrealizedGain == null
              ? 'rgba(212,175,55,0.06)'
              : unrealizedGain >= 0
                ? 'rgba(78,203,160,0.08)'
                : 'rgba(240,96,96,0.08)',
            border: unrealizedGain == null
              ? '1px solid rgba(212,175,55,0.18)'
              : unrealizedGain >= 0
                ? '1px solid rgba(78,203,160,0.25)'
                : '1px solid rgba(240,96,96,0.25)',
          }}
        >
          {/* Market value row */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cv-muted">Market Value</p>
              <p className="text-2xl font-black mt-0.5" style={{ color: '#D4AF37' }}>
                {marketValue > 0 ? `$${(marketValue / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </p>
              <p className="text-[10px] text-cv-muted mt-0.5">per unit · {qty > 1 ? `×${qty} = $${(totalValue / 100).toFixed(2)} total` : 'single unit'}</p>
            </div>
            {unrealizedGain == null ? (
              <div
                className="flex flex-col items-center justify-center px-3 py-2 rounded-xl"
                style={{ background: 'rgba(212,175,55,0.1)', border: '1px dashed rgba(212,175,55,0.3)' }}
              >
                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#D4AF37' }}>Set Price Paid</p>
                <p className="text-[9px] text-cv-muted mt-0.5">to see gain/loss</p>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center px-3 py-2 rounded-xl"
                style={{
                  background: unrealizedGain >= 0 ? 'rgba(78,203,160,0.12)' : 'rgba(240,96,96,0.12)',
                  border: `1px solid ${unrealizedGain >= 0 ? 'rgba(78,203,160,0.3)' : 'rgba(240,96,96,0.3)'}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: unrealizedGain >= 0 ? '#4ECBA0' : '#F06060' }}>
                  {unrealizedGain >= 0 ? 'Unrealized Gain' : 'Unrealized Loss'}
                </p>
                <p className="text-xl font-black mt-0.5" style={{ color: unrealizedGain >= 0 ? '#4ECBA0' : '#F06060' }}>
                  {unrealizedGain >= 0 ? '+' : ''}{`$${Math.abs(unrealizedGain / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
                {paidCents != null && (
                  <p className="text-[9px] text-cv-muted mt-0.5">
                    Paid ${(paidCents / 100).toFixed(2)} · {unrealizedGain >= 0 ? '+' : ''}{((unrealizedGain / paidCents) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Cost basis row — shown when price paid is entered */}
          {paidCents != null && (
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-cv-muted">Cost Basis</span>
              <span className="text-xs font-semibold">${(paidCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Condition */}
          <div>
            <p className="text-sm font-semibold mb-2">Condition</p>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border transition"
                  style={condition === c
                    ? { background: 'rgba(212,175,55,0.15)', borderColor: '#D4AF37', color: '#D4AF37' }
                    : { background: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + Total Value */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-full flex items-center justify-center border"
                  style={{ borderColor: '#D4AF37', color: '#D4AF37' }}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-xl font-bold w-8 text-center">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(q => Math.min(1000, q + 1))}
                  className="h-9 w-9 rounded-full flex items-center justify-center border"
                  style={{ borderColor: '#D4AF37', color: '#D4AF37' }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-cv-muted">Total Value</p>
              <p className="text-xl font-black" style={{ color: '#D4AF37' }}>{fmt(totalValue)}</p>
              <p className="text-[10px] text-cv-muted">Based on Market Value × Qty</p>
            </div>
          </div>

          {/* Condition-based price table */}
          {marketValue > 0 && (
            <div style={{ borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>Estimated Value by Condition</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, columnGap: 12 }}>
                {['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'].map(c => {
                  const mult = COND_MULT[c] ?? 1
                  const val = Math.round(marketValue * mult)
                  const col = COND_COLOR[c] ?? '#94a3b8'
                  const isActive = condition === c
                  return (
                    <>
                      <div key={`lbl-${c}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: isActive ? 'white' : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 600 : 400 }}>{c}</span>
                        {isActive && <span style={{ fontSize: 9, background: 'rgba(212,175,55,0.2)', color: '#D4AF37', borderRadius: 20, padding: '1px 5px', fontWeight: 700 }}>SELECTED</span>}
                      </div>
                      <span key={`val-${c}`} style={{ fontSize: 12, fontWeight: 700, color: col, textAlign: 'right' }}>{fmt(val)}</span>
                    </>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 10, paddingTop: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Graded Estimates</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 5, columnGap: 12 }}>
                  {['PSA 10', 'PSA 9', 'BGS 9.5', 'BGS 9', 'CGC 10', 'CGC 9.5'].map(c => {
                    const mult = COND_MULT[c] ?? 1
                    const val = Math.round(marketValue * mult)
                    const isActive = condition === c
                    return (
                      <>
                        <div key={`lbl-${c}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: '#D4AF37', display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: isActive ? 'white' : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 600 : 400 }}>{c}</span>
                          {isActive && <span style={{ fontSize: 9, background: 'rgba(212,175,55,0.2)', color: '#D4AF37', borderRadius: 20, padding: '1px 5px', fontWeight: 700 }}>SELECTED</span>}
                        </div>
                        <span key={`val-${c}`} style={{ fontSize: 12, fontWeight: 700, color: '#D4AF37', textAlign: 'right' }}>~{fmt(val)}</span>
                      </>
                    )
                  })}
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>Graded estimates are approximate. Actual values vary by population and demand.</p>
              </div>
            </div>
          )}

          {/* eBay links */}
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={buildEbayUrl(name, setName, condition)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '9px 0', borderRadius: 10, background: 'rgba(229,161,0,0.1)', border: '1px solid rgba(229,161,0,0.25)', color: '#e5a100', textDecoration: 'none' }}
            >
              eBay Listings
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={buildEbayUrl(name, setName, condition, true)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '9px 0', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              Sold Prices
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Price Paid */}
          <div>
            <p className="text-sm font-semibold mb-1.5">Price Paid (USD)</p>
            <div
              className="flex items-center rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-cv-muted mr-2">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={pricePaid}
                onChange={e => setPricePaid(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <ChevronRight className="h-4 w-4 text-cv-muted" />
            </div>
            <p className="text-[11px] text-cv-muted mt-1">Enter the price paid for each unit. The gain/loss above updates live as you type.</p>
          </div>

          {/* Date Acquired */}
          <div>
            <p className="text-sm font-semibold mb-1.5">Date Acquired</p>
            <div
              className="flex items-center rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <input
                type="date"
                value={dateAcquired}
                onChange={e => setDateAcquired(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <ChevronRight className="h-4 w-4 text-cv-muted" />
            </div>
            <p className="text-[11px] text-cv-muted mt-1">Enter the date you acquired this card.</p>
          </div>

          {/* Notes (expandable) */}
          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-sm font-medium"
              style={{ color: '#D4AF37' }}
            >
              + Add a Note
            </button>
          ) : (
            <div>
              <p className="text-sm font-semibold mb-1.5">Note</p>
              <textarea
                rows={3}
                placeholder="Add a note about this card…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
          )}

          {/* Mark as Sold */}
          {!showSoldFields ? (
            <button
              type="button"
              onClick={() => { setShowSoldFields(true); setIsSold(true) }}
              className="text-sm font-medium"
              style={{ color: '#D4AF37' }}
            >
              <Tag className="h-3.5 w-3.5 inline mr-1" />
              Mark as Sold
            </button>
          ) : (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: '#D4AF37' }}>Sold Entry</p>
                <button
                  type="button"
                  onClick={() => { setShowSoldFields(false); setIsSold(false); setSoldPrice('') }}
                  className="text-xs text-cv-muted hover:text-cv-text"
                >
                  Cancel
                </button>
              </div>
              <div>
                <p className="text-xs text-cv-muted mb-1">Sold Price (USD)</p>
                <div
                  className="flex items-center rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="text-cv-muted mr-2">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={soldPrice}
                    onChange={e => setSoldPrice(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
              {realizedGain != null && (
                <p
                  className="text-sm font-bold"
                  style={{ color: realizedGain >= 0 ? '#4ECBA0' : '#F06060' }}
                >
                  Realized Gain: {realizedGain >= 0 ? '+' : ''}{fmt(realizedGain)}
                </p>
              )}
            </div>
          )}

          {/* Delete */}
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-xs text-cv-muted">Remove this card from your portfolio</span>
            <button
              type="button"
              onClick={() => { if (confirm('Remove this card from your portfolio?')) deleteMutation.mutate() }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: '#F06060' }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteMutation.isPending ? 'Removing…' : 'Delete Entry'}
            </button>
          </div>
        </div>

        {/* Save button */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full py-4 rounded-2xl text-base font-bold text-black transition"
            style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
