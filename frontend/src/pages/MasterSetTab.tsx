import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

type ChecklistFilter = 'all' | 'owned' | 'missing'

export default function MasterSetTab() {
  const queryClient = useQueryClient()
  const [selectedSet, setSelectedSet] = useState('')
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>('all')

  // Always load all sets — no checkbox needed
  const { data: setsData, isLoading: setsLoading } = useQuery({
    queryKey: ['pokemon-sets-all'],
    queryFn: () => api.getPokemonSets(true),
    staleTime: 1000 * 60 * 60,
  })

  const { data: checklist, isLoading: checklistLoading } = useQuery({
    queryKey: ['checklist', selectedSet],
    queryFn: () => api.getSetChecklist(selectedSet),
    enabled: !!selectedSet,
    staleTime: 1000 * 60 * 30,
  })

  const { data: wishlist = [] } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api.listWishlist(),
  })

  const wishlistIds = useMemo(() => new Set(wishlist.map(w => w.ptcg_id)), [wishlist])

  const selectedSetInfo = useMemo(
    () => setsData?.sets.find(s => s.id === selectedSet),
    [setsData, selectedSet],
  )

  const addToWishlist = useMutation({
    mutationFn: (card: NonNullable<typeof checklist>['cards'][0]) => api.addWishlistItem({
      ptcg_id: card.id,
      name: card.name,
      set_name: selectedSetInfo?.name ?? null,
      set_series: selectedSetInfo?.series ?? null,
      card_number: card.number,
      rarity: card.rarity ?? null,
      image_url: card.image ?? null,
      tcgplayer_price_cents: card.tcgplayer_price ? Math.round(card.tcgplayer_price * 100) : null,
    }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const displayedCards = useMemo(() => {
    if (!checklist?.cards) return []
    if (checklistFilter === 'owned') return checklist.cards.filter(c => c.owned)
    if (checklistFilter === 'missing') return checklist.cards.filter(c => !c.owned)
    return checklist.cards
  }, [checklist, checklistFilter])

  return (
    <div className="space-y-4">
      {/* Game selector — Pokémon only for now */}
      <div className="flex gap-2 flex-wrap">
        <button className="px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--primary)] text-white" type="button">
          Pokémon
        </button>
        {['Magic', 'Yu-Gi-Oh', 'Lorcana', 'One Piece'].map(g => (
          <div key={g} className="relative">
            <button className="px-3 py-1.5 rounded-full text-sm font-medium text-cv-muted bg-cv-surface cursor-not-allowed opacity-50" disabled type="button">
              {g}
            </button>
            <span className="absolute -top-2 -right-1 rounded bg-cv-surfaceStrong px-1 text-[9px] text-cv-muted font-medium">Soon</span>
          </div>
        ))}
      </div>

      {/* Set selector */}
      <div className="glass p-4">
        <label className="block text-xs text-cv-muted mb-2">Select Pokémon Set</label>
        {setsLoading ? (
          <p className="text-sm text-cv-muted">Loading sets...</p>
        ) : (
          <select
            className="input"
            value={selectedSet}
            onChange={e => { setSelectedSet(e.target.value); setChecklistFilter('all') }}
          >
            <option value="">— Choose a set —</option>
            {(setsData?.sets ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.name} · {s.series} ({s.releaseDate?.slice(0, 4)})</option>
            ))}
          </select>
        )}
      </div>

      {selectedSet && checklist && (
        <>
          {/* Completion bar */}
          <div className="glass p-4">
            <div className="flex items-center gap-4 mb-3">
              {selectedSetInfo?.images?.symbol && (
                <img src={selectedSetInfo.images.symbol} alt="" className="h-8 w-8 object-contain" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold">{selectedSetInfo?.name}</h3>
                <p className="text-xs text-cv-muted">{selectedSetInfo?.series}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{checklist.completion_pct}%</p>
                <p className="text-xs text-cv-muted">{checklist.owned_count}/{checklist.total_count} owned</p>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-cv-surface">
              <div
                className="h-full rounded-full bg-cv-good transition-all"
                style={{ width: `${checklist.completion_pct}%` }}
              />
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2">
            {(['all', 'owned', 'missing'] as const).map(f => (
              <button key={f} type="button"
                className={f === checklistFilter ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                onClick={() => setChecklistFilter(f)}
              >
                {f === 'all' ? `All (${checklist.total_count})` :
                 f === 'owned' ? `Owned (${checklist.owned_count})` :
                 `Missing (${checklist.missing_count})`}
              </button>
            ))}
          </div>

          {/* Card grid */}
          {checklistLoading ? (
            <div className="glass p-8 text-center text-sm text-cv-muted">Loading...</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9">
              {displayedCards.map(card => (
                <div
                  key={card.id}
                  className={`glass overflow-hidden rounded-[var(--radius-md)] ${card.owned ? 'ring-1 ring-green-500/40' : 'opacity-60'}`}
                >
                  {card.image ? (
                    <img src={card.image} alt={card.name} className="w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="aspect-[2.5/3.5] bg-cv-surface flex items-center justify-center text-[9px] text-cv-muted p-1 text-center">
                      {card.name}
                    </div>
                  )}
                  <div className="p-1">
                    <p className="truncate text-[9px] font-semibold">{card.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-cv-muted">#{card.number}</span>
                      {card.owned ? (
                        <span className="text-[8px] text-green-400">✓</span>
                      ) : (
                        <button
                          type="button"
                          className={`text-[8px] transition ${wishlistIds.has(card.id) ? 'text-[var(--primary)]' : 'text-cv-muted hover:text-[var(--primary)]'}`}
                          onClick={() => !wishlistIds.has(card.id) && addToWishlist.mutate(card)}
                          disabled={wishlistIds.has(card.id) || addToWishlist.isPending}
                          title={wishlistIds.has(card.id) ? 'On wishlist' : 'Add to wishlist'}
                        >
                          {wishlistIds.has(card.id) ? '★' : '☆'}
                        </button>
                      )}
                    </div>
                    {card.tcgplayer_price != null && (
                      <p className="text-[8px] text-cv-muted">${card.tcgplayer_price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!selectedSet && !setsLoading && (
        <div className="glass p-12 text-center">
          <p className="text-cv-muted">Select a Pokémon set above to view your collection completion.</p>
        </div>
      )}
    </div>
  )
}
