import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

type ChecklistFilter = 'all' | 'owned' | 'missing'

export default function MasterSetTab() {
  const [selectedSet, setSelectedSet] = useState('')
  const [showAllSets, setShowAllSets] = useState(false)
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>('all')

  const { data: setsData } = useQuery({
    queryKey: ['pokemon-sets', showAllSets],
    queryFn: () => api.getPokemonSets(showAllSets),
    staleTime: 1000 * 60 * 60,
  })

  const { data: checklist, isLoading: checklistLoading } = useQuery({
    queryKey: ['checklist', selectedSet],
    queryFn: () => api.getSetChecklist(selectedSet),
    enabled: !!selectedSet,
    staleTime: 1000 * 60 * 30,
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
        <button className="px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--primary)] text-white" type="button">
          Pokémon
        </button>
        {['Magic', 'Yu-Gi-Oh', 'Lorcana', 'One Piece'].map(g => (
          <div key={g} className="relative">
            <button className="px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium text-cv-muted bg-cv-surface cursor-not-allowed opacity-60" disabled type="button">
              {g}
            </button>
            <span className="absolute -top-2 -right-1 rounded bg-cv-surfaceStrong px-1 text-[9px] text-cv-muted font-medium">Soon</span>
          </div>
        ))}
      </div>

      {/* Set selector */}
      <div className="glass p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs text-cv-muted">Select Pokémon Set</label>
            <select
              className="input"
              value={selectedSet}
              onChange={e => { setSelectedSet(e.target.value); setChecklistFilter('all') }}
            >
              <option value="">— Choose a set —</option>
              {(setsData?.sets ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.series})</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={showAllSets}
              onChange={e => setShowAllSets(e.target.checked)}
              className="rounded"
            />
            Show all sets
          </label>
        </div>
      </div>

      {selectedSet && (
        <>
          {checklist && (
            <div className="glass p-4">
              <div className="flex items-center gap-4 mb-3">
                {setsData?.sets.find(s => s.id === selectedSet)?.images?.symbol && (
                  <img
                    src={setsData.sets.find(s => s.id === selectedSet)!.images.symbol}
                    alt="set symbol"
                    className="h-8 w-8 object-contain"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{setsData?.sets.find(s => s.id === selectedSet)?.name}</h3>
                  <p className="text-xs text-cv-muted">{setsData?.sets.find(s => s.id === selectedSet)?.series}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{checklist.completion_pct}%</p>
                  <p className="text-xs text-cv-muted">{checklist.owned_count}/{checklist.total_count} cards</p>
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-cv-surface">
                <div
                  className="h-full rounded-full bg-cv-good transition-all"
                  style={{ width: `${checklist.completion_pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {(['all', 'owned', 'missing'] as ChecklistFilter[]).map(f => (
              <button
                key={f}
                className={f === checklistFilter ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                onClick={() => setChecklistFilter(f)}
                type="button"
              >
                {f === 'all' ? `All (${checklist?.total_count ?? 0})` :
                 f === 'owned' ? `Owned (${checklist?.owned_count ?? 0})` :
                 `Missing (${checklist?.missing_count ?? 0})`}
              </button>
            ))}
          </div>

          {checklistLoading ? (
            <div className="glass p-8 text-center text-sm text-cv-muted">Loading checklist...</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {displayedCards.map(card => (
                <div
                  key={card.id}
                  className={`glass overflow-hidden rounded-[var(--radius-md)] ${card.owned ? 'ring-1 ring-green-500/50' : 'opacity-60'}`}
                >
                  {card.image ? (
                    <img src={card.image} alt={card.name} className="w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="aspect-[2.5/3.5] w-full bg-cv-surface flex items-center justify-center text-cv-muted text-xs">
                      {card.name}
                    </div>
                  )}
                  <div className="p-1.5">
                    <p className="truncate text-[10px] font-semibold">{card.name}</p>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[9px] text-cv-muted">#{card.number}</span>
                      {card.owned ? (
                        <span className="rounded bg-green-500/20 px-1 py-0.5 text-[9px] text-green-300 font-medium">✓ Own</span>
                      ) : (
                        <span className="rounded bg-cv-surface px-1 py-0.5 text-[9px] text-cv-muted">Missing</span>
                      )}
                    </div>
                    {card.rarity && <p className="text-[9px] text-cv-muted mt-0.5 truncate">{card.rarity}</p>}
                    {card.tcgplayer_price != null && (
                      <p className="text-[9px] text-cv-muted">${card.tcgplayer_price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!selectedSet && (
        <div className="glass p-12 text-center">
          <p className="text-cv-muted">Select a Pokémon set above to track your completion.</p>
        </div>
      )}
    </div>
  )
}
