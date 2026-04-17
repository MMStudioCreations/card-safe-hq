import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, Heart, Package, Plus, Search, ShoppingCart, X, Check, LayoutDashboard } from 'lucide-react'
import { CardGridSkeleton } from '../components/SkeletonLoader'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth, usePriceByCardId } from '../lib/hooks'
import ProGate from '../components/ProGate'

// ── Type labels ───────────────────────────────────────────────────────────────
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
  collection_chest: 'Collection Chest',
  tin: 'Tin',
  mini_tin: 'Mini Tin',
  build_and_battle: 'Build & Battle Box',
  battle_deck: 'Battle Deck',
  blister_pack: 'Blister Pack',
  gift_set: 'Gift Set',
  binder_collection: 'Binder Collection',
  world_championship_deck: 'World Championship Deck',
  theme_deck: 'Theme / Starter Deck',
  promo_pack: 'Promo Pack',
  ex_box: 'EX Box',
  vstar_universe: 'VSTAR Universe Box',
  other: 'Sealed Product',
  other_sealed: 'Sealed Product',
}

const PRODUCT_FILTER_GROUPS = [
  { label: 'ETB', value: 'elite_trainer_box' },
  { label: 'Booster Box', value: 'booster_box' },
  { label: 'Tin', value: 'tin' },
  { label: 'Collection Box', value: 'collection_box' },
  { label: 'Premium Collection', value: 'premium_collection' },
  { label: 'Promo Pack', value: 'promo_pack' },
  { label: 'Bundle', value: 'booster_bundle' },
  { label: 'Battle Deck', value: 'battle_deck' },
]

// ── TCG + Sports quick-filter logos (Collectr-style) ────────────────────────
const TCG_QUICK_FILTERS = [
  // TCG
  { label: 'Pokémon',     emoji: '⚡', query: 'pikachu',           group: 'tcg' },
  { label: 'Magic',       emoji: '🔮', query: 'lightning bolt',    group: 'tcg' },
  { label: 'Yu-Gi-Oh!',  emoji: '👁', query: 'blue eyes',         group: 'tcg' },
  { label: 'One Piece',  emoji: '⚓', query: 'luffy',              group: 'tcg' },
  { label: 'Lorcana',    emoji: '✨', query: 'elsa lorcana',       group: 'tcg' },
  { label: 'Dragon Ball',emoji: '🐉', query: 'goku dragon ball',   group: 'tcg' },
  // Sports
  { label: 'NBA',        emoji: '🏀', query: 'lebron james basketball card', group: 'sports' },
  { label: 'NFL',        emoji: '🏈', query: 'patrick mahomes football card', group: 'sports' },
  { label: 'MLB',        emoji: '⚾', query: 'mike trout baseball card',      group: 'sports' },
  { label: 'Soccer',     emoji: '⚽', query: 'mbappe soccer card',            group: 'sports' },
  { label: 'UFC / MMA',  emoji: '🥊', query: 'conor mcgregor ufc card',       group: 'sports' },
  { label: 'F1',         emoji: '🏎', query: 'max verstappen formula 1 card', group: 'sports' },
]

type Category = 'all' | 'cards' | 'sealed'

type CardResult = {
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

type SealedResult = {
  id: number
  name: string
  set_name: string
  product_type: string
  tcgplayer_url: string | null
  market_price_cents: number | null
  release_date: string | null
  tcgplayer_product_id: number | null
  image_url?: string | null
  _type: 'sealed'
}

type SportsCardResult = {
  _type: 'sports'
  id: string
  card_name: string
  set_name: string
  card_number: string
  year: string
  rarity: string
  sport: string
  card_type: string
  condition: string
  image_small: string | null
  image_large: string | null
  market_price_cents: number | null
  ebay_url: string
  seller: string
}

type UnifiedResult = CardResult | SealedResult | SportsCardResult

function formatPrice(cents: number | null | undefined): string {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
}


function hoursAgo(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime()
  const h = Math.floor(ms / (1000 * 60 * 60))
  if (h < 1) return 'less than 1 hour ago'
  return `${h} hour${h === 1 ? '' : 's'} ago`
}

// ── Condition price multipliers (TCGPlayer industry standard) ─────────────────
const CONDITION_MULTIPLIERS: Record<string, number> = {
  'Near Mint':        1.00,
  'Lightly Played':   0.77,
  'Moderately Played':0.50,
  'Heavily Played':   0.27,
  'Damaged':          0.10,
  // Graded premiums (relative to NM)
  'PSA 10':           3.00,
  'PSA 9':            1.35,
  'PSA 8':            1.10,
  'BGS 9.5':          3.00,
  'BGS 9':            1.20,
  'CGC 10':           2.50,
  'CGC 9.5':          1.80,
}

const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
  'Near Mint':         { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
  'Lightly Played':    { bg: 'rgba(212,175,55,0.15)', text: '#D4AF37' },
  'Moderately Played': { bg: 'rgba(251,146,60,0.15)', text: '#fb923c' },
  'Heavily Played':    { bg: 'rgba(239,68,68,0.15)',  text: '#f87171' },
  'Damaged':           { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' },
  'PSA 10':            { bg: 'rgba(212,175,55,0.25)', text: '#D4AF37' },
  'PSA 9':             { bg: 'rgba(212,175,55,0.18)', text: '#D4AF37' },
  'PSA 8':             { bg: 'rgba(212,175,55,0.12)', text: '#D4AF37' },
  'BGS 9.5':           { bg: 'rgba(212,175,55,0.25)', text: '#D4AF37' },
  'BGS 9':             { bg: 'rgba(212,175,55,0.18)', text: '#D4AF37' },
  'CGC 10':            { bg: 'rgba(212,175,55,0.22)', text: '#D4AF37' },
  'CGC 9.5':           { bg: 'rgba(212,175,55,0.16)', text: '#D4AF37' },
}

// ── eBay URL builder ──────────────────────────────────────────────────────────
function buildEbaySearchUrl(cardName: string, setName: string, condition?: string, soldOnly = false): string {
  const query = [cardName, setName].filter(Boolean).join(' ')
  const encoded = encodeURIComponent(query)
  // Category 2536 = Collectible Card Games on eBay
  let url = `https://www.ebay.com/sch/i.html?_nkw=${encoded}&_sacat=2536`
  if (soldOnly) url += '&LH_Sold=1&LH_Complete=1'
  // Map condition to eBay LH_ItemCondition codes
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

function getProductTypeColor(type: string): { bg: string; text: string } {
  if (type === 'elite_trainer_box') return { bg: 'rgba(212,175,55,0.15)', text: '#D4AF37' }
  if (type.includes('premium') || type.includes('ultra')) return { bg: 'rgba(212,175,55,0.15)', text: '#D4AF37' }
  if (type === 'booster_box') return { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' }
  if (type === 'tin' || type === 'mini_tin') return { bg: 'rgba(16,185,129,0.12)', text: '#34d399' }
  if (type.includes('collection')) return { bg: 'rgba(168,85,247,0.12)', text: '#c084fc' }
  if (type.includes('promo') || type.includes('ex_box')) return { bg: 'rgba(236,72,153,0.12)', text: '#f472b6' }
  return { bg: 'rgba(212,175,55,0.12)', text: '#D4AF37' }
}

function getSealedImageUrl(product: SealedResult): string | null {
  if (product.image_url) return product.image_url
  if (product.tcgplayer_product_id) {
    return `https://product-images.tcgplayer.com/fit-in/437x437/${product.tcgplayer_product_id}.jpg`
  }
  return null
}

// ── Card detail modal ─────────────────────────────────────────────────────────
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
  const W = 280, H = 72
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

function CardDetailModal({
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

  // Build a real TCGPlayer search URL from card name + set name
  const tcgPlayerSearchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent([card.card_name, card.set_name].filter(Boolean).join(' '))}&view=grid`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111114',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 460,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 88 }}>

          {/* ── TOP SECTION: image + card info side by side ── */}
          <div style={{ display: 'flex', gap: 12, padding: '8px 16px 0', alignItems: 'flex-start' }}>
            {/* Card image — compact on the left */}
            <div style={{ flexShrink: 0, width: 110, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
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
                <p style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, color: '#D4AF37', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {nmPrice > 0 ? formatPrice(nmPrice) : <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No price data</span>}
                </p>
                {nmPrice > 0 && (
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>via TCGPlayer</p>
                )}
              </div>
            </div>
          </div>

          {/* RAW / GRADED / POP tabs */}
          <div style={{ display: 'flex', margin: '14px 16px 0', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 3 }}>
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
          <div style={{ padding: '14px 16px' }}>
            {activeTab === 'RAW' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Price hero */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Price ({condition})</p>
                    <p style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 800, color: '#D4AF37', letterSpacing: '-0.5px' }}>{formatPrice(currentConditionPrice)}</p>
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

        {/* ── Sticky bottom action bar (Collectr-style) ── */}
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
}

function SealedDetailModal({ product, onClose }: { product: SealedResult; onClose: () => void }) {
  const typeStyle = getProductTypeColor(product.product_type)
  const imageUrl = getSealedImageUrl(product)
  const sealedPriceCardId = `pricecharting:${product.name}`
  const { data: apiPrice, error: apiPriceError, isLoading: apiPriceLoading, isFetching: apiPriceFetching } = usePriceByCardId(sealedPriceCardId)

  useEffect(() => {
    console.debug('[prices-ui] SealedDetailModal cardId', {
      sealedProductId: product.id,
      sealedPriceCardId,
      productName: product.name,
      productType: product.product_type,
    })
  }, [product.id, product.name, product.product_type, sealedPriceCardId])

  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState('')
  const queryClient = useQueryClient()

  async function handleAddToPortfolio() {
    setAdding(true)
    setAddError('')
    try {
      await api.createCollectionItem({
        product_type: 'other_sealed',
        product_name: product.name,
        set_name: product.set_name,
        estimated_value_cents: product.market_price_cents ?? undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      setAdded(true)
    } catch (err) {
      setAddError((err as Error).message ?? 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-[var(--radius-lg)] w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {imageUrl && (
          <div className="relative bg-zinc-900 flex items-center justify-center" style={{ minHeight: 160 }}>
            <img
              src={imageUrl}
              alt={product.name}
              className="object-contain"
              style={{ maxHeight: 260, maxWidth: '100%' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-1.5" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <X size={16} color="white" />
            </button>
          </div>
        )}
        {!imageUrl && (
          <div className="relative p-5 pb-3 flex items-start gap-4">
            <div className="rounded-xl p-3 shrink-0" style={{ background: typeStyle.bg }}>
              <Package size={28} color={typeStyle.text} />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <h2 className="text-base font-bold leading-snug">{product.name}</h2>
              <p className="text-sm text-cv-muted mt-0.5">{product.set_name}</p>
            </div>
            <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>
          </div>
        )}

        <div className="px-5 pb-5 space-y-3">
          {imageUrl && (
            <div>
              <h2 className="text-base font-bold leading-snug">{product.name}</h2>
              <p className="text-sm text-cv-muted mt-0.5">{product.set_name}</p>
            </div>
          )}
          <span className="inline-block text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: typeStyle.bg, color: typeStyle.text }}>
            {TYPE_LABELS[product.product_type] ?? product.product_type}
          </span>
          <div className="glass rounded-[var(--radius-md)] p-3">
            {apiPriceLoading || apiPriceFetching ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 w-28 rounded bg-cv-border" />
                <div className="h-7 w-24 rounded bg-cv-border" />
                <div className="h-3 w-36 rounded bg-cv-border" />
              </div>
            ) : apiPrice ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cv-muted">Market Price (NM):</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                    {apiPrice.price_nm != null ? `$${apiPrice.price_nm.toFixed(2)}` : '—'}
                  </span>
                </div>
                {apiPrice.price_psa10 != null && (
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-cv-muted">PSA 10:</span>
                    <span className="font-semibold">${apiPrice.price_psa10.toFixed(2)}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-cv-muted">via PriceCharting · Updated {hoursAgo(apiPrice.fetched_at)}</p>
              </>
            ) : apiPriceError ? (
              <p className="text-xs text-cv-muted">
                {(apiPriceError as any).httpStatus === 404
                  ? 'Price unavailable'
                  : (apiPriceError as any).httpStatus === 502
                    ? 'Price temporarily unavailable, try again soon'
                    : 'Price unavailable'}
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-cv-muted">Market Price</span>
                <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  {formatPrice(product.market_price_cents)}
                </span>
              </div>
            )}
          </div>
          {product.release_date && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-cv-muted">Release Date</span>
              <span>{new Date(product.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          {added ? (
            <div className="text-center text-sm font-medium py-2 flex items-center justify-center gap-2" style={{ color: '#4ECBA0' }}>
              <Check size={16} /> Added to your portfolio
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleAddToPortfolio()}
              disabled={adding}
              className="btn-primary flex items-center justify-center gap-2 text-sm w-full py-2.5"
            >
              <Plus size={14} />
              {adding ? 'Adding…' : 'Add to Portfolio'}
            </button>
          )}
          {/* External links: TCGPlayer + eBay */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {product.tcgplayer_url && (
              <a href={product.tcgplayer_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', textDecoration: 'none' }}
              >
                <ShoppingCart size={14} />
                Buy on TCGPlayer
                <ExternalLink size={12} />
              </a>
            )}
            <a
              href={buildEbaySearchUrl(product.name, product.set_name)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', textDecoration: 'none', color: '#e5a100' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 7.5C3 6.119 4.119 5 5.5 5H9v2H5.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H9v2H5.5C4.119 19 3 17.881 3 16.5v-9zM15 5h3.5C19.881 5 21 6.119 21 7.5v9c0 1.381-1.119 2.5-2.5 2.5H15v-2h3.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H15V5z" fill="currentColor"/>
                <path d="M9 8h6v8H9z" fill="currentColor" opacity=".4"/>
              </svg>
              View eBay Listings
              <ExternalLink size={12} />
            </a>
            <a
              href={buildEbaySearchUrl(product.name, product.set_name, undefined, true)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', textDecoration: 'none', color: 'var(--text-secondary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              eBay Sold Prices
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Unified grid card ─────────────────────────────────────────────────────────
function UnifiedGridItem({
  item,
  onSelectCard,
  onSelectSealed,
  onSelectSports,
  addedIds,
  onQuickAdd,
  addToPortfolioMode,
}: {
  item: UnifiedResult
  onSelectCard: (c: CardResult) => void
  onSelectSealed: (s: SealedResult) => void
  onSelectSports: (s: SportsCardResult) => void
  addedIds: Set<string>
  onQuickAdd: (item: UnifiedResult) => void
  addToPortfolioMode: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const key = item._type === 'card' ? item.ptcg_id : item._type === 'sports' ? `sports-${item.id}` : String(item.id)
  const isAdded = addedIds.has(key)

  if (item._type === 'sports') {
    return (
      <div
        className="relative group"
        style={{
          background: 'var(--glass-bg)',
          border: isAdded ? '1.5px solid rgba(78,203,160,0.5)' : '1px solid var(--glass-border)',
          borderRadius: 14,
          overflow: 'hidden',
          transition: 'transform 0.15s, border-color 0.15s',
          cursor: 'pointer',
        }}
        onClick={() => onSelectSports(item)}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
      >
        <div style={{ aspectRatio: '2.5/3.5', background: 'rgba(0,0,0,0.3)', overflow: 'hidden', position: 'relative' }}>
          {item.image_small && !imgError ? (
            <img src={item.image_small} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={() => setImgError(true)} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🏆</div>
          )}
          <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(212,175,55,0.2)', borderRadius: 6, padding: '1px 5px', fontSize: 9, fontWeight: 700, color: '#D4AF37', letterSpacing: 0.5 }}>SPORTS</div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onQuickAdd(item) }}
            className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isAdded ? 'rgba(78,203,160,0.9)' : 'rgba(212,175,55,0.9)',
              color: '#000',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              opacity: 1,
            }}
          >
            {isAdded ? <Check size={13} /> : <Plus size={13} />}
          </button>
        </div>
        <div style={{ padding: '8px 10px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.card_name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.set_name || item.sport}
          </p>
          {item.rarity && (
            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'rgba(212,175,55,0.15)', color: '#D4AF37', fontWeight: 500 }}>
              {item.rarity}
            </span>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
            {item.market_price_cents ? `$${(item.market_price_cents / 100).toFixed(2)}` : '—'}
          </p>
        </div>
      </div>
    )
  }

  if (item._type === 'card') {
    const rarityStyle = getRarityColor(item.rarity)
    return (
      <div
        className="relative group"
        style={{
          background: 'var(--glass-bg)',
          border: isAdded ? '1.5px solid rgba(78,203,160,0.5)' : '1px solid var(--glass-border)',
          borderRadius: 14,
          overflow: 'hidden',
          transition: 'transform 0.15s, border-color 0.15s',
          cursor: 'pointer',
        }}
        onClick={() => onSelectCard(item)}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
      >
        {/* Card image */}
        <div style={{ aspectRatio: '2.5/3.5', background: 'rgba(0,0,0,0.3)', overflow: 'hidden', position: 'relative' }}>
          {item.image_small && !imgError ? (
            <img src={item.image_small} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={() => setImgError(true)} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🃏</div>
          )}
          <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: '1px 5px', fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>CARD</div>

          {/* Collectr-style quick-add + button — always visible */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onQuickAdd(item) }}
            className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isAdded ? 'rgba(78,203,160,0.9)' : 'rgba(212,175,55,0.9)',
              color: '#000',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              opacity: 1,
            }}
          >
            {isAdded ? <Check size={13} /> : <Plus size={13} />}
          </button>
        </div>

        {/* Info */}
        <div style={{ padding: '8px 10px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.card_name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.set_name}
          </p>
          {item.rarity && (
            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '1px 6px', borderRadius: 20, background: rarityStyle.bg, color: rarityStyle.text, fontWeight: 500 }}>
              {item.rarity}
            </span>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
            {formatPrice(item.tcgplayer_market_cents)}
          </p>
        </div>
      </div>
    )
  }

  // Sealed product
  const typeStyle = getProductTypeColor(item.product_type)
  const imageUrl = getSealedImageUrl(item)
  return (
    <div
      className="relative group"
      style={{
        background: 'var(--glass-bg)',
        border: isAdded ? '1.5px solid rgba(78,203,160,0.5)' : '1px solid var(--glass-border)',
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'transform 0.15s, border-color 0.15s',
        cursor: 'pointer',
      }}
      onClick={() => onSelectSealed(item)}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ aspectRatio: '2.5/3.5', background: 'rgba(0,0,0,0.3)', overflow: 'hidden', position: 'relative' }}>
        {imageUrl && !imgError ? (
          <img src={imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: typeStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} color={typeStyle.text} />
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 5, left: 5, background: typeStyle.bg, borderRadius: 6, padding: '1px 5px', fontSize: 9, fontWeight: 700, color: typeStyle.text, letterSpacing: 0.5 }}>
          {item.product_type === 'elite_trainer_box' ? 'ETB' : item.product_type === 'booster_box' ? 'BOX' : item.product_type === 'tin' ? 'TIN' : 'SEALED'}
        </div>
        {/* Quick-add button — always visible */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onQuickAdd(item) }}
          className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center transition-all"
          style={{
            background: isAdded ? 'rgba(78,203,160,0.9)' : 'rgba(212,175,55,0.9)',
            color: '#000',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            opacity: 1,
          }}
        >
          {isAdded ? <Check size={13} /> : <Plus size={13} />}
        </button>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
          {item.name}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.set_name}
        </p>
        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '1px 6px', borderRadius: 20, background: typeStyle.bg, color: typeStyle.text, fontWeight: 500 }}>
          {TYPE_LABELS[item.product_type] ?? item.product_type}
        </span>
        <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
          {formatPrice(item.market_price_cents)}
        </p>
      </div>
    </div>
  )
}

// ── Main SearchPage ───────────────────────────────────────────────────────────
export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const { data: user } = useAuth()
  const queryClient = useQueryClient()

  // If navigated from Portfolio with ?addToPortfolio=1, start in add mode
  const [addToPortfolioMode, setAddToPortfolioMode] = useState(
    searchParams.get('addToPortfolio') === '1'
  )
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [proGateMessage, setProGateMessage] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [productTypeFilter, setProductTypeFilter] = useState<string>('')
  const [cards, setCards] = useState<CardResult[]>([])
  const [sealed, setSealed] = useState<SealedResult[]>([])
  const [sportsCards, setSportsCards] = useState<SportsCardResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null)
  const [selectedSealed, setSelectedSealed] = useState<SealedResult | null>(null)
  const [selectedSports, setSelectedSports] = useState<SportsCardResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Default search terms to show cards on page load (Collectr-style)
  const TCG_DEFAULT_QUERIES = ['pikachu', 'charizard', 'mewtwo', 'luffy', 'lightning bolt', 'elsa lorcana', 'goku dragon ball']
  const SPORTS_DEFAULT_QUERIES = ['lebron james basketball card', 'patrick mahomes football card', 'mike trout baseball card', 'mbappe soccer card', 'max verstappen formula 1 card']
  const DEFAULT_QUERIES = [...TCG_DEFAULT_QUERIES, ...SPORTS_DEFAULT_QUERIES]
  const [activeFilterGroup, setActiveFilterGroup] = useState<'tcg' | 'sports'>('tcg')

  const runSearch = useCallback(async (q: string, cat: Category) => {
    setLoading(true)
    try {
      const result = await api.universalSearch(q.trim(), cat, 80)
      setCards((result.cards ?? []).map((c: Omit<CardResult, '_type'>) => ({ ...c, _type: 'card' as const })))
      setSealed((result.sealed ?? []).map((s: Omit<SealedResult, '_type'>) => ({ ...s, _type: 'sealed' as const })))
      setSearched(true)
    } catch {
      setCards([]); setSealed([]); setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const runSportsSearch = useCallback(async (q: string, sport?: string) => {
    setLoading(true)
    setSportsCards([])
    setCards([])
    setSealed([])
    try {
      const result = await api.sportsSearch(q.trim(), sport ?? 'sports', 1, 40)
      const mapped: SportsCardResult[] = (result.data ?? []).map((item) => {
        const marketStr = item.prices?.market ?? item.prices?.mid ?? item.prices?.low ?? ''
        const marketCents = marketStr ? Math.round(parseFloat(marketStr.replace(/[^0-9.]/g, '')) * 100) : null
        return {
          _type: 'sports' as const,
          id: item.id,
          card_name: item.name,
          set_name: item.set ?? '',
          card_number: item.number ?? '',
          year: item.year ?? '',
          rarity: item.rarity ?? '',
          sport: item.sport ?? sport ?? '',
          card_type: item.card_type ?? '',
          condition: item.condition ?? '',
          image_small: item.images?.small ?? item.image ?? null,
          image_large: item.images?.large ?? item.image ?? null,
          market_price_cents: marketCents,
          ebay_url: item.ebayUrl ?? item.tcgplayer?.url ?? '',
          seller: item.seller ?? '',
        }
      })
      setSportsCards(mapped)
      setSearched(true)
    } catch {
      setSportsCards([])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-load popular TCG cards on mount (Collectr-style)
  useEffect(() => {
    const randomDefault = TCG_DEFAULT_QUERIES[Math.floor(Math.random() * TCG_DEFAULT_QUERIES.length)]
    void runSearch(randomDefault, 'cards')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      if (query === '') {
        if (activeFilterGroup === 'sports') {
          const pick = SPORTS_DEFAULT_QUERIES[Math.floor(Math.random() * SPORTS_DEFAULT_QUERIES.length)]
          void runSportsSearch(pick)
        } else {
          const randomDefault = TCG_DEFAULT_QUERIES[Math.floor(Math.random() * TCG_DEFAULT_QUERIES.length)]
          void runSearch(randomDefault, category)
        }
      } else {
        setCards([]); setSealed([]); setSportsCards([]); setSearched(false)
      }
      return
    }
    debounceRef.current = setTimeout(() => {
      if (activeFilterGroup === 'sports') {
        void runSportsSearch(query.trim())
      } else {
        void runSearch(query.trim(), category)
      }
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, category, activeFilterGroup, runSearch, runSportsSearch])

  const filteredSealed = productTypeFilter ? sealed.filter(p => p.product_type === productTypeFilter) : sealed
  const isSportsMode = activeFilterGroup === 'sports'

  const unifiedResults: UnifiedResult[] = (() => {
    if (isSportsMode) return sportsCards
    if (category === 'cards') return cards
    if (category === 'sealed') return filteredSealed
    const result: UnifiedResult[] = []
    let ci = 0, si = 0
    while (ci < cards.length || si < filteredSealed.length) {
      if (ci < cards.length) result.push(cards[ci++])
      if (ci < cards.length) result.push(cards[ci++])
      if (si < filteredSealed.length) result.push(filteredSealed[si++])
    }
    return result
  })()

  const totalResults = isSportsMode ? sportsCards.length : (cards.length + filteredSealed.length)

  // Quick-add: add directly to portfolio without opening modal
  async function handleQuickAdd(item: UnifiedResult) {
    if (!user) {
      if (item._type === 'card') setSelectedCard(item)
      return
    }
    const key = item._type === 'card' ? item.ptcg_id : item._type === 'sports' ? `sports-${item.id}` : String(item.id)
    if (addedIds.has(key)) return
    try {
      if (item._type === 'card') {
        await api.createCollectionItem({
          ptcg_id: item.ptcg_id,
          card_name: item.card_name,
          set_name: item.set_name,
          card_number: item.card_number,
          rarity: item.rarity ?? undefined,
          image_url: item.image_large ?? item.image_small ?? undefined,
          game: 'Pokemon',
        })
      } else if (item._type === 'sports') {
        await api.createCollectionItem({
          card_name: item.card_name,
          set_name: item.set_name,
          card_number: item.card_number,
          rarity: item.rarity || item.card_type || item.sport || undefined,
          image_url: item.image_large ?? item.image_small ?? undefined,
          game: item.sport || 'Sports',
          estimated_value_cents: item.market_price_cents ?? undefined,
        })
      } else {
        await api.createCollectionItem({
          product_type: 'other_sealed',
          product_name: item.name,
          set_name: item.set_name,
          estimated_value_cents: item.market_price_cents ?? undefined,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      setAddedIds(prev => new Set([...prev, key]))
    } catch (err) {
      // Check for Pro limit error — show upgrade prompt
      if ((err as any).code === 'pro_required') {
        setProGateMessage((err as Error).message)
        return
      }
      // Fall back to opening the modal
      if (item._type === 'card') setSelectedCard(item)
      else if (item._type === 'sealed') setSelectedSealed(item)
      else if (item._type === 'sports') setSelectedSports(item)
    }
  }

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 12px 80px' }}>
      {/* ── Pro upgrade gate ── */}
      {proGateMessage && (
        <ProGate
          message={proGateMessage}
          onDismiss={() => setProGateMessage(null)}
        />
      )}
      {/* ── Header ── */}
      <div style={{ paddingTop: 20, paddingBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Search</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Find any TCG card, ETB, tin, promo pack, booster box, and more
        </p>
      </div>

      {/* ── Collectr-style "Adding to Portfolio" banner ── */}
      {user && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 12,
            marginBottom: 12,
            background: addToPortfolioMode ? 'rgba(212,175,55,0.12)' : 'var(--glass-bg)',
            border: addToPortfolioMode ? '1px solid rgba(212,175,55,0.35)' : '1px solid var(--glass-border)',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={15} color={addToPortfolioMode ? '#D4AF37' : 'var(--text-secondary)'} />
            <span style={{ fontSize: 13, fontWeight: 600, color: addToPortfolioMode ? '#D4AF37' : 'var(--text-secondary)' }}>
              {addToPortfolioMode
                ? `Adding to: My Portfolio${addedIds.size > 0 ? ` · ${addedIds.size} added` : ''}`
                : 'Adding to: My Portfolio'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAddToPortfolioMode(m => !m)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              background: addToPortfolioMode ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)',
              color: addToPortfolioMode ? '#D4AF37' : 'var(--text-secondary)',
            }}
          >
            {addToPortfolioMode ? 'Done' : 'Add Mode'}
          </button>
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{
        position: 'relative', marginBottom: 12,
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 14, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
      }}>
        <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search cards, sets, ETBs, tins, promo packs…"
          autoFocus
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: 'var(--text-primary)', padding: '14px 0' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus() }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── TCG + Sports quick filters (Collectr-style) ── */}
      <div style={{ marginBottom: 14 }}>
        {/* Group toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['tcg', 'sports'] as const).map(g => (
            <button
              key={g}
              onClick={() => {
                setActiveFilterGroup(g)
                setQuery('')
                if (g === 'sports') {
                  const pick = SPORTS_DEFAULT_QUERIES[Math.floor(Math.random() * SPORTS_DEFAULT_QUERIES.length)]
                  void runSportsSearch(pick)
                } else {
                  const pick = TCG_DEFAULT_QUERIES[Math.floor(Math.random() * TCG_DEFAULT_QUERIES.length)]
                  void runSearch(pick, 'cards')
                }
              }}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid',
                borderColor: activeFilterGroup === g ? 'rgba(212,175,55,0.5)' : 'var(--glass-border)',
                background: activeFilterGroup === g ? 'rgba(212,175,55,0.12)' : 'var(--glass-bg)',
                color: activeFilterGroup === g ? '#D4AF37' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {g === 'tcg' ? '🃏 TCG' : '🏆 Sports'}
            </button>
          ))}
        </div>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {TCG_QUICK_FILTERS.filter(f => f.group === activeFilterGroup).map(f => (
            <button
              key={f.label}
              onClick={() => {
                setQuery(f.query)
                if (f.group === 'sports') {
                  void runSportsSearch(f.query, f.label.toLowerCase())
                } else {
                  setCategory('cards')
                  void runSearch(f.query, 'cards')
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                padding: '7px 14px', borderRadius: 20,
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: 'var(--text-primary)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg)' }}
            >
              <span style={{ fontSize: 16 }}>{f.emoji}</span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['all', 'cards', 'sealed'] as Category[]).map(cat => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setProductTypeFilter('') }}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: '1px solid var(--glass-border)',
              background: category === cat ? 'rgba(212,175,55,0.15)' : 'var(--glass-bg)',
              color: category === cat ? '#D4AF37' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: category === cat ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {cat === 'all' ? 'All Types' : cat === 'cards' ? 'Cards Only' : 'Sealed Products'}
          </button>
        ))}
      </div>

      {/* ── Product type sub-filter ── */}
      {(category === 'sealed' || (category === 'all' && sealed.length > 0)) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => setProductTypeFilter('')}
            style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid var(--glass-border)', background: productTypeFilter === '' ? 'rgba(212,175,55,0.15)' : 'var(--glass-bg)', color: productTypeFilter === '' ? '#D4AF37' : 'var(--text-secondary)', fontSize: 12, fontWeight: productTypeFilter === '' ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            All Products
          </button>
          {PRODUCT_FILTER_GROUPS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setProductTypeFilter(productTypeFilter === value ? '' : value)}
              style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid var(--glass-border)', background: productTypeFilter === value ? 'rgba(212,175,55,0.15)' : 'var(--glass-bg)', color: productTypeFilter === value ? '#D4AF37' : 'var(--text-secondary)', fontSize: 12, fontWeight: productTypeFilter === value ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Loading skeleton (Collectr-style instant feel) ── */}
      {loading && <CardGridSkeleton count={12} />}

      {/* ── Empty state — only shown when search returned nothing and user has typed ── */}
      {!loading && !searched && query.trim().length >= 2 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <Search size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 15, margin: 0 }}>Search for any TCG card or product</p>
          <p style={{ fontSize: 13, marginTop: 6, opacity: 0.7 }}>Pokémon, MTG, Yu-Gi-Oh!, One Piece, and more</p>
        </div>
      )}

      {/* ── No results ── */}
      {!loading && searched && totalResults === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 15, margin: 0 }}>No results for <strong>"{query}"</strong></p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Try a different name, set, or product type</p>
        </div>
      )}

      {/* ── Results grid ── */}
      {!loading && unifiedResults.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {totalResults} result{totalResults !== 1 ? 's' : ''}
            {cards.length > 0 && filteredSealed.length > 0 && ` · ${cards.length} card${cards.length !== 1 ? 's' : ''}, ${filteredSealed.length} sealed`}
            {addToPortfolioMode && addedIds.size > 0 && (
              <span style={{ marginLeft: 8, color: '#4ECBA0', fontWeight: 600 }}>· {addedIds.size} added to portfolio</span>
            )}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            {unifiedResults.map(item => (
              <UnifiedGridItem
                key={item._type === 'card' ? `card-${item.ptcg_id}` : item._type === 'sports' ? `sports-${item.id}` : `sealed-${item.id}`}
                item={item}
                onSelectCard={c => { window.scrollTo({ top: 0, behavior: 'smooth' }); setSelectedCard(c) }}
                onSelectSealed={s => { window.scrollTo({ top: 0, behavior: 'smooth' }); setSelectedSealed(s) }}
                onSelectSports={s => { window.scrollTo({ top: 0, behavior: 'smooth' }); setSelectedSports(s) }}
                addedIds={addedIds}
                onQuickAdd={handleQuickAdd}
                addToPortfolioMode={addToPortfolioMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          addToPortfolioMode={addToPortfolioMode}
          onAddedToPortfolio={id => setAddedIds(prev => new Set([...prev, id]))}
        />
      )}
      {selectedSealed && (
        <SealedDetailModal product={selectedSealed} onClose={() => setSelectedSealed(null)} />
      )}
      {selectedSports && (
        <SportsCardDetailModal card={selectedSports} onClose={() => setSelectedSports(null)} onAddedToPortfolio={id => setAddedIds(prev => new Set([...prev, id]))} />
      )}
    </div>
  )
}

// ── Sports Card Detail Modal ──────────────────────────────────────────────────
function SportsCardDetailModal({ card, onClose, onAddedToPortfolio }: {
  card: SportsCardResult
  onClose: () => void
  onAddedToPortfolio: (id: string) => void
}) {
  const { data: user } = useAuth()
  const queryClient = useQueryClient()
  const [qty, setQty] = useState(1)
  const [condition, setCondition] = useState('Near Mint')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const sportEmoji: Record<string, string> = {
    nba: '🏀', basketball: '🏀', nfl: '🏈', football: '🏈',
    mlb: '⚾', baseball: '⚾', soccer: '⚽', ufc: '🥊', mma: '🥊', f1: '🏎',
  }
  const sportKey = (card.sport ?? '').toLowerCase()
  const emoji = Object.entries(sportEmoji).find(([k]) => sportKey.includes(k))?.[1] ?? '🏆'

  const nmPrice = card.market_price_cents ?? 0
  const condMultiplier = CONDITION_MULTIPLIERS[condition] ?? 1
  const condPrice = Math.round(nmPrice * condMultiplier)

  const ebayLiveUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.card_name + ' ' + card.set_name)}&_sacat=212`
  const ebaySoldUrl = ebayLiveUrl + '&LH_Sold=1&LH_Complete=1'

  async function handleAdd() {
    if (!user) return
    setAdding(true)
    try {
      await api.createCollectionItem({
        card_name: card.card_name,
        set_name: card.set_name,
        card_number: card.card_number,
        rarity: card.card_type || card.rarity || card.sport || undefined,
        image_url: card.image_large ?? card.image_small ?? undefined,
        game: card.sport || 'Sports',
        quantity: qty,
        estimated_value_cents: condPrice || undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      onAddedToPortfolio(`sports-${card.id}`)
      setAdded(true)
      setTimeout(onClose, 1200)
    } catch { /* ignore */ } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 90 }} onClick={e => e.stopPropagation()}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>
        {/* Card image */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 16 }}>
          <div style={{ width: 100, flexShrink: 0, aspectRatio: '2.5/3.5', borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {card.image_large || card.image_small ? (
              <img src={card.image_large ?? card.image_small ?? ''} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 36 }}>{emoji}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{card.card_name}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{card.set_name}</p>
            {card.year && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{card.year}</p>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {card.sport && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(212,175,55,0.15)', color: '#D4AF37', fontWeight: 600 }}>{card.sport.toUpperCase()}</span>}
              {card.card_type && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 500 }}>{card.card_type}</span>}
              {card.rarity && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(168,85,247,0.12)', color: '#c084fc', fontWeight: 500 }}>{card.rarity}</span>}
            </div>
          </div>
        </div>

        {/* Price hero */}
        <div style={{ margin: '0 20px 16px', padding: '14px 16px', borderRadius: 12, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>Market Value</p>
              <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: '#D4AF37' }}>
                {nmPrice ? `$${(nmPrice / 100).toFixed(2)}` : '—'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>At {condition}</p>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {condPrice ? `$${(condPrice / 100).toFixed(2)}` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Condition price table */}
        <div style={{ margin: '0 20px 16px' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimated Value by Condition</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {Object.entries(CONDITION_MULTIPLIERS).map(([cond, mult]) => {
              const price = nmPrice ? Math.round(nmPrice * mult) : null
              const isSelected = condition === cond
              const colors = CONDITION_COLORS[cond] ?? { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' }
              return (
                <button
                  key={cond}
                  onClick={() => setCondition(cond)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: isSelected ? colors.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${isSelected ? colors.text : 'var(--glass-border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <span style={{ fontSize: 11, color: isSelected ? colors.text : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 400 }}>{cond}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? colors.text : 'var(--text-primary)' }}>{price ? `$${(price / 100).toFixed(2)}` : '—'}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* eBay links */}
        <div style={{ margin: '0 20px 16px', display: 'flex', gap: 8 }}>
          <a href={ebayLiveUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            <ExternalLink size={14} /> eBay Listings
          </a>
          <a href={ebaySoldUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            <ShoppingCart size={14} /> Sold Prices
          </a>
        </div>

        {/* Quantity */}
        <div style={{ margin: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Quantity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', minWidth: 24, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.4)', background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
        </div>

        {/* Sticky add button */}
        <div style={{ position: 'sticky', bottom: 0, padding: '12px 20px', background: 'var(--surface)', borderTop: '1px solid var(--glass-border)' }}>
          {user ? (
            <button
              onClick={handleAdd}
              disabled={adding || added}
              style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: added ? 'rgba(78,203,160,0.9)' : 'linear-gradient(135deg, #D4AF37, #B8960C)', color: '#000', fontSize: 15, fontWeight: 700, cursor: adding || added ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {added ? <><Check size={18} /> Added to Portfolio!</> : adding ? 'Adding...' : `+ Add to Portfolio (${qty})`}
            </button>
          ) : (
            <button onClick={onClose} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #B8960C)', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Sign in to Add to Portfolio
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
