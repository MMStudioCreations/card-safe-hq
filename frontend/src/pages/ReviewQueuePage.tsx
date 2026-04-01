import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import CardCrop from '../components/CardCrop'
import PriceRangeBar from '../components/PriceRangeBar'
import { api, type CollectionItem, type VisionConfirmPayload } from '../lib/api'
import { queryKeys, useCollection } from '../lib/hooks'

const sports = ['Baseball', 'Basketball', 'Football', 'Soccer', 'Hockey', 'Pokemon', 'Magic', 'Other']

function getDefaults(item: CollectionItem): VisionConfirmPayload {
  return {
    player_name: item.card?.player_name || item.card?.card_name || '',
    year: item.card?.year || null,
    set_name: item.card?.set_name || '',
    card_number: item.card?.card_number || '',
    sport: item.card?.sport || item.card?.game || 'Other',
    variation: item.card?.variation || '',
    manufacturer: item.card?.manufacturer || '',
    condition_notes: item.condition_note || '',
    confidence: item.confidence ?? item.suggestions?.confidence ?? 70,
  }
}

export default function ReviewQueuePage() {
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const { data = [], isLoading } = useCollection(false)
  const pending = useMemo(() => data.filter((item) => !item.confirmed_at), [data])
  const [edited, setEdited] = useState<Record<number, VisionConfirmPayload>>({})
  const [toast, setToast] = useState(params.get('added') === '1' ? 'Card added to review queue' : '')

  async function confirm(item: CollectionItem, soft = false) {
    const payload = edited[item.id] || getDefaults(item)
    await api.confirmVision(item.id, payload)
    if (!soft) setToast('Card confirmed successfully')
    await queryClient.invalidateQueries({ queryKey: queryKeys.collection(false) })
    await queryClient.invalidateQueries({ queryKey: queryKeys.collection(true) })
  }

  async function discard(id: number) {
    if (!window.confirm('Discard this card from your queue?')) return
    await api.deleteCollectionItem(id)
    await queryClient.invalidateQueries({ queryKey: queryKeys.collection(false) })
  }

  if (isLoading) return <div className="glass p-6">Loading review queue...</div>

  return (
    <div className="space-y-4">
      {toast && <div className="glass border-cv-good p-3 text-sm text-cv-good">{toast}</div>}
      {pending.length === 0 ? (
        <section className="glass p-8 text-center">
          <p className="text-lg font-semibold">All caught up! No cards pending review.</p>
          <Link className="btn-primary mt-4" to="/upload">Upload another card</Link>
        </section>
      ) : (
        pending.map((item) => {
          const current = edited[item.id] || getDefaults(item)
          const confidenceClass = current.confidence > 80 ? 'text-cv-good' : current.confidence >= 60 ? 'text-cv-warn' : 'text-cv-danger'

          return (
            <article key={item.id} className="glass grid gap-4 p-4 md:grid-cols-[220px,1fr]">
              <div>
                {(() => {
                  const apiBase = import.meta.env.VITE_API_URL ?? ''
                  const imageUrl = item.front_image_url
                    ? `${apiBase}/api/images/${encodeURIComponent(item.front_image_url)}`
                    : null
                  const hasBbox = item.bbox_x != null && item.bbox_y != null
                  const bbox = hasBbox
                    ? { x: item.bbox_x!, y: item.bbox_y!, width: item.bbox_width!, height: item.bbox_height! }
                    : null
                  if (imageUrl && bbox) {
                    return (
                      <div className="h-80 w-full overflow-hidden rounded-[var(--radius-md)]">
                        <CardCrop sheetUrl={imageUrl} bbox={bbox} className="h-full w-full object-cover" />
                      </div>
                    )
                  }
                  if (imageUrl) {
                    return <img className="h-80 w-full rounded-[var(--radius-md)] object-cover" src={imageUrl} alt={current.player_name} />
                  }
                  return <div className="h-80 rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--primary),var(--secondary))]" />
                })()}
              </div>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="input" value={current.player_name} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, player_name: e.target.value } }))} placeholder="Player/Card Name" />
                  <input className="input" type="number" value={current.year ?? ''} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, year: e.target.value ? Number(e.target.value) : null } }))} placeholder="Year" />
                  <input className="input" value={current.set_name} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, set_name: e.target.value } }))} placeholder="Set Name" />
                  <input className="input" value={current.card_number} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, card_number: e.target.value } }))} placeholder="Card Number" />
                  <select className="input" value={current.sport} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, sport: e.target.value } }))}>{sports.map((s) => <option key={s}>{s}</option>)}</select>
                  <input className="input" value={current.variation} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, variation: e.target.value } }))} placeholder="Variation" />
                  <input className="input" value={current.manufacturer} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, manufacturer: e.target.value } }))} placeholder="Manufacturer" />
                  <input className="input" value={current.condition_notes} onChange={(e) => setEdited((old) => ({ ...old, [item.id]: { ...current, condition_notes: e.target.value } }))} placeholder="Condition notes" />
                </div>
                <span className={`badge text-sm ${confidenceClass}`}>AI Confidence: {current.confidence}%</span>
                <PriceRangeBar low={0} avg={item.estimated_value_cents || 0} high={Math.max(item.estimated_value_cents || 0, 1)} count={0} lastSynced={item.updated_at} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary border-cv-good text-cv-good" onClick={() => void confirm(item, true)} type="button">Confirm & Save</button>
                  <button className="btn-primary" onClick={() => void confirm(item)} type="button">Edit & Confirm</button>
                  <button className="btn-ghost border-cv-danger/60 text-cv-danger" onClick={() => void discard(item.id)} type="button">Discard</button>
                </div>
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
