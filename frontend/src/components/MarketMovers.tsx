import { TrendingUp, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Mover {
  card_name: string
  set_name: string
  rarity: string
  image_url: string | null
  current_price_cents: number
  previous_price_cents: number
}

interface Props {
  valuesHidden?: boolean
}

export default function MarketMovers({ valuesHidden = false }: Props) {
  const [movers, setMovers] = useState<Mover[]>([])
  const [loading, setLoading] = useState(true)
  const apiBase = import.meta.env.VITE_API_URL ?? ''

  useEffect(() => {
    fetch(`${apiBase}/api/collection/movers`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: any) => setMovers(d.movers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (movers.length === 0) return null

  return (
    <section className="glass p-4">
      <h2 className="text-sm font-semibold text-cv-muted mb-3">Market Movers</h2>
      <div className="space-y-2">
        {movers.map((m, i) => {
          const delta = m.current_price_cents - m.previous_price_cents
          const pct = ((delta / m.previous_price_cents) * 100).toFixed(1)
          const up = delta >= 0

          return (
            <div key={i} className="flex items-center gap-3 p-3 bg-cv-surface border border-cv-border rounded-xl">
              {m.image_url ? (
                <img src={m.image_url} alt={m.card_name}
                     className="w-10 h-14 object-contain rounded" />
              ) : (
                <div className="w-10 h-14 bg-cv-bg rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{m.card_name}</p>
                <p className="text-xs text-cv-muted truncate">{m.set_name}</p>
              </div>
              <div className={`text-right ${up ? 'text-green-400' : 'text-red-400'}`}>
                <div className="flex items-center gap-1 justify-end">
                  {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span className="text-sm font-bold">
                    {up ? '+' : ''}{pct}%
                  </span>
                </div>
                <p className="text-xs">
                  {valuesHidden ? '••••' : `$${(m.current_price_cents / 100).toFixed(2)}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
