import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { api } from '../lib/api'
import { queryKeys, useCollectionItem, useComps, useGrade, useCompsHistory } from '../lib/hooks'
import CardCrop from '../components/CardCrop'

// ── SVG Price Chart ───────────────────────────────────────────────────────────

const PriceChart = ({
  history,
  days,
}: {
  history: Array<{ date: string; avg_price_cents: number }>
  days: 30 | 60 | 90
}) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const filtered = history.filter((h) => new Date(h.date) >= cutoff)

  if (filtered.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-cv-muted text-sm">
        Not enough data for chart
      </div>
    )
  }

  const prices = filtered.map((h) => h.avg_price_cents)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const W = 600
  const H = 120
  const PAD = 10
  const points = filtered
    .map((h, i) => {
      const x = PAD + (i / (filtered.length - 1)) * (W - PAD * 2)
      const y = H - PAD - ((h.avg_price_cents - minP) / range) * (H - PAD * 2)
      return `${x},${y}`
    })
    .join(' ')

  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#grad)"
          stroke="none"
          points={`${PAD},${H} ${points} ${W - PAD},${H}`}
        />
        <polyline fill="none" stroke="var(--primary)" strokeWidth="2" points={points} />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-cv-muted">
        <span>Low ${(minP / 100).toFixed(2)}</span>
        <span>Avg ${(avg / 100).toFixed(2)}</span>
        <span>High ${(maxP / 100).toFixed(2)}</span>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CardDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: item, isLoading } = useCollectionItem(id)
  const cardId = item?.card_id ?? undefined
  const { data: comps } = useComps(cardId)
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
  })

  const image = useMemo(
    () => (showFront ? item?.front_image_url : item?.back_image_url) || item?.front_image_url,
    [item, showFront],
  )

  // Determine if we should use CardCrop (scanned sheet card with bbox)
  const hasBbox =
    item?.bbox_x != null &&
    item?.bbox_y != null &&
    item?.bbox_width != null &&
    item?.bbox_height != null

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

  return (
    <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
      {/* ── Card Image ── */}
      <section className="glass p-4">
        <div className="mb-3 flex gap-2">
          <button
            className={showFront ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setShowFront(true)}
            type="button"
          >
            Front
          </button>
          <button
            className={!showFront ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setShowFront(false)}
            type="button"
            disabled={!item.back_image_url}
          >
            Back
          </button>
        </div>
        {sheetImageUrl ? (
          hasBbox ? (
            <CardCrop
              sheetUrl={sheetImageUrl}
              bbox={{
                x: item.bbox_x!,
                y: item.bbox_y!,
                width: item.bbox_width!,
                height: item.bbox_height!,
              }}
              className="w-full rounded-[var(--radius-md)]"
            />
          ) : (
            <img
              className="w-full rounded-[var(--radius-md)]"
              src={sheetImageUrl}
              alt={item.card_name || item.player_name || 'Card'}
            />
          )
        ) : (
          <div className="h-[420px] rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--primary),var(--secondary))]" />
        )}
      </section>

      <section className="space-y-4">
        {/* ── Card Info ── */}
        <article className="glass p-4">
          <div className="flex items-start justify-between gap-4">
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
                <span className="badge">{item.sport ?? item.card?.sport ?? item.game ?? item.card?.game ?? 'Other'}</span>
                <span className="badge">{item.variation ?? item.card?.variation ?? 'Base'}</span>
                <span className="badge">{item.manufacturer ?? item.card?.manufacturer ?? 'Unknown'}</span>
                {item.condition_note && <span className="badge">{item.condition_note}</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-cv-muted mb-1">
                {(item as any).latest_sold_price_cents
                  ? 'Last eBay Sale'
                  : item.estimated_value_cents
                  ? 'My Cost / Est. Value'
                  : 'No Value Set'}
              </p>
              <p className="text-3xl font-bold">
                {((item as any).latest_sold_price_cents || item.estimated_value_cents)
                  ? `$${(((item as any).latest_sold_price_cents || item.estimated_value_cents || 0) / 100).toFixed(2)}`
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
            <div className="mt-4 space-y-2">
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
              <button className="btn-secondary" onClick={() => setEditing(true)} type="button">
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
          {historyData?.history?.length ? (
            <PriceChart history={historyData.history} days={chartDays} />
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-cv-muted text-sm">
              <p>No price history yet.</p>
              {cardId ? (
                <button
                  className="btn-secondary text-xs"
                  onClick={() => refreshComps.mutate()}
                  type="button"
                  disabled={refreshComps.isPending}
                >
                  {refreshComps.isPending ? 'Fetching...' : 'Fetch eBay Comps to Populate'}
                </button>
              ) : (
                <p className="text-xs">Confirm card identity first to enable market data.</p>
              )}
            </div>
          )}
        </article>

        {/* ── Market Prices ── */}
        <article className="glass p-4">
          <h2 className="mb-3 text-lg font-semibold">Market Prices</h2>
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
                soldListings.length ? (
                  soldListings.map((sale, i) => {
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
                )
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
