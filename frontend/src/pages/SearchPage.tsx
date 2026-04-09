import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Package, Search, X } from 'lucide-react'
import { api } from '../lib/api'

// ── Type labels for sealed products ──────────────────────────────────────────
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
}

function formatPrice(cents: number | null | undefined): string {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [cards, setCards] = useState<CardResult[]>([])
  const [sealed, setSealed] = useState<SealedResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setCards([])
      setSealed([])
      setSearched(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const result = await api.universalSearch(query.trim(), category, 60)
        setCards(result.cards ?? [])
        setSealed(result.sealed ?? [])
        setSearched(true)
      } catch {
        setCards([])
        setSealed([])
        setSearched(true)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, category])

  const totalResults = cards.length + sealed.length

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 12px 80px' }}>
      {/* ── Header ── */}
      <div style={{ paddingTop: 20, paddingBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Search
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Find any Pokémon card or sealed product
        </p>
      </div>

      {/* ── Search bar ── */}
      <div style={{
        position: 'relative',
        marginBottom: 12,
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
      }}>
        <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, set, year…"
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 16,
            color: 'var(--text-primary)',
            padding: '14px 0',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Category filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'cards', 'sealed'] as Category[]).map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid var(--glass-border)',
              background: category === cat ? 'var(--accent, #6366f1)' : 'var(--glass-bg)',
              color: category === cat ? '#fff' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: category === cat ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {cat === 'all' ? 'All Types' : cat === 'cards' ? 'Cards' : 'Sealed'}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 14 }}>
          Searching…
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !searched && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <Search size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 15, margin: 0 }}>Type at least 2 characters to search</p>
        </div>
      )}

      {/* ── No results ── */}
      {!loading && searched && totalResults === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 15, margin: 0 }}>No results for <strong>"{query}"</strong></p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Try a different name or set</p>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && totalResults > 0 && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {totalResults} result{totalResults !== 1 ? 's' : ''}
            {cards.length > 0 && sealed.length > 0 && ` (${cards.length} card${cards.length !== 1 ? 's' : ''}, ${sealed.length} sealed)`}
          </p>

          {/* Card results */}
          {cards.length > 0 && (
            <div>
              {category === 'all' && (
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Cards
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {cards.map(card => (
                  <div key={card.ptcg_id} style={{
                    display: 'flex',
                    gap: 14,
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    {/* Card image */}
                    <div style={{ flexShrink: 0, width: 56, height: 78, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                      {card.image_small ? (
                        <img
                          src={card.image_small}
                          alt={card.card_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🃏</div>
                      )}
                    </div>

                    {/* Card info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {card.card_name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {card.set_name}{card.card_number ? ` · #${card.card_number}` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {card.rarity && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 500 }}>
                            {card.rarity}
                          </span>
                        )}
                        {card.supertype && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 500 }}>
                            {card.supertype}
                          </span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 'auto' }}>
                          {formatPrice(card.tcgplayer_market_cents)}
                        </span>
                      </div>
                    </div>

                    {/* TCGPlayer link */}
                    {card.tcgplayer_url && (
                      <a
                        href={card.tcgplayer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ flexShrink: 0, color: 'var(--text-secondary)', padding: 4 }}
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sealed results */}
          {sealed.length > 0 && (
            <div>
              {category === 'all' && (
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Sealed Products
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sealed.map(product => (
                  <div key={product.id} style={{
                    display: 'flex',
                    gap: 14,
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    {/* Sealed icon */}
                    <div style={{
                      flexShrink: 0, width: 56, height: 56, borderRadius: 10,
                      background: 'rgba(245,158,11,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Package size={26} color="#f59e0b" />
                    </div>

                    {/* Sealed info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      } as React.CSSProperties}>
                        {product.name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {product.set_name}
                      </p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 500 }}>
                          {TYPE_LABELS[product.product_type] ?? product.product_type}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 'auto' }}>
                          {formatPrice(product.market_price_cents)}
                        </span>
                      </div>
                    </div>

                    {/* TCGPlayer link */}
                    {product.tcgplayer_url && (
                      <a
                        href={product.tcgplayer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ flexShrink: 0, color: 'var(--text-secondary)', padding: 4 }}
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
