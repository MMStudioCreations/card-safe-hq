import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, Heart, Package, Plus, Search, ShoppingCart, X, Check, LayoutDashboard } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/hooks'

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

// ── TCG quick-filter logos (Collectr-style) ───────────────────────────────────
const TCG_QUICK_FILTERS = [
  { label: 'Pokémon', emoji: '⚡', query: 'pikachu' },
  { label: 'Magic', emoji: '🔮', query: 'lightning bolt' },
  { label: 'Yu-Gi-Oh!', emoji: '👁', query: 'blue eyes' },
  { label: 'One Piece', emoji: '⚓', query: 'luffy' },
  { label: 'Lorcana', emoji: '✨', query: 'elsa' },
  { label: 'Dragon Ball', emoji: '🐉', query: 'goku' },
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

type UnifiedResult = CardResult | SealedResult

function formatPrice(cents: number | null | undefined): string {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
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
  const queryClient = useQueryClient()

  const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']
  const GRADED_CONDITIONS = ['PSA 10', 'PSA 9', 'PSA 8', 'BGS 9.5', 'BGS 9', 'CGC 10', 'CGC 9.5']
  const [showGraded, setShowGraded] = useState(false)
  const [showPriceTable, setShowPriceTable] = useState(false)

  const nmPrice = card.tcgplayer_market_cents ?? 0

  function conditionPrice(cond: string): string {
    const mult = CONDITION_MULTIPLIERS[cond] ?? 1
    const cents = Math.round(nmPrice * mult)
    return formatPrice(cents)
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-[var(--radius-lg)] w-full max-w-sm overflow-hidden"
        style={{ maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Card image */}
        <div className="relative bg-zinc-900 flex items-center justify-center" style={{ minHeight: 200 }}>
          {card.image_large ? (
            <img src={card.image_large} alt={card.card_name} className="w-full object-contain" style={{ maxHeight: 340 }} />
          ) : card.image_small ? (
            <img src={card.image_small} alt={card.card_name} className="w-full object-contain" style={{ maxHeight: 340 }} />
          ) : (
            <div className="flex items-center justify-center h-48 text-4xl">🃏</div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-1.5" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <X size={16} color="white" />
          </button>
        </div>

        {/* Card details */}
        <div className="p-4 space-y-3">
          <div>
            <h2 className="text-lg font-bold">{card.card_name}</h2>
            <p className="text-sm text-cv-muted">{card.set_name}{card.card_number ? ` · #${card.card_number}` : ''}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {card.rarity && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: rarityStyle.bg, color: rarityStyle.text }}>
                {card.rarity}
              </span>
            )}
            {card.supertype && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
                {card.supertype}
              </span>
            )}
            {card.hp && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                {card.hp} HP
              </span>
            )}
          </div>

          {/* Market price + condition price table */}
          <div className="glass rounded-[var(--radius-md)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-cv-muted">NM Market Price</span>
              <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                {formatPrice(card.tcgplayer_market_cents)}
              </span>
            </div>
            {nmPrice > 0 && (
              <button
                type="button"
                onClick={() => setShowPriceTable(p => !p)}
                style={{ fontSize: 12, color: '#D4AF37', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {showPriceTable ? '▲' : '▼'} {showPriceTable ? 'Hide' : 'Show'} condition prices
              </button>
            )}
            {showPriceTable && nmPrice > 0 && (
              <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 }}>Raw Conditions</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px' }}>
                  {CONDITIONS.map(cond => {
                    const col = CONDITION_COLORS[cond] ?? { bg: 'transparent', text: '#94a3b8' }
                    const mult = CONDITION_MULTIPLIERS[cond] ?? 1
                    return (
                      <>
                        <div key={`label-${cond}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: col.text, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cond}</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>({Math.round(mult * 100)}%)</span>
                        </div>
                        <span key={`val-${cond}`} style={{ fontSize: 12, fontWeight: 700, color: col.text, textAlign: 'right' }}>{conditionPrice(cond)}</span>
                      </>
                    )
                  })}
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '10px 0 6px', fontWeight: 600 }}>Graded (est.)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px' }}>
                  {GRADED_CONDITIONS.map(cond => {
                    const col = CONDITION_COLORS[cond] ?? { bg: 'transparent', text: '#D4AF37' }
                    const mult = CONDITION_MULTIPLIERS[cond] ?? 1
                    return (
                      <>
                        <div key={`label-${cond}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: col.text, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cond}</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>(~{mult >= 1 ? `${mult}x` : `${Math.round(mult * 100)}%`})</span>
                        </div>
                        <span key={`val-${cond}`} style={{ fontSize: 12, fontWeight: 700, color: col.text, textAlign: 'right' }}>{conditionPrice(cond)}</span>
                      </>
                    )
                  })}
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>Graded estimates based on NM market price. Actual values vary by population and demand.</p>
              </div>
            )}
          </div>

          {/* Condition + Qty selectors (Collectr-style) */}
          {added !== 'collection' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-cv-muted mb-1 block">Condition</label>
                <div className="flex gap-1.5 flex-wrap">
                  {CONDITIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCondition(c)}
                      className="text-xs px-2.5 py-1 rounded-full font-medium transition"
                      style={condition === c
                        ? { background: 'var(--primary)', color: '#0A0A0C' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-cv-muted">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >−</button>
                  <span className="text-sm font-bold w-5 text-center">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(q => q + 1)}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >+</button>
                </div>
              </div>
            </div>
          )}

          {addError && <p className="text-xs text-red-400">{addError}</p>}

          {added === 'collection' ? (
            <div className="text-center text-sm font-medium py-2 flex items-center justify-center gap-2" style={{ color: '#4ECBA0' }}>
              <Check size={16} /> Added to your portfolio
            </div>
          ) : added === 'wishlist' ? (
            <div className="text-center text-sm font-medium py-2" style={{ color: '#f472b6' }}>✓ Added to your wishlist</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn-primary flex items-center justify-center gap-2 text-sm py-2.5"
                onClick={() => void handleAddToCollection()}
                disabled={addingToCollection}
              >
                <Plus size={14} />
                {addingToCollection ? 'Adding…' : 'Add to Portfolio'}
              </button>
              <button
                className="btn-ghost flex items-center justify-center gap-2 text-sm py-2.5"
                onClick={() => void handleAddToWishlist()}
                disabled={addingToWishlist}
                style={{ border: '1px solid rgba(244,114,182,0.3)', color: '#f472b6' }}
              >
                <Heart size={14} />
                {addingToWishlist ? 'Adding…' : 'Wishlist'}
              </button>
            </div>
          )}

          {/* External links: TCGPlayer + eBay */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {card.tcgplayer_url && (
              <a href={card.tcgplayer_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <ShoppingCart size={14} />
                Buy on TCGPlayer
                <ExternalLink size={12} />
              </a>
            )}
            {/* eBay live listings */}
            <a
              href={buildEbaySearchUrl(card.card_name, card.set_name, condition)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', textDecoration: 'none', color: '#e5a100', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
              onMouseLeave={e => (e.currentTarget.style.color = '#e5a100')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 7.5C3 6.119 4.119 5 5.5 5H9v2H5.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H9v2H5.5C4.119 19 3 17.881 3 16.5v-9zM15 5h3.5C19.881 5 21 6.119 21 7.5v9c0 1.381-1.119 2.5-2.5 2.5H15v-2h3.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H15V5z" fill="currentColor"/>
                <path d="M9 8h6v8H9z" fill="currentColor" opacity=".4"/>
              </svg>
              View eBay Listings ({condition})
              <ExternalLink size={12} />
            </a>
            {/* eBay sold prices */}
            <a
              href={buildEbaySearchUrl(card.card_name, card.set_name, condition, true)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', textDecoration: 'none', color: 'var(--text-secondary)', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
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

// ── Sealed product detail modal ───────────────────────────────────────────────
function SealedDetailModal({ product, onClose }: { product: SealedResult; onClose: () => void }) {
  const typeStyle = getProductTypeColor(product.product_type)
  const imageUrl = getSealedImageUrl(product)
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
          <div className="glass rounded-[var(--radius-md)] p-3 flex items-center justify-between">
            <span className="text-sm text-cv-muted">Market Price</span>
            <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              {formatPrice(product.market_price_cents)}
            </span>
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
  addedIds,
  onQuickAdd,
  addToPortfolioMode,
}: {
  item: UnifiedResult
  onSelectCard: (c: CardResult) => void
  onSelectSealed: (s: SealedResult) => void
  addedIds: Set<string>
  onQuickAdd: (item: UnifiedResult) => void
  addToPortfolioMode: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const key = item._type === 'card' ? item.ptcg_id : String(item.id)
  const isAdded = addedIds.has(key)

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

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [productTypeFilter, setProductTypeFilter] = useState<string>('')
  const [cards, setCards] = useState<CardResult[]>([])
  const [sealed, setSealed] = useState<SealedResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null)
  const [selectedSealed, setSelectedSealed] = useState<SealedResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Default search terms to show cards on page load (Collectr-style)
  const DEFAULT_QUERIES = ['pikachu', 'charizard', 'mewtwo', 'luffy', 'lightning bolt']

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

  // Auto-load popular cards on mount (Collectr-style)
  useEffect(() => {
    const randomDefault = DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)]
    void runSearch(randomDefault, 'cards')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      // When query is cleared, reload default cards
      if (query === '') {
        const randomDefault = DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)]
        void runSearch(randomDefault, category)
      } else {
        setCards([]); setSealed([]); setSearched(false)
      }
      return
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query.trim(), category)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, category, runSearch])

  const filteredSealed = productTypeFilter ? sealed.filter(p => p.product_type === productTypeFilter) : sealed

  const unifiedResults: UnifiedResult[] = (() => {
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

  const totalResults = cards.length + filteredSealed.length

  // Quick-add: add directly to portfolio without opening modal
  async function handleQuickAdd(item: UnifiedResult) {
    if (!user) { setSelectedCard(item._type === 'card' ? item : null); return }
    const key = item._type === 'card' ? item.ptcg_id : String(item.id)
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
    } catch {
      // Fall back to opening the modal
      if (item._type === 'card') setSelectedCard(item)
      else setSelectedSealed(item)
    }
  }

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 12px 80px' }}>
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

      {/* ── TCG quick filters (Collectr-style) ── */}
      {!searched && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quick Filters</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TCG_QUICK_FILTERS.map(f => (
              <button
                key={f.label}
                onClick={() => setQuery(f.query)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 20,
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-primary)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <span>{f.emoji}</span>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 14 }}>
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cv-surface border-t-[var(--primary)] mb-3" />
          <p>Searching…</p>
        </div>
      )}

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
                key={item._type === 'card' ? `card-${item.ptcg_id}` : `sealed-${item.id}`}
                item={item}
                onSelectCard={setSelectedCard}
                onSelectSealed={setSelectedSealed}
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
    </div>
  )
}
