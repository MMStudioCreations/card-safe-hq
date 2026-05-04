import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, Search, SlidersHorizontal, X } from 'lucide-react'
import { CardGridSkeleton } from '../components/SkeletonLoader'
import { api } from '../lib/api'
import type { CardResult } from '../components/CardDetailModal'

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

const TCG_QUICK_FILTERS = [
  { label: 'Pokémon',     emoji: '⚡', query: 'pikachu',           group: 'tcg' },
  { label: 'Magic',       emoji: '🔮', query: 'lightning bolt',    group: 'tcg' },
  { label: 'Yu-Gi-Oh!',  emoji: '👁', query: 'blue eyes',         group: 'tcg' },
  { label: 'One Piece',  emoji: '⚓', query: 'luffy',              group: 'tcg' },
  { label: 'Lorcana',    emoji: '✨', query: 'elsa lorcana',       group: 'tcg' },
  { label: 'Dragon Ball',emoji: '🐉', query: 'goku dragon ball',   group: 'tcg' },
  { label: 'NBA',        emoji: '🏀', query: 'lebron james basketball card', group: 'sports' },
  { label: 'NFL',        emoji: '🏈', query: 'patrick mahomes football card', group: 'sports' },
  { label: 'MLB',        emoji: '⚾', query: 'mike trout baseball card',      group: 'sports' },
  { label: 'Soccer',     emoji: '⚽', query: 'mbappe soccer card',            group: 'sports' },
  { label: 'UFC / MMA',  emoji: '🥊', query: 'conor mcgregor ufc card',       group: 'sports' },
  { label: 'F1',         emoji: '🏎', query: 'max verstappen formula 1 card', group: 'sports' },
]

type Category = 'all' | 'cards' | 'sealed'

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
  title?: string | null
  productName?: string | null
  displayName?: string | null
  normalizedDisplayName?: string | null
  alt?: string | null
  imageAlt?: string | null
  type?: string | null
  subtype?: string | null
  category?: string | null
  subcategory?: string | null
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

function getItemPriceCents(item: UnifiedResult): number | null {
  return item._type === 'card' ? item.tcgplayer_market_cents : item.market_price_cents
}

const POKEMON_CODE_CARD_KEYWORDS = [
  'code card', 'online code card', 'tcg live', 'pokemon live',
  'ptcgo', 'redeem code', 'digital code', 'redemption card',
  'redeem card', 'digital redemption',
]

function toSearchableText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isPokemonCodeCard(item: Record<string, unknown>): boolean {
  const searchableText = [
    item.name, item.title, item.productName, item.displayName,
    item.normalizedDisplayName, item.alt, item.imageAlt, item.set_name,
    item.type, item.subtype, item.category, item.subcategory,
    item.product_type, item.tcgplayer_url,
  ].map(toSearchableText).filter(Boolean).join(' ')
  if (!searchableText.includes('pokemon') && !searchableText.includes('pokémon')) return false
  return POKEMON_CODE_CARD_KEYWORDS.some(kw => searchableText.includes(kw))
}

function formatPrice(cents: number | null | undefined): string {
  if (!cents || cents <= 0) return ''
  return `$${(cents / 100).toFixed(2)}`
}

function buildEbayUrl(name: string, setName = ''): string {
  const q = [name, setName].filter(Boolean).join(' ')
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=2536`
}

function buildTCGUrl(name: string): string {
  return `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(name)}`
}

function getRarityColor(rarity: string | null): string {
  if (!rarity) return '#818cf8'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration') || r.includes('hyper')) return '#f472b6'
  if (r.includes('illustration rare') || r.includes('full art')) return '#c084fc'
  if (r.includes('secret') || r.includes('rainbow')) return '#f9a8d4'
  if (r.includes('ultra') || r.includes('vmax') || r.includes('vstar')) return 'var(--gold)'
  if (r.includes('holo')) return 'var(--gold)'
  if (r.includes('rare')) return '#818cf8'
  return '#94a3b8'
}

function getTypeLabel(item: UnifiedResult): string {
  if (item._type === 'sports') return 'SPORTS'
  if (item._type === 'card') return 'CARD'
  const t = (item as SealedResult).product_type
  if (t === 'elite_trainer_box') return 'ETB'
  if (t === 'booster_box') return 'BOX'
  if (t === 'tin') return 'TIN'
  return 'SEALED'
}

function getSealedImageUrl(product: SealedResult): string | null {
  if (product.image_url) return product.image_url
  if (product.tcgplayer_product_id) {
    return `https://product-images.tcgplayer.com/fit-in/437x437/${product.tcgplayer_product_id}.jpg`
  }
  return null
}

// ── Card grid item ────────────────────────────────────────────────────────────
function CardItem({ item }: { item: UnifiedResult }) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)

  let tcgUrl: string
  let ebayUrl: string
  let imageUrl: string | null = null
  let name: string
  let subtitle: string
  let priceCents: number | null = null
  let rarityLabel: string | null = null

  if (item._type === 'sports') {
    tcgUrl = item.ebay_url || buildEbayUrl(item.card_name, item.set_name)
    ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.card_name + ' ' + item.set_name)}&_sacat=212`
    imageUrl = item.image_small
    name = item.card_name
    subtitle = item.set_name || item.sport
    priceCents = item.market_price_cents
    rarityLabel = item.rarity || item.card_type || null
  } else if (item._type === 'card') {
    tcgUrl = buildTCGUrl(item.card_name)
    ebayUrl = buildEbayUrl(item.card_name, item.set_name)
    imageUrl = item.image_small
    name = item.card_name
    subtitle = item.set_name
    priceCents = item.tcgplayer_market_cents
    rarityLabel = item.rarity || null
  } else {
    tcgUrl = item.tcgplayer_url || buildTCGUrl(item.name)
    ebayUrl = buildEbayUrl(item.name, item.set_name)
    imageUrl = getSealedImageUrl(item)
    name = item.name
    subtitle = item.set_name
    priceCents = item.market_price_cents
    rarityLabel = TYPE_LABELS[item.product_type] ?? null
  }

  const typeLabel = getTypeLabel(item)
  const price = formatPrice(priceCents)

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hovered ? 'rgba(200,169,81,0.4)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.4), 0 0 20px rgba(200,169,81,0.08)' : 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.open(tcgUrl, '_blank', 'noopener noreferrer')}
    >
      {/* Image container — 2:3 ratio */}
      <div style={{ aspectRatio: '2/3', background: 'rgba(0,0,0,0.4)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.25s ease', transform: hovered ? 'scale(1.03)' : 'scale(1)' }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, background: 'linear-gradient(135deg, rgba(200,169,81,0.06), rgba(0,0,0,0.3))' }}>
            {item._type === 'sports' ? '🏆' : item._type === 'card' ? '🃏' : '📦'}
          </div>
        )}
        {/* Type badge */}
        <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(6,6,10,0.85)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '2px 6px', fontSize: 8, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.10em', fontFamily: "'DM Mono', monospace", border: '1px solid rgba(200,169,81,0.2)' }}>
          {typeLabel}
        </div>
        {/* Holo shimmer on hover */}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(200,169,81,0.05) 0%, rgba(155,89,255,0.04) 50%, rgba(0,200,255,0.04) 100%)', pointerEvents: 'none' }} />
        )}
      </div>

      {/* Info + actions */}
      <div style={{ padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.3 }}>
          {name}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
          {subtitle}
        </p>
        {rarityLabel && (
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, padding: '1px 5px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: item._type === 'card' ? getRarityColor(item.rarity) : 'var(--gold)', fontWeight: 600, fontFamily: "'DM Mono', monospace", alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rarityLabel}
          </span>
        )}
        {price && (
          <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--gold)', fontFamily: "'DM Mono', monospace" }}>
            {price}
          </p>
        )}

        {/* External link buttons */}
        <div
          style={{ display: 'flex', gap: 4, marginTop: 'auto', paddingTop: 8 }}
          onClick={e => e.stopPropagation()}
        >
          <a
            href={tcgUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 2px', borderRadius: 7, border: '1px solid rgba(200,169,81,0.4)', color: 'var(--gold)', fontSize: 9, fontWeight: 700, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.03em', background: 'rgba(200,169,81,0.06)', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,169,81,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(200,169,81,0.06)')}
          >
            <ExternalLink size={8} />
            {item._type === 'sports' ? 'eBay' : 'TCGPlayer'}
          </a>
          <a
            href={ebayUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 2px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-dim)', fontSize: 9, fontWeight: 700, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.03em', background: 'rgba(255,255,255,0.02)', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
          >
            <ExternalLink size={8} />
            {item._type === 'sports' ? 'Sold' : 'eBay'}
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main SearchPage ───────────────────────────────────────────────────────────
export default function SearchPage() {
  const [searchParams] = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState<Category>('cards')
  const [productTypeFilter, setProductTypeFilter] = useState('')
  const [cards, setCards] = useState<CardResult[]>([])
  const [sealed, setSealed] = useState<SealedResult[]>([])
  const [sportsCards, setSportsCards] = useState<SportsCardResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [activeFilterGroup, setActiveFilterGroup] = useState<'tcg' | 'sports'>('tcg')
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('')
  const [sortBy, setSortBy] = useState<'price_desc' | 'relevance'>('price_desc')
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const TCG_DEFAULT_QUERIES = ['pikachu', 'charizard', 'mewtwo', 'luffy', 'lightning bolt', 'elsa lorcana', 'goku dragon ball']
  const SPORTS_DEFAULT_QUERIES = ['lebron james basketball card', 'patrick mahomes football card', 'mike trout baseball card', 'mbappe soccer card', 'max verstappen formula 1 card']

  const runSearch = useCallback(async (q: string, cat: Category) => {
    setLoading(true)
    try {
      const result = await api.universalSearch(q.trim(), cat, 80)
      setCards(
        (result.cards ?? [])
          .filter((c: Omit<CardResult, '_type'>) => !isPokemonCodeCard(c as Record<string, unknown>))
          .map((c: Omit<CardResult, '_type'>) => ({ ...c, _type: 'card' as const }))
      )
      setSealed(
        (result.sealed ?? [])
          .filter((s: Omit<SealedResult, '_type'>) => !isPokemonCodeCard(s as Record<string, unknown>))
          .map((s: Omit<SealedResult, '_type'>) => ({ ...s, _type: 'sealed' as const }))
      )
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
      const mapped: SportsCardResult[] = (result.data ?? []).map((item: any) => {
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
          const pick = TCG_DEFAULT_QUERIES[Math.floor(Math.random() * TCG_DEFAULT_QUERIES.length)]
          void runSearch(pick, category)
        }
      } else {
        setCards([]); setSealed([]); setSportsCards([]); setSearched(false)
      }
      return
    }
    debounceRef.current = setTimeout(() => {
      if (activeFilterGroup === 'sports') void runSportsSearch(query.trim())
      else void runSearch(query.trim(), category)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, category, activeFilterGroup, runSearch, runSportsSearch])

  const filteredSealed = productTypeFilter ? sealed.filter(p => p.product_type === productTypeFilter) : sealed
  const isSportsMode = activeFilterGroup === 'sports'
  const availableQuickFilters = TCG_QUICK_FILTERS.filter(f => f.group === activeFilterGroup)
  const secondaryFilterCount = (productTypeFilter ? 1 : 0) + (selectedQuickFilter ? 1 : 0)

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

  const priceFilteredResults = unifiedResults.filter(item => {
    const p = getItemPriceCents(item)
    return p !== null && p > 0
  })

  const displayedResults: UnifiedResult[] = sortBy === 'price_desc'
    ? [...priceFilteredResults].sort((a, b) => (getItemPriceCents(b) ?? 0) - (getItemPriceCents(a) ?? 0))
    : priceFilteredResults

  const totalResults = displayedResults.length

  function applyQuickFilter(filterValue: string) {
    if (!filterValue) { setSelectedQuickFilter(''); return }
    const next = availableQuickFilters.find(f => f.label === filterValue)
    if (!next) return
    setSelectedQuickFilter(next.label)
    setQuery(next.query)
    if (next.group === 'sports') void runSportsSearch(next.query, next.label.toLowerCase())
    else { setCategory('cards'); void runSearch(next.query, 'cards') }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 15,
    color: 'var(--text)',
    padding: '14px 0',
    fontFamily: "'DM Mono', monospace",
  }

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    border: '1px solid',
    borderColor: active ? 'rgba(200,169,81,0.5)' : 'var(--border)',
    background: active ? 'var(--gold-dim)' : 'rgba(255,255,255,0.02)',
    color: active ? 'var(--gold)' : 'var(--text-dim)',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.15s',
  })

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 12px 80px' }}>
      {/* ── Header ── */}
      <div style={{ paddingTop: 24, paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 20, height: 2, background: 'var(--gold)' }} />
          <span style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: 'uppercase' }}>Browse</span>
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 600, margin: 0, color: 'var(--text)', lineHeight: 1.1 }}>
          Find This Card
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '6px 0 0', fontFamily: "'DM Sans', sans-serif" }}>
          Search any card across Pokémon, MTG, Yu-Gi-Oh!, and more — click any result to buy on TCGPlayer or eBay.
        </p>
      </div>

      {/* ── Sticky search + filters ── */}
      <div style={{ position: 'sticky', top: 10, zIndex: 20, marginBottom: 16 }}>
        <div style={{ background: 'rgba(6,6,10,0.96)', backdropFilter: 'blur(16px)', border: '1px solid var(--border)', borderRadius: 16, padding: 10 }}>
          {/* Search input */}
          <div style={{ position: 'relative', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, marginBottom: 10 }}>
            <Search size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search cards, sets, ETBs, tins, promo packs…"
              autoFocus
              style={inputStyle}
            />
            {query && (
              <button onClick={() => { setQuery(''); inputRef.current?.focus() }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* TCG / Sports toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['tcg', 'sports'] as const).map(g => (
              <button
                key={g}
                onClick={() => {
                  setActiveFilterGroup(g)
                  setSelectedQuickFilter('')
                  setProductTypeFilter('')
                  setQuery('')
                  if (g === 'sports') {
                    const pick = SPORTS_DEFAULT_QUERIES[Math.floor(Math.random() * SPORTS_DEFAULT_QUERIES.length)]
                    void runSportsSearch(pick)
                  } else {
                    const pick = TCG_DEFAULT_QUERIES[Math.floor(Math.random() * TCG_DEFAULT_QUERIES.length)]
                    void runSearch(pick, 'cards')
                  }
                }}
                style={filterBtnStyle(activeFilterGroup === g)}
              >
                {g === 'tcg' ? '🃏 TCG' : '🏆 Sports'}
              </button>
            ))}
          </div>

          {/* Game/Brand + Filters button */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 220px', minWidth: 180 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.10em', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>Game / Brand</span>
              <select
                value={selectedQuickFilter}
                onChange={e => applyQuickFilter(e.target.value)}
                style={{ flex: 1, minWidth: 100, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', padding: '7px 10px', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
              >
                <option value="">All {isSportsMode ? 'Sports' : 'TCG'} Brands</option>
                {availableQuickFilters.map(f => (
                  <option key={f.label} value={f.label}>{f.emoji} {f.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setShowSecondaryFilters(true)}
              style={{ borderRadius: 9, border: '1px solid var(--border)', background: secondaryFilterCount > 0 ? 'var(--gold-dim)' : 'rgba(255,255,255,0.02)', color: secondaryFilterCount > 0 ? 'var(--gold)' : 'var(--text-dim)', padding: '8px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              <SlidersHorizontal size={13} />
              Filters{secondaryFilterCount > 0 ? ` (${secondaryFilterCount})` : ''}
            </button>
          </div>

          {/* Category tabs */}
          {!isSportsMode && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'cards', 'sealed'] as Category[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setProductTypeFilter('') }}
                  style={filterBtnStyle(category === cat)}
                >
                  {cat === 'all' ? 'All Results' : cat === 'cards' ? 'Cards' : 'Sealed'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sort + result count bar ── */}
      {!loading && totalResults > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>{totalResults}</span> result{totalResults !== 1 ? 's' : ''}
            {secondaryFilterCount > 0 && <span style={{ marginLeft: 8 }}>· {secondaryFilterCount} filter{secondaryFilterCount !== 1 ? 's' : ''} active</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>Sort</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'price_desc' | 'relevance')}
              style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', padding: '5px 8px', fontSize: 11, fontFamily: "'DM Mono', monospace" }}
            >
              <option value="price_desc">Price: High to Low</option>
              <option value="relevance">Best match</option>
            </select>
            {secondaryFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setProductTypeFilter(''); setSelectedQuickFilter('') }}
                style={{ border: 'none', background: 'none', color: 'var(--gold)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Secondary filters modal ── */}
      {showSecondaryFilters && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSecondaryFilters(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(720px, 100%)', maxHeight: '80vh', overflowY: 'auto', background: 'var(--deep)', border: '1px solid var(--border)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>Filters</h3>
              <button onClick={() => setShowSecondaryFilters(false)} style={{ border: 'none', background: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {(category === 'sealed' || (category === 'all' && sealed.length > 0)) && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, margin: '0 0 8px', color: 'var(--text-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Product subtype</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setProductTypeFilter('')} style={filterBtnStyle(productTypeFilter === '')}>All Products</button>
                  {PRODUCT_FILTER_GROUPS.map(({ label, value }) => (
                    <button key={value} onClick={() => setProductTypeFilter(productTypeFilter === value ? '' : value)} style={filterBtnStyle(productTypeFilter === value)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p style={{ fontSize: 11, margin: '0 0 8px', color: 'var(--text-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Quick filters</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {availableQuickFilters.map(f => (
                  <button key={f.label} onClick={() => { applyQuickFilter(f.label); setShowSecondaryFilters(false) }} style={filterBtnStyle(selectedQuickFilter === f.label)}>
                    {f.emoji} {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && <CardGridSkeleton count={12} />}

      {/* ── Empty state ── */}
      {!loading && !searched && query.trim().length >= 2 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
          <Search size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontStyle: 'italic', color: 'var(--text-mid)', margin: 0 }}>
            Search for any card across Pokémon, MTG, and Yu-Gi-Oh!
          </p>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>Pokémon, MTG, Yu-Gi-Oh!, One Piece, and more</p>
        </div>
      )}

      {/* ── No results ── */}
      {!loading && searched && totalResults === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontStyle: 'italic', color: 'var(--text-mid)', margin: 0 }}>No results for "{query}"</p>
          <p style={{ fontSize: 13, marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>Try a different name, set, or product type</p>
        </div>
      )}

      {/* ── Results grid ── */}
      {!loading && displayedResults.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
          {displayedResults.map(item => (
            <CardItem
              key={item._type === 'card' ? `card-${item.ptcg_id}` : item._type === 'sports' ? `sports-${item.id}` : `sealed-${item.id}`}
              item={item}
            />
          ))}
        </div>
      )}
    </div>
  )
}
