import { useLayoutEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { api } from '../lib/api'
import { queryKeys, useCollectionItem, useComps, useGrade, useCompsHistory, usePriceByCardId } from '../lib/hooks'
import CardCrop from '../components/CardCrop'

// ── Recharts Price Chart ──────────────────────────────────────────────────────

type SoldComp = { sold_price_cents: number; sold_date: string; title: string; source?: string }

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props
  if (payload?.type === 'active') {
    return <circle cx={cx} cy={cy} r={4} fill="#D4AF37" fillOpacity={0.5} stroke="none" />
  }
  return <circle cx={cx} cy={cy} r={4} fill="var(--primary)" stroke="#080C10" strokeWidth={1.5} />
}

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-cv-border bg-cv-bg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-cv-text">${(d.price / 100).toFixed(2)}</p>
      <p className="text-cv-muted">{d.dateLabel}</p>
      {d.title && <p className="text-cv-muted max-w-[200px] truncate">{d.title}</p>}
      <p className="text-cv-muted capitalize">{d.type === 'active' ? 'Active Listing' : 'eBay Sold'}</p>
    </div>
  )
}

const PriceChart = ({
  soldListings,
  activeListings,
  pricing,
  days,
}: {
  soldListings: SoldComp[]
  activeListings: SoldComp[]
  pricing?: { tcgplayer?: { market?: number | null } | null; pricecharting?: { loose_price_cents?: number | null } | null } | null
  days: 30 | 60 | 90
}) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const tcgPrice = pricing?.tcgplayer?.market ?? null
  const pcPrice = pricing?.pricecharting?.loose_price_cents ?? null

  // Build chart data from individual sold listings (sorted by date asc)
  const soldPoints = soldListings
    .filter((s) => s.source === 'ebay_sold' || !s.source)
    .filter((s) => new Date(s.sold_date) >= cutoff)
    .map((s) => ({
      timestamp: new Date(s.sold_date).getTime(),
      price: s.sold_price_cents,
      dateLabel: new Date(s.sold_date).toLocaleDateString(),
      title: s.title,
      type: 'sold' as const,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  const activePoints = activeListings
    .filter((a) => new Date(a.sold_date) >= cutoff)
    .map((a) => ({
      timestamp: new Date(a.sold_date).getTime(),
      price: a.sold_price_cents,
      dateLabel: new Date(a.sold_date).toLocaleDateString(),
      title: a.title,
      type: 'active' as const,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  const allPoints = [...soldPoints, ...activePoints].sort((a, b) => a.timestamp - b.timestamp)

  if (allPoints.length === 0 && !tcgPrice && !pcPrice) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 text-cv-muted text-sm">
        <p>No market data yet.</p>
        <p className="text-xs">Click Refresh in the eBay section below to populate.</p>
      </div>
    )
  }

  if (allPoints.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex h-20 items-center justify-center rounded-[var(--radius-md)] bg-cv-surface">
          <div className="text-center">
            {tcgPrice && <p className="text-sm text-cv-muted">TCGPlayer: <strong className="text-cv-text">${(tcgPrice / 100).toFixed(2)}</strong></p>}
            {pcPrice && <p className="text-sm text-cv-muted">PriceCharting: <strong className="text-cv-text">${(pcPrice / 100).toFixed(2)}</strong></p>}
          </div>
        </div>
        <p className="text-xs text-center text-cv-muted">Refresh eBay comps to see price movement over time</p>
      </div>
    )
  }

  const prices = allPoints.map((d) => d.price)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={allPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#6B7280' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
            tick={{ fontSize: 10, fill: '#6B7280' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<ChartTooltip />} />
          {tcgPrice && (
            <ReferenceLine
              y={tcgPrice}
              stroke="#60a5fa"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: 'TCG', position: 'right', fontSize: 9, fill: '#60a5fa' }}
            />
          )}
          {pcPrice && (
            <ReferenceLine
              y={pcPrice}
              stroke="#a78bfa"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: 'PC', position: 'right', fontSize: 9, fill: '#a78bfa' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 5, fill: 'var(--primary)' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-cv-muted">
        <span>Low ${(low / 100).toFixed(2)}</span>
        <span>Avg ${(avg / 100).toFixed(2)}</span>
        <span>High ${(high / 100).toFixed(2)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-cv-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[var(--primary)]" /> eBay Sold
        </span>
        {activePoints.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#D4AF37] opacity-50" /> Active Listings
          </span>
        )}
        {tcgPrice && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-400 opacity-50" /> TCGPlayer
          </span>
        )}
        {pcPrice && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-violet-400 opacity-50" /> PriceCharting
          </span>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoursAgo(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime()
  const h = Math.floor(ms / (1000 * 60 * 60))
  if (h < 1) return 'less than 1 hour ago'
  return `${h} hour${h === 1 ? '' : 's'} ago`
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CardDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: item, isLoading } = useCollectionItem(id)
  const cardId = item?.card_id ?? undefined

  // Build cardId for /api/prices across all supported categories
  const priceApiCardId = (() => {
    if (!item) return undefined

    const game = (item.game ?? item.card?.game ?? '').toLowerCase().trim()
    const sport = (item.sport ?? item.card?.sport ?? '').toLowerCase().trim()
    const productType = (item.product_type ?? '').toLowerCase().trim()

    const cardName = (item.card_name ?? item.player_name ?? item.card?.card_name ?? item.product_name ?? '').trim()
    const setName = (item.set_name ?? item.card?.set_name ?? '').trim()
    const cardNumber = (item.card_number ?? item.card?.card_number ?? '').trim()
    const year = item.year ?? item.card?.year ?? null
    const brand = (item.manufacturer ?? item.card?.manufacturer ?? item.set_name ?? '').trim()

    const isSealed = productType !== '' && productType !== 'single_card'
    const isSports = !!sport || ['baseball', 'basketball', 'football', 'hockey'].some((s) => game.includes(s))

    if (isSealed) {
      const productName = (item.product_name ?? cardName).trim()
      if (!productName) return undefined
      return `pricecharting:${productName}`
    }

    if (isSports) {
      const sportsQuery = [cardName, year, brand].filter(Boolean).join(' ').trim()
      if (!sportsQuery) return undefined
      return `pricecharting:${sportsQuery}`
    }

    const tcgGameMap: Array<{ test: (value: string) => boolean; game: string }> = [
      { test: (v) => v.includes('magic') || v.includes('mtg'), game: 'mtg' },
      { test: (v) => v.includes('yugioh') || v.includes('yu-gi-oh'), game: 'yugioh' },
      { test: (v) => v.includes('lorcana'), game: 'lorcana' },
      { test: (v) => v.includes('one piece') || v.includes('one-piece'), game: 'one-piece' },
      { test: (v) => v.includes('dragon ball'), game: 'dragon-ball-super' },
    ]

    const mapped = tcgGameMap.find((entry) => entry.test(game))
    const gameParam = mapped?.game ?? 'pokemon'

    if (!cardName && !cardNumber) return undefined

    if (gameParam === 'pokemon') {
      const pokemonQuery = [cardName || cardNumber, setName].filter(Boolean).join(' ').trim()
      return pokemonQuery ? `tcgfast:${pokemonQuery}` : undefined
    }

    if (gameParam === 'mtg') {
      const mtgQuery = [cardName, setName].filter(Boolean).join(' ').trim()
      return mtgQuery ? `tcgfast:${mtgQuery}&game=mtg` : undefined
    }

    const genericQuery = cardName || cardNumber
    return genericQuery ? `tcgfast:${genericQuery}&game=${gameParam}` : undefined
  })()

  if (priceApiCardId) {
    console.debug('[prices-ui] CardDetailPage cardId', {
      collectionItemId: item?.id,
      cardId: item?.card_id,
      priceApiCardId,
      game: item?.game,
      sport: item?.sport,
      productType: item?.product_type,
    })
  }

  const {
    data: apiPrices,
    error: apiPricesError,
    isLoading: apiPricesLoading,
    isFetching: apiPricesFetching,
  } = usePriceByCardId(priceApiCardId)

  // eBay comps are only auto-fetched as fallback when the price API returns 404/502
  const priceApiFailed =
    apiPricesError != null &&
    ((apiPricesError as any).httpStatus === 404 || (apiPricesError as any).httpStatus === 502)
  const { data: comps } = useComps(priceApiFailed ? cardId : undefined)
  const { data: historyData } = useCompsHistory(cardId)
  const { data: grade, refetch: refetchGrade } = useGrade(item?.id)
  const [showFront, setShowFront] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [chartDays, setChartDays] = useState<30 | 60 | 90>(30)
  const [compsTab, setCompsTab] = useState<'sold' | 'active'>('sold')
  const [draft, setDraft] = useState({
    quantity: item?.quantity || 1,
    condition_note: item?.condition_note || '',
    estimated_value_cents: item?.estimated_value_cents || 0,
    card_name: item?.card_name || '',
    set_name: item?.set_name || '',
    card_number: item?.card_number || '',
  })

  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      if (document.documentElement) document.documentElement.scrollTop = 0
      if (document.body) document.body.scrollTop = 0
    }
    resetScroll()
    const raf = window.requestAnimationFrame(resetScroll)
    return () => window.cancelAnimationFrame(raf)
  }, [id])

  const image = useMemo(
    () => (showFront ? item?.front_image_url : item?.back_image_url) || item?.front_image_url,
    [item, showFront],
  )

  // Legacy sheet items have bbox stored; new pre-cropped items do not
  const isSheet = image?.includes('sheets/')
  const detailBbox = (item?.bbox_x != null && item?.bbox_y != null)
    ? { x: item.bbox_x, y: item.bbox_y, width: item.bbox_width ?? 28, height: item.bbox_height ?? 28 }
    : null
  const needsCrop = isSheet && detailBbox != null

  const sheetImageUrl = image
    ? `${import.meta.env.VITE_API_URL}/api/images/${encodeURIComponent(image)}`
    : null

  // Price trend: compare current estimated_value_cents vs 7-day avg from history
  const trend = useMemo(() => {
    if (!historyData?.history?.length || !item?.estimated_value_cents) return null
    const cutoff7 = new Date()
    cutoff7.setDate(cutoff7.getDate() - 7)
    const recent = historyData.history.filter((h) => new Date(h.date) >= cutoff7)
    if (!recent.length) return null
    const avg7 = recent.reduce((a, b) => a + b.avg_price_cents, 0) / recent.length
    const pct = ((item.estimated_value_cents - avg7) / avg7) * 100
    return { pct, up: pct >= 0 }
  }, [historyData, item])

  const { data: pricing } = useQuery({
    queryKey: ['pricing', cardId],
    queryFn: () => api.getCardPricing(cardId!),
    enabled: cardId != null,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  const gradingMutation = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('No item loaded')
      return api.estimateGrade(item.id)
    },
    onSuccess: () => void refetchGrade(),
  })

  const refreshComps = useMutation({
    mutationFn: async () => {
      if (!cardId) throw new Error('No card linked yet')
      return api.refreshComps(cardId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comps(cardId) })
      void queryClient.invalidateQueries({ queryKey: ['comps-history', cardId] })
    },
  })

  async function saveEdit() {
    if (!item) return
    await api.updateCollectionItem(item.id, draft)
    await queryClient.invalidateQueries({ queryKey: queryKeys.collectionItem(id) })
    await queryClient.invalidateQueries({ queryKey: queryKeys.collection(true) })
    setEditing(false)
  }

  async function saveName() {
    if (!item || !nameDraft.trim()) return
    await api.updateCollectionItem(item.id, {
      card_name: nameDraft.trim(),
    } as any)
    if (cardId) {
      await api.refreshComps(cardId)
      await queryClient.invalidateQueries({ queryKey: queryKeys.comps(cardId) })
      await queryClient.invalidateQueries({ queryKey: ['comps-history', cardId] })
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.collectionItem(id) })
    setEditingName(false)
  }

  async function removeItem() {
    if (!item || !window.confirm('Delete this card permanently?')) return
    await api.deleteCollectionItem(item.id)
    navigate('/')
  }

   if (isLoading || !item) return <div className="glass p-6">Loading card details...</div>
  const avgPrice = comps?.summary?.average_price_cents
  const soldListings = comps?.sold ?? []
  const activeListings = comps?.active ?? []
  // Most recent sold = first item in sold list (sorted by sold_date DESC from backend)
  const mostRecentSold = soldListings.length > 0
    ? [...soldListings].sort((a, b) => new Date(b.sold_date).getTime() - new Date(a.sold_date).getTime())[0]
    : null
  const displayPriceCents = item.latest_sold_price_cents ?? item.estimated_value_cents ?? 0
  const headerPriceCents = mostRecentSold?.sold_price_cents ?? displayPriceCents

  return (
    <div className="grid gap-4 px-4 pb-8 lg:grid-cols-[340px,1fr]">
      {/* ── Card Image ── */}
      <section className="glass p-4">
        <div className="mb-3 flex gap-2">
          <button
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showFront
                ? 'bg-[var(--primary)] text-[#080C10]'
                : 'bg-cv-surface border border-cv-border text-cv-muted'
            }`}
            onClick={() => setShowFront(true)}
            type="button"
          >
            Front
          </button>
          <button
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !showFront
                ? 'bg-[var(--primary)] text-[#080C10]'
                : 'bg-cv-surface border border-cv-border text-cv-muted'
            }`}
            onClick={() => setShowFront(false)}
            type="button"
            disabled={!item.back_image_url}
          >
            Back
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-xl mx-auto" style={{ maxWidth: '320px' }}>
          {needsCrop && sheetImageUrl ? (
            <CardCrop
              sheetUrl={sheetImageUrl}
              bbox={detailBbox!}
              alt={item.card_name || item.player_name || 'Card'}
              className="w-full h-auto object-contain"
            />
          ) : sheetImageUrl ? (
            <img
              className="w-full h-auto object-contain"
              style={{ aspectRatio: '2.5 / 3.5', display: 'block' }}
              src={sheetImageUrl}
              alt={item.card_name || item.player_name || 'Card'}
            />
          ) : item?.image_url ? (
            <img
              className="w-full h-auto object-contain"
              style={{ aspectRatio: '2.5 / 3.5', display: 'block' }}
              src={item.image_url}
              alt={item.card_name || item.player_name || 'Card'}
            />
          ) : (
            <div className="w-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))]" style={{ aspectRatio: '2.5 / 3.5' }} />
          )}
        </div>
      </section>

      <section className="space-y-4">
        {/* ── Card Info ── */}
        <article className="glass p-4 overflow-visible">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    className="input text-xl font-bold flex-1"
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void saveName(); if (e.key === 'Escape') setEditingName(false) }}
                    autoFocus
                  />
                  <button className="btn-primary text-xs" onClick={() => void saveName()} type="button">Save</button>
                  <button className="btn-ghost text-xs" onClick={() => setEditingName(false)} type="button">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold">
                    {item.player_name || item.card_name || item.card?.player_name || item.card?.card_name || 'Unidentified Card'}
                  </h1>
                  <button
                    className="btn-ghost text-xs text-cv-muted"
                    onClick={() => {
                      setNameDraft(item.player_name || item.card_name || item.card?.player_name || item.card?.card_name || '')
                      setEditingName(true)
                    }}
                    type="button"
                    title="Edit card name"
                  >
                    ✎
                  </button>
                </div>
              )}
              <p className="text-sm text-cv-muted">
                {[
                  item.year ?? item.card?.year,
                  item.set_name ?? item.card?.set_name,
                  item.card_number ?? item.card?.card_number
                    ? `#${item.card_number ?? item.card?.card_number}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(() => {
                  const game = item.sport ?? item.card?.sport ?? item.game ?? item.card?.game
                  return game && game !== 'Unknown' && game !== 'Other' ? <span className="badge">{game}</span> : null
                })()}
                {(() => {
                  const rarity = item.variation ?? item.card?.variation
                  return rarity && rarity !== 'Unknown' && rarity !== 'Base' ? <span className="badge">{rarity}</span> : null
                })()}
                {(() => {
                  const setN = item.set_name ?? item.card?.set_name
                  return setN && setN !== 'Unknown' ? <span className="badge">{setN}</span> : null
                })()}
                {item.condition_note && <span className="badge">{item.condition_note}</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-cv-muted mb-1">
                {mostRecentSold
                  ? `Last eBay Sale · ${new Date(mostRecentSold.sold_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`
                  : item.estimated_value_cents
                  ? 'Est. Value'
                  : 'No Value Set'}
              </p>
              <p className="text-2xl font-bold">
                {headerPriceCents
                  ? `$${(headerPriceCents / 100).toFixed(2)}`
                  : '—'}
              </p>
              {trend && (
                <p className={`text-sm font-medium ${trend.up ? 'text-green-400' : 'text-red-400'}`}>
                  {trend.up ? '▲' : '▼'} {Math.abs(trend.pct).toFixed(1)}% vs 7d avg
                </p>
              )}
            </div>
          </div>

          <p className="mt-2 text-sm text-cv-muted">Qty: {item.quantity || 1}</p>

          {editing ? (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-cv-muted">Card Name</label>
                <input
                  className="input mt-1"
                  value={draft.card_name}
                  onChange={(e) => setDraft((old) => ({ ...old, card_name: e.target.value }))}
                  placeholder="Card name"
                />
              </div>
              <div>
                <label className="text-xs text-cv-muted">Set Name</label>
                <input
                  className="input mt-1"
                  value={draft.set_name}
                  onChange={(e) => setDraft((old) => ({ ...old, set_name: e.target.value }))}
                  placeholder="Set name"
                />
              </div>
              <div>
                <label className="text-xs text-cv-muted">Card Number</label>
                <input
                  className="input mt-1"
                  value={draft.card_number}
                  onChange={(e) => setDraft((old) => ({ ...old, card_number: e.target.value }))}
                  placeholder="Card number"
                />
              </div>
              <input
                className="input"
                type="number"
                value={draft.quantity}
                onChange={(e) => setDraft((old) => ({ ...old, quantity: Number(e.target.value) }))}
                placeholder="Quantity"
              />
              <input
                className="input"
                value={draft.condition_note}
                onChange={(e) => setDraft((old) => ({ ...old, condition_note: e.target.value }))}
                placeholder="Condition note"
              />
              <input
                className="input"
                type="number"
                value={draft.estimated_value_cents}
                onChange={(e) =>
                  setDraft((old) => ({ ...old, estimated_value_cents: Number(e.target.value) }))
                }
                placeholder="Estimated value cents"
              />
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => void saveEdit()} type="button">
                  Save
                </button>
                <button className="btn-ghost" onClick={() => setEditing(false)} type="button">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary" onClick={() => {
                setDraft({
                  quantity: item.quantity || 1,
                  condition_note: item.condition_note || '',
                  estimated_value_cents: item.estimated_value_cents || 0,
                  card_name: item.card_name || '',
                  set_name: item.set_name || '',
                  card_number: item.card_number || '',
                })
                setEditing(true)
              }} type="button">
                Edit
              </button>
              <button
                className="btn-ghost border-cv-danger/60 text-cv-danger"
                onClick={() => void removeItem()}
                type="button"
              >
                Delete
              </button>
            </div>
          )}
        </article>

        {/* ── Price History Chart ── */}
        <article className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Price History</h2>
            <div className="flex gap-1">
              {([30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  className={d === chartDays ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                  onClick={() => setChartDays(d)}
                  type="button"
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <PriceChart
            soldListings={soldListings}
            activeListings={activeListings}
            pricing={pricing}
            days={chartDays}
          />
        </article>

        {/* ── Market Prices ── */}
        <article className="glass p-4">
          <h2 className="mb-3 text-lg font-semibold">Market Prices</h2>

          {/* New price block — TCGFast / PriceCharting via /api/prices */}
          {priceApiCardId && (
            <div className="mb-4 rounded-[var(--radius-md)] border border-cv-border bg-cv-surface p-3">
              {apiPricesLoading || apiPricesFetching ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 w-40 rounded bg-cv-border" />
                  <div className="h-7 w-28 rounded bg-cv-border" />
                  <div className="h-3 w-48 rounded bg-cv-border" />
                </div>
              ) : apiPrices ? (
                <>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <p className="text-xs text-cv-muted">Market Price (NM):</p>
                      <p className="text-xl font-bold">
                        {apiPrices.price_nm != null ? `$${apiPrices.price_nm.toFixed(2)}` : '—'}
                      </p>
                    </div>
                    {apiPrices.price_psa10 != null && (
                      <div>
                        <p className="text-xs text-cv-muted">PSA 10:</p>
                        <p className="text-xl font-bold">${apiPrices.price_psa10.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-cv-muted">
                    {apiPrices.source === 'tcgfast' ? 'via TCGPlayer + eBay' : 'via PriceCharting'}
                    {' · '}Updated {hoursAgo(apiPrices.fetched_at)}
                    {apiPrices.cached && ' · cached'}
                  </p>
                </>
              ) : apiPricesError ? (
                <p className="text-xs text-cv-muted">
                  {(apiPricesError as any).httpStatus === 404
                    ? 'Price unavailable'
                    : (apiPricesError as any).httpStatus === 502
                      ? 'Price temporarily unavailable, try again soon'
                      : 'Price unavailable'}
                  {priceApiFailed ? ' — showing eBay comps as fallback' : ''}
                </p>
              ) : (
                <p className="text-xs text-cv-muted">Price unavailable</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* TCGPlayer */}
            <div className="rounded-[var(--radius-md)] bg-cv-surface p-3">
              <p className="text-xs text-cv-muted mb-1">TCGPlayer Market</p>
              {pricing === undefined ? (
                <p className="text-lg font-bold text-cv-muted">Loading...</p>
              ) : pricing?.tcgplayer?.market ? (
                <p className="text-lg font-bold">
                  ${(pricing.tcgplayer.market / 100).toFixed(2)}
                </p>
              ) : (
                <p className="text-sm text-cv-muted">
                  {cardId
                    ? 'No TCGPlayer data — Pokémon cards only'
                    : 'Confirm card identity first'}
                </p>
              )}
              {pricing?.tcgplayer?.low && (
                <p className="text-xs text-cv-muted">
                  Low ${(pricing.tcgplayer.low / 100).toFixed(2)}
                </p>
              )}
              {pricing?.tcgplayer_url && (
                <a
                  href={pricing.tcgplayer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-[var(--primary)] hover:underline"
                >
                  View on TCGPlayer →
                </a>
              )}
            </div>

            {/* PriceCharting */}
            <div className="rounded-[var(--radius-md)] bg-cv-surface p-3">
              <p className="text-xs text-cv-muted mb-1">PriceCharting</p>
              {pricing === undefined ? (
                <p className="text-lg font-bold text-cv-muted">Loading...</p>
              ) : pricing?.pricecharting?.loose_price_cents ? (
                <p className="text-lg font-bold">
                  ${(pricing.pricecharting.loose_price_cents / 100).toFixed(2)}
                </p>
              ) : (
                <p className="text-sm text-cv-muted">
                  {cardId ? 'No match found' : 'Confirm card identity first'}
                </p>
              )}
              {pricing?.pricecharting?.psa_10_price_cents && (
                <p className="text-xs text-cv-muted">
                  PSA 10: ${(pricing.pricecharting.psa_10_price_cents / 100).toFixed(2)}
                </p>
              )}
              {pricing?.pricecharting?.url && (
                <a
                  href={pricing.pricecharting.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-[var(--primary)] hover:underline"
                >
                  View on PriceCharting →
                </a>
              )}
            </div>

            {/* eBay Summary */}
            <div className="rounded-[var(--radius-md)] bg-cv-surface p-3">
              <p className="text-xs text-cv-muted mb-1">eBay Avg · 30d</p>
              <p className="text-lg font-bold">
                {comps?.summary?.average_price_cents
                  ? `$${(comps.summary.average_price_cents / 100).toFixed(2)}`
                  : '—'}
              </p>
              {comps?.summary?.count && (
                <p className="text-xs text-cv-muted">{comps.summary.count} recent sales</p>
              )}
            </div>
          </div>

          {/* Set info from PTCG */}
          {pricing?.ptcg_set_name && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="badge">{pricing.ptcg_series}</span>
              <span className="badge">{pricing.ptcg_set_name}</span>
              {pricing.ptcg_legalities?.standard === 'Legal' && (
                <span className="badge badge-success">Standard Legal</span>
              )}
              {pricing.ptcg_legalities?.expanded === 'Legal' && (
                <span className="badge badge-info">Expanded Legal</span>
              )}
            </div>
          )}
        </article>

        {/* ── eBay Market ── */}
        <article className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-2">
              <h2 className="text-lg font-semibold">eBay Market</h2>
              <div className="flex gap-1">
                <button
                  className={compsTab === 'sold' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                  onClick={() => setCompsTab('sold')}
                  type="button"
                >
                  Sold ({soldListings.length})
                </button>
                <button
                  className={
                    compsTab === 'active' ? 'btn-primary text-xs' : 'btn-secondary text-xs'
                  }
                  onClick={() => setCompsTab('active')}
                  type="button"
                >
                  Active ({activeListings.length})
                </button>
              </div>
            </div>
            <button
              className="btn-secondary text-xs"
              onClick={() => refreshComps.mutate()}
              type="button"
            >
              Refresh
            </button>
          </div>

          {comps ? (
            <div className="space-y-2">
              {comps.summary.count > 0 && (
                <div className="flex gap-4 text-xs text-cv-muted mb-3">
                  <span>Low ${((comps.summary.low_price_cents ?? 0) / 100).toFixed(2)}</span>
                  <span>Avg ${((comps.summary.average_price_cents ?? 0) / 100).toFixed(2)}</span>
                  <span>High ${((comps.summary.high_price_cents ?? 0) / 100).toFixed(2)}</span>
                  <span>{comps.summary.count} sold</span>
                  {comps.last_synced && (
                    <span>Synced {new Date(comps.last_synced).toLocaleDateString()}</span>
                  )}
                </div>
              )}

              {compsTab === 'sold' ? (
                <>
                  {/* Last Sold Price — this is the card's value */}
                  <div className="mb-4">
                    <p className="text-xs text-cv-muted uppercase tracking-wide mb-1">Last Sold</p>
                    <p className="text-2xl font-bold text-white">
                      {mostRecentSold
                        ? `$${(mostRecentSold.sold_price_cents / 100).toFixed(2)}`
                        : 'No sales data'
                      }
                    </p>
                    {mostRecentSold && (
                      <p className="text-xs text-cv-muted">
                        {new Date(mostRecentSold.sold_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {soldListings.filter(c => c.source === 'ebay_sold' || !c.source).length ? (
                  soldListings.filter(c => c.source === 'ebay_sold' || !c.source).map((sale, i) => {
                    const isAboveAvg = avgPrice != null && sale.sold_price_cents >= avgPrice
                    const isBelowAvg = avgPrice != null && sale.sold_price_cents < avgPrice
                    return (
                      <div
                        key={sale.id ?? i}
                        className="flex items-center justify-between rounded-[var(--radius-md)] border border-cv-border p-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="max-w-[320px] truncate font-medium">{sale.title}</p>
                          <p className="text-cv-muted">
                            {sale.condition_text && `${sale.condition_text} · `}
                            {sale.sold_date
                              ? new Date(sale.sold_date).toLocaleDateString()
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={
                              isAboveAvg
                                ? 'font-semibold text-green-400'
                                : isBelowAvg
                                  ? 'font-semibold text-red-400'
                                  : ''
                            }
                          >
                            ${(sale.sold_price_cents / 100).toFixed(2)}
                          </span>
                          {sale.listing_url && (
                            <a href={sale.listing_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4 text-cv-secondary" />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-cv-muted">No sold comps yet.</p>
                )}
                </>
              ) : activeListings.length ? (
                activeListings.map((listing, i) => (
                  <div
                    key={listing.id ?? i}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-cv-border p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="max-w-[320px] truncate font-medium">{listing.title}</p>
                      <p className="text-cv-muted">{listing.condition_text || 'No condition info'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span>${(listing.sold_price_cents / 100).toFixed(2)}</span>
                      {listing.listing_url && (
                        <a href={listing.listing_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 text-cv-secondary" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-cv-muted">No active listings found.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-cv-muted">No comps yet. Try refresh.</p>
          )}
        </article>

        {/* ── AI Grading ── */}
        <article className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI Grading</h2>
            <button
              className={grade ? 'btn-secondary' : 'btn-primary'}
              onClick={() => gradingMutation.mutate()}
              type="button"
            >
              {grade ? 'Re-analyze' : 'Get AI Grade Estimate'}
            </button>
          </div>
          {grade ? (
            <div className="space-y-3">
              {(() => {
                const CONFIDENCE_THRESHOLD = 70
                const confidence = grade.confidence_score
                const confidenceColor = confidence >= 90
                  ? 'var(--color-green-positive)'
                  : confidence >= 70
                  ? 'var(--color-orange)'
                  : 'var(--color-red-negative)'
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-cv-secondary/20 px-4 py-2 text-2xl font-bold text-cv-secondary">
                        {grade.estimated_grade_range}
                      </span>
                      <span className="text-sm font-medium" style={{ color: confidenceColor }}>
                        Confidence: {confidence}%
                      </span>
                    </div>
                    {confidence < CONFIDENCE_THRESHOLD && (
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-red-negative)]/40 bg-[var(--color-red-negative)]/10 p-3 text-xs" style={{ color: 'var(--color-red-negative)' }}>
                        <p className="font-semibold">Low confidence — estimate unreliable below {CONFIDENCE_THRESHOLD}%</p>
                        <p className="mt-1 text-cv-muted">Retake photo or submit for manual review</p>
                      </div>
                    )}
                  </>
                )
              })()}
              {(
                [
                  ['Centering', grade.centering_score],
                  ['Corners', grade.corners_score],
                  ['Edges', grade.edges_score],
                  ['Surface', grade.surface_score],
                ] as [string, number][]
              ).map(([name, score]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-cv-muted">{name}</span>
                    <span className="font-medium">
  {Number(score) > 10 ? `${Number(score)}/100` : `${Number(score)}/10`}
</span>
                  </div>
                  <div className="h-2 rounded-full bg-cv-bg2">
                    <div
                      className="h-2 rounded-full bg-cv-secondary"
                      style={{ width: `${Math.min(100, Number(score) > 10 ? Number(score) : (Number(score) / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {grade.explanation && (
                <p className="text-xs text-cv-muted">{grade.explanation}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-cv-muted">No grading estimate yet.</p>
          )}
        </article>

        <Link className="btn-ghost" to="/">
          ← Back to collection
        </Link>
      </section>
    </div>
  )
}
