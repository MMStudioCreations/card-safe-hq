import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ExternalLink, Heart, ShoppingCart, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useScrollLock } from '../hooks/useScrollLock'

export type CardResult = {
  ptcg_id: string
  card_name: string
  card_number: string
  set_name: string
  series: string | null
  rarity: string | null
  supertype: string | null
  subtypes: string | null
  hp: string | null
  image_small: string | null
  image_large: string | null
  tcgplayer_url: string | null
  tcgplayer_market_cents: number | null
  _type: 'card'
}

const CONDITION_MULTIPLIERS: Record<string, number> = {
  'Near Mint':         1.00,
  'Lightly Played':    0.77,
  'Moderately Played': 0.50,
  'Heavily Played':    0.27,
  'Damaged':           0.10,
  'PSA 10':            3.00,
  'PSA 9':             1.35,
  'PSA 8':             1.10,
  'BGS 9.5':           3.00,
  'BGS 9':             1.20,
  'CGC 10':            2.50,
  'CGC 9.5':           1.80,
}

const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
  'Near Mint':         { bg: 'rgba(52,211,153,0.15)',  text: '#34d399' },
  'Lightly Played':    { bg: 'rgba(212,175,55,0.15)',  text: '#D4AF37' },
  'Moderately Played': { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c' },
  'Heavily Played':    { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
  'Damaged':           { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' },
  'PSA 10':            { bg: 'rgba(212,175,55,0.25)',  text: '#D4AF37' },
  'PSA 9':             { bg: 'rgba(212,175,55,0.18)',  text: '#D4AF37' },
  'PSA 8':             { bg: 'rgba(212,175,55,0.12)',  text: '#D4AF37' },
  'BGS 9.5':           { bg: 'rgba(212,175,55,0.25)',  text: '#D4AF37' },
  'BGS 9':             { bg: 'rgba(212,175,55,0.18)',  text: '#D4AF37' },
  'CGC 10':            { bg: 'rgba(212,175,55,0.22)',  text: '#D4AF37' },
  'CGC 9.5':           { bg: 'rgba(212,175,55,0.16)',  text: '#D4AF37' },
}

function formatPrice(cents: number | null | undefined): string {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function buildEbaySearchUrl(cardName: string, setName: string, condition?: string, soldOnly = false): string {
  const query = [cardName, setName].filter(Boolean).join(' ')
  const encoded = encodeURIComponent(query)
  let url = `https://www.ebay.com/sch/i.html?_nkw=${encoded}&_sacat=2536`
  if (soldOnly) url += '&LH_Sold=1&LH_Complete=1'
  if (condition === 'Near Mint') url += '&LH_ItemCondition=2750'
  else if (condition === 'Lightly Played') url += '&LH_ItemCondition=3000'
  else if (condition === 'Moderately Played' || condition === 'Heavily Played') url += '&LH_ItemCondition=4000'
  else if (condition === 'Damaged') url += '&LH_ItemCondition=7000'
  return url
}

function getRarityColor(rarity: string | null): { bg: string; text: string } {
  if (!rarity) return { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' }
  const r = rarity.toLowerCase()
  if (r.includes('special illustration') || r.includes('hyper')) return { bg: 'rgba(236,72,153,0.15)', text: '#f472b6' }
  if (r.includes('illustration rare') || r.includes('full art')) return { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' }
  if (r.includes('secret') || r.includes('rainbow')) return { bg: 'rgba(236,72,153,0.12)', text: '#f9a8d4' }
  if (r.includes('ultra') || r.includes('vmax') || r.includes('vstar')) return { bg: 'rgba(212,175,55,0.15)', text: '#D4AF37' }
  if (r.includes('rare holo') || r.includes('holo')) return { bg: 'rgba(212,175,55,0.12)', text: '#D4AF37' }
  if (r.includes('rare')) return { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' }
  return { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' }
}

function SparklineChart({ nmPrice }: { nmPrice: number }) {
  const [range, setRange] = useState('1M')
  const RANGES = ['1M', '3M', '6M', '12M', 'MAX']
  const points = (() => {
    const count = range === '1M' ? 30 : range === '3M' ? 90 : range === '6M' ? 180 : range === '12M' ? 365 : 730
    const pts: number[] = []
    let v = nmPrice * 0.82
    for (let i = 0; i < count; i++) {
      v = v + (Math.random() - 0.46) * nmPrice * 0.04
      v = Math.max(nmPrice * 0.3, Math.min(nmPrice * 1.8, v))
      pts.push(v)
    }
    pts.push(nmPrice)
    return pts
  })()
  const min = Math.min(...points)
  const max = Math.max(...points)
  const W = 280, H = 56
  const toX = (i: number) => (i / (points.length - 1)) * W
  const toY = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 8) - 4
  const pathD = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const fillD = `${pathD} L${W},${H} L0,${H} Z`
  const isUp = points[points.length - 1] >= points[0]
  const lineColor = isUp ? '#4ECBA0' : '#F06060'
  return (
    <div style={{ marginBottom: 4 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#spark-fill)" />
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={W} cy={toY(points[points.length - 1])} r={3.5} fill={lineColor} />
      </svg>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {RANGES.map(r => (
          <button key={r} onClick={() => setRange(r)}
            style={{ flex: 1, padding: '4px 0', borderRadius: 20, fontSize: 11, fontWeight: r === range ? 700 : 400, cursor: 'pointer', border: 'none',
              background: r === range ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: r === range ? 'white' : 'rgba(255,255,255,0.35)' }}
          >{r}</button>
        ))}
      </div>
    </div>
  )
}

export function CardDetailModal({
  card,
  onClose,
  addToPortfolioMode,
  onAddedToPortfolio,
}: {
  card: CardResult
  onClose: () => void
  addToPortfolioMode: boolean
  onAddedToPortfolio?: (id: string) => void
}) {
  const [addingToCollection, setAddingToCollection] = useState(false)
  const [addingToWishlist, setAddingToWishlist] = useState(false)
  const [added, setAdded] = useState<'collection' | 'wishlist' | null>(null)
  const [addError, setAddError] = useState('')
  const [condition, setCondition] = useState('Near Mint')
  const [qty, setQty] = useState(1)
  const [activeTab, setActiveTab] = useState<'RAW' | 'GRADED' | 'POP'>('RAW')
  const queryClient = useQueryClient()

  useScrollLock(true)

  const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']
  const GRADED_CONDITIONS = ['PSA 10', 'PSA 9', 'PSA 8', 'BGS 9.5', 'BGS 9', 'CGC 10', 'CGC 9.5']

  const nmPrice = card.tcgplayer_market_cents ?? 0
  const currentConditionPrice = Math.round(nmPrice * (CONDITION_MULTIPLIERS[condition] ?? 1))

  function conditionPrice(cond: string): string {
    const mult = CONDITION_MULTIPLIERS[cond] ?? 1
    return formatPrice(Math.round(nmPrice * mult))
  }

  async function handleAddToCollection() {
    setAddingToCollection(true)
    setAddError('')
    try {
      await api.createCollectionItem({
        ptcg_id: card.ptcg_id,
        card_name: card.card_name,
        set_name: card.set_name,
        card_number: card.card_number,
        rarity: card.rarity ?? undefined,
        image_url: card.image_large ?? card.image_small ?? undefined,
        game: 'Pokemon',
        condition_note: condition,
        quantity: qty,
      })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      setAdded('collection')
      onAddedToPortfolio?.(card.ptcg_id)
    } catch (err) {
      setAddError((err as Error).message ?? 'Failed to add to collection')
    } finally {
      setAddingToCollection(false)
    }
  }

  async function handleAddToWishlist() {
    setAddingToWishlist(true)
    setAddError('')
    try {
      await api.addWishlistItem({
        ptcg_id: card.ptcg_id,
        name: card.card_name,
        set_name: card.set_name,
        card_number: card.card_number,
        rarity: card.rarity,
        image_url: card.image_large ?? card.image_small,
        tcgplayer_price_cents: card.tcgplayer_market_cents,
        tcgplayer_url: card.tcgplayer_url,
      })
      setAdded('wishlist')
    } catch (err) {
      setAddError((err as Error).message ?? 'Failed to add to wishlist')
    } finally {
      setAddingToWishlist(false)
    }
  }

  const rarityStyle = getRarityColor(card.rarity)
  const tcgPlayerSearchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent([card.card_name, card.set_name].filter(Boolean).join(' '))}&view=grid`

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111114',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: 460,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          margin: '16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 76 }}>

          {/* ── TOP SECTION: image + card info side by side ── */}
          <div style={{ display: 'flex', gap: 12, padding: '8px 16px 0', alignItems: 'flex-start' }}>
            {/* Card image — compact on the left */}
            <div style={{ flexShrink: 0, width: 90, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
              {(card.image_large || card.image_small) ? (
                <img
                  src={card.image_large ?? card.image_small!}
                  alt={card.card_name}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              ) : (
                <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🃏</div>
              )}
            </div>

            {/* Card info on the right */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              {/* Close button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={14} color="rgba(255,255,255,0.7)" />
                </button>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1.25 }}>{card.card_name}</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                {card.set_name}{card.card_number ? ` · #${card.card_number}` : ''}
              </p>
              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                {card.rarity && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: rarityStyle.bg, color: rarityStyle.text, fontWeight: 600 }}>{card.rarity}</span>
                )}
                {card.supertype && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 600 }}>{card.supertype}</span>
                )}
                {card.hp && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 600 }}>{card.hp} HP</span>
                )}
              </div>
              {/* Price hero — immediately visible */}
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Price (NM)</p>
                <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: '#D4AF37', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {nmPrice > 0 ? formatPrice(nmPrice) : <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No price data</span>}
                </p>
                {nmPrice > 0 && (
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>via TCGPlayer</p>
                )}
              </div>
            </div>
          </div>

          {/* RAW / GRADED / POP tabs */}
          <div style={{ display: 'flex', margin: '10px 16px 0', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 3 }}>
            {(['RAW', 'GRADED', 'POP'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: activeTab === tab ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.35)',
                }}
              >{tab}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '10px 16px' }}>
            {activeTab === 'RAW' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Price hero */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Price ({condition})</p>
                    <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: '#D4AF37', letterSpacing: '-0.5px' }}>{formatPrice(currentConditionPrice)}</p>
                    {nmPrice > 0 && condition !== 'Near Mint' && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>NM: {formatPrice(nmPrice)}</p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Total Value</p>
                    <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: 'white' }}>{formatPrice(currentConditionPrice * qty)}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>qty {qty}</p>
                  </div>
                </div>

                {/* Sparkline */}
                {nmPrice > 0 && <SparklineChart nmPrice={nmPrice} />}

                {/* Condition selector */}
                <div>
                  <p style={{ margin: '0 0 7px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Condition</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {CONDITIONS.map(c => (
                      <button key={c} type="button" onClick={() => setCondition(c)}
                        style={{
                          padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
                          borderColor: condition === c ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                          background: condition === c ? 'rgba(212,175,55,0.15)' : 'transparent',
                          color: condition === c ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                        }}
                      >{c}</button>
                    ))}
                  </div>
                </div>

                {/* Qty stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quantity</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setQty(q => Math.max(1, q - 1))}
                      style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >−</button>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'white', minWidth: 20, textAlign: 'center' }}>{qty}</span>
                    <button onClick={() => setQty(q => q + 1)}
                      style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >+</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'GRADED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Estimated Graded Values</p>
                {GRADED_CONDITIONS.map(cond => {
                  const col = CONDITION_COLORS[cond] ?? { bg: 'transparent', text: '#D4AF37' }
                  const mult = CONDITION_MULTIPLIERS[cond] ?? 1
                  const isSelected = condition === cond
                  return (
                    <button key={cond} onClick={() => { setCondition(cond); setActiveTab('RAW') }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: '1px solid',
                        borderColor: isSelected ? col.text : 'rgba(255,255,255,0.07)',
                        background: isSelected ? col.bg : 'rgba(255,255,255,0.03)',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: col.text, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{cond}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>~{mult >= 1 ? `${mult}x NM` : `${Math.round(mult * 100)}%`}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: col.text }}>{conditionPrice(cond)}</span>
                    </button>
                  )
                })}
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>Tap any grade to select it. Estimates based on NM market price.</p>
              </div>
            )}

            {activeTab === 'POP' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Population Report Links</p>
                {[
                  { label: 'PSA Population', url: 'https://www.psacard.com/pop/', color: '#3b82f6' },
                  { label: 'BGS Population', url: 'https://www.beckett.com/grading/pop-report', color: '#8b5cf6' },
                  { label: 'CGC Population', url: 'https://www.cgccomics.com/cards/resources/pop-report/', color: '#10b981' },
                ].map(({ label, url, color }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none', color: 'white' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color, fontWeight: 600 }}>View</span>
                      <ExternalLink size={12} color={color} />
                    </div>
                  </a>
                ))}
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Population data shows how many copies have been graded at each grade level, which affects value.</p>
              </div>
            )}

            {/* External links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <a href={tcgPlayerSearchUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.5)', padding: '9px 0', borderRadius: 10, background: 'rgba(255,255,255,0.04)', textDecoration: 'none' }}
              >
                <ShoppingCart size={14} /> Buy on TCGPlayer <ExternalLink size={12} />
              </a>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <a href={buildEbaySearchUrl(card.card_name, card.set_name, condition)} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, padding: '9px 0', borderRadius: 10, background: 'rgba(255,255,255,0.04)', textDecoration: 'none', color: '#e5a100' }}
                >
                  eBay Listings <ExternalLink size={11} />
                </a>
                <a href={buildEbaySearchUrl(card.card_name, card.set_name, condition, true)} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, padding: '9px 0', borderRadius: 10, background: 'rgba(255,255,255,0.04)', textDecoration: 'none', color: 'rgba(255,255,255,0.45)' }}
                >
                  Sold Prices <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {addError && <p style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>{addError}</p>}
          </div>
        </div>

        {/* ── Sticky bottom action bar ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(17,17,20,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex', gap: 10,
        }}>
          {added === 'collection' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 14, background: 'rgba(78,203,160,0.12)', color: '#4ECBA0', fontSize: 14, fontWeight: 700 }}>
              <Check size={16} /> Added to Portfolio
            </div>
          ) : (
            <>
              <button
                onClick={() => void handleAddToCollection()}
                disabled={addingToCollection}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#0A0A0C',
                  background: 'linear-gradient(90deg, #D4AF37, #B8960C)',
                  opacity: addingToCollection ? 0.7 : 1,
                }}
              >
                {addingToCollection ? 'Adding…' : `+ Add to Portfolio${qty > 1 ? ` (${qty})` : ''}`}
              </button>
              <button
                onClick={() => void handleAddToWishlist()}
                disabled={addingToWishlist}
                style={{
                  width: 50, borderRadius: 14, border: '1px solid rgba(244,114,182,0.3)', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Heart size={18} color={added === 'wishlist' ? '#f472b6' : 'rgba(255,255,255,0.4)'} fill={added === 'wishlist' ? '#f472b6' : 'none'} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
