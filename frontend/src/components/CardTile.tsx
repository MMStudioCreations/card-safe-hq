import { useMemo } from 'react'
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
  const card = collectionItem.card
  const player = card?.player_name || card?.card_name || 'Unknown Card'
  const sport = (card?.sport || card?.game || 'Other').toLowerCase()
  const confidence = collectionItem.confidence ?? collectionItem.suggestions?.confidence ?? 0
  const confidenceClass = confidence > 80 ? 'text-cv-good' : confidence >= 60 ? 'text-cv-warn' : 'text-cv-danger'

  const initials = useMemo(() => player.split(' ').map((part) => part[0]).join('').slice(0, 2), [player])

  const imageUrl = collectionItem.front_image_url
    ? `${import.meta.env.VITE_API_URL}/api/images/${encodeURIComponent(collectionItem.front_image_url)}`
    : null;

  return (
    <button className="glass text-left p-3" onClick={() => navigate(`/card/${collectionItem.id}`)} type="button">
      {imageUrl ? (
        <img
          className="h-36 w-full rounded-[var(--radius-md)] object-cover"
          src={imageUrl}
          alt={player}
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-3xl font-bold">
          {initials || 'CV'}
        </div>
      )}
      <div className="mt-3 space-y-2">
        <h3 className="line-clamp-2 text-sm font-bold">{player}</h3>
        <p className="text-xs text-cv-muted">
          {[card?.year, card?.set_name].filter(Boolean).join(' · ') || 'Unknown set'}
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className={`badge border-0 ${sportMap[sport] ?? 'bg-violet-500/20 text-violet-100'}`}>
            {card?.sport || card?.game || 'Other'}
          </span>
          <span className="badge">
            ${(((collectionItem.estimated_value_cents ?? 0) / 100) || 0).toFixed(2)}
          </span>
          <span className="badge">{collectionItem.condition_note || 'Raw'}</span>
          <span className={`badge ${confidenceClass}`}>AI {confidence}%</span>
        </div>
      </div>
    </button>
  )
}
