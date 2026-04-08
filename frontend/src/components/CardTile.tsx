import { useNavigate } from 'react-router-dom'
import type { CollectionItem } from '../lib/api'

type Props = { collectionItem: CollectionItem }

const sportMap: Record<string, string> = {
  baseball: 'bg-blue-500/20 text-blue-100',
  basketball: 'bg-orange-500/20 text-orange-100',
  football: 'bg-green-500/20 text-green-100',
  pokemon: 'bg-yellow-500/20 text-yellow-100',
}

export default function CardTile({ collectionItem }: Props) {
  const navigate = useNavigate()

  const displayName = collectionItem.card_name
    || collectionItem.player_name
    || collectionItem.card?.card_name
    || 'Unknown Card'

  const displaySet = collectionItem.set_name
    || collectionItem.card?.set_name
    || null

  const displayYear = collectionItem.year ?? collectionItem.card?.year ?? null

  const displaySport = (
    collectionItem.sport
    || collectionItem.game
    || collectionItem.card?.sport
    || collectionItem.card?.game
    || 'Other'
  ).toLowerCase()

  // front_image_url is an R2 key pointing to the pre-cropped card image.
  // Always proxy through /api/images/ — no CardCrop needed in the collection view.
  const imageUrl = collectionItem.front_image_url
    ? `${import.meta.env.VITE_API_URL}/api/images/${encodeURIComponent(collectionItem.front_image_url)}`
    : '/placeholder-card.png'

  return (
    <button className="glass text-left p-3" onClick={() => navigate(`/card/${collectionItem.id}`)} type="button">
      <div className="w-full rounded-[var(--radius-md)] overflow-hidden bg-zinc-900" style={{ aspectRatio: '2.5/3.5' }}>
        <img
          src={imageUrl}
          alt={displayName}
          className="w-full h-full object-contain object-center"
        />
      </div>
      <div className="mt-3 space-y-2">
        <h3 className="line-clamp-2 text-sm font-bold">{displayName}</h3>
        <p className="text-xs text-cv-muted">
          {[displayYear, displaySet].filter(Boolean).join(' · ') || 'Unknown set'}
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className={`badge border-0 ${sportMap[displaySport] ?? 'bg-violet-500/20 text-violet-100'}`}>
            {collectionItem.sport || collectionItem.game || collectionItem.card?.sport || collectionItem.card?.game || 'Other'}
          </span>
          <span className="badge">
            ${((((collectionItem as any).latest_sold_price_cents ?? collectionItem.estimated_value_cents ?? 0) / 100) || 0).toFixed(2)}
          </span>
          <span className="badge">{collectionItem.condition_note || 'Raw'}</span>
          {collectionItem.product_type && collectionItem.product_type !== 'single_card' && (
            <span className="badge bg-amber-500/20 text-amber-200">
              {{
                booster_pack: 'Pack',
                booster_box: 'Box',
                etb: 'ETB',
                tin: 'Tin',
                bundle: 'Bundle',
                promo_pack: 'Promo',
                other_sealed: 'Sealed',
              }[collectionItem.product_type] ?? 'Sealed'}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
