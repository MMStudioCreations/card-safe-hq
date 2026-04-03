import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export default function WishlistTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedSet, setSelectedSet] = useState('')
  const [showAllSets, setShowAllSets] = useState(false)

  const { data: wishlist = [], isLoading: wishlistLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api.listWishlist(),
  })

  const { data: setsData } = useQuery({
    queryKey: ['pokemon-sets', showAllSets],
    queryFn: () => api.getPokemonSets(showAllSets),
    staleTime: 1000 * 60 * 60,
  })

  const { data: checklist, isLoading: searchLoading } = useQuery({
    queryKey: ['checklist', selectedSet],
    queryFn: () => api.getSetChecklist(selectedSet),
    enabled: !!selectedSet,
    staleTime: 1000 * 60 * 30,
  })

  const addMutation = useMutation({
    mutationFn: (card: Parameters<typeof api.addWishlistItem>[0]) => api.addWishlistItem(card),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (ptcgId: string) => api.removeWishlistItem(ptcgId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const wishlistIds = useMemo(() => new Set(wishlist.map(w => w.ptcg_id)), [wishlist])

  const searchResults = useMemo(() => {
    if (!checklist?.cards || !search.trim()) return []
    const q = search.toLowerCase()
    return checklist.cards
      .filter(c => c.name.toLowerCase().includes(q) || c.number.includes(q))
      .slice(0, 20)
  }, [checklist, search])

  function addToWishlist(card: NonNullable<typeof checklist>['cards'][0]) {
    if (wishlistIds.has(card.id)) return
    const setInfo = setsData?.sets.find(s => s.id === selectedSet)
    addMutation.mutate({
      ptcg_id: card.id,
      name: card.name,
      set_name: setInfo?.name ?? null,
      set_series: setInfo?.series ?? null,
      card_number: card.number,
      rarity: card.rarity ?? null,
      image_url: card.image ?? null,
      tcgplayer_price_cents: card.tcgplayer_price ? Math.round(card.tcgplayer_price * 100) : null,
      tcgplayer_url: null,
    })
  }

  const totalWishlistValue = wishlist.reduce((sum, w) => sum + (w.tcgplayer_price_cents ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Game selector */}
      <div className="flex gap-2 flex-wrap">
        <button className="px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--primary)] text-white" type="button">Pokémon</button>
        {['Sports Cards', 'Magic', 'Yu-Gi-Oh'].map(g => (
          <div key={g} className="relative">
            <button className="px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium text-cv-muted bg-cv-surface cursor-not-allowed opacity-60" disabled type="button">{g}</button>
            <span className="absolute -top-2 -right-1 rounded bg-cv-surfaceStrong px-1 text-[9px] text-cv-muted font-medium">Soon</span>
          </div>
        ))}
      </div>

      {/* Search section */}
      <div className="glass p-4 space-y-3">
        <h3 className="font-semibold text-sm">Search Cards to Add</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[180px]">
            <select className="input" value={selectedSet} onChange={e => { setSelectedSet(e.target.value); setSearch('') }}>
              <option value="">— Select a set to search —</option>
              {(setsData?.sets ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showAllSets} onChange={e => setShowAllSets(e.target.checked)} className="rounded" />
            All sets
          </label>
        </div>
        {selectedSet && (
          <input className="input" placeholder="Search card name or number..." value={search} onChange={e => setSearch(e.target.value)} />
        )}
        {search.trim() && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 max-h-72 overflow-y-auto pr-1">
            {searchLoading ? (
              <p className="col-span-full text-sm text-cv-muted py-4 text-center">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="col-span-full text-sm text-cv-muted py-4 text-center">No cards found</p>
            ) : searchResults.map(card => {
              const inWishlist = wishlistIds.has(card.id)
              const inCollection = card.owned
              return (
                <button
                  key={card.id}
                  className={`glass text-left p-2 rounded-[var(--radius-md)] transition ${inWishlist ? 'ring-1 ring-[var(--primary)]' : ''} ${inCollection ? 'opacity-50' : ''}`}
                  onClick={() => !inWishlist && !inCollection && addToWishlist(card)}
                  disabled={inWishlist || inCollection || addMutation.isPending}
                  type="button"
                >
                  {card.image ? <img src={card.image} alt={card.name} className="w-full rounded-sm mb-1.5" loading="lazy" /> : <div className="aspect-[2.5/3.5] w-full bg-cv-surface rounded-sm mb-1.5 flex items-center justify-center text-[10px] text-cv-muted">{card.name}</div>}
                  <p className="text-[10px] font-semibold truncate">{card.name}</p>
                  <p className="text-[9px] text-cv-muted">#{card.number}</p>
                  {card.tcgplayer_price && <p className="text-[9px] text-cv-muted">${card.tcgplayer_price.toFixed(2)}</p>}
                  {inCollection && <span className="text-[9px] text-green-400">✓ Owned</span>}
                  {inWishlist && <span className="text-[9px] text-[var(--primary)]">★ Wanted</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Wishlist display */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">My Wishlist ({wishlist.length} cards)</h3>
          {wishlist.length > 0 && <p className="text-xs text-cv-muted">Est. total: <strong className="text-cv-text">${(totalWishlistValue / 100).toFixed(2)}</strong></p>}
        </div>
        {wishlistLoading ? (
          <p className="text-sm text-cv-muted">Loading wishlist...</p>
        ) : wishlist.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-cv-muted">No cards on your wishlist yet.</p>
            <p className="text-xs text-cv-muted mt-1">Search above to add cards you're looking for.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {wishlist.map(card => (
              <div key={card.ptcg_id} className="glass overflow-hidden rounded-[var(--radius-md)] group relative">
                {card.image_url ? <img src={card.image_url} alt={card.name} className="w-full object-cover" loading="lazy" /> : <div className="aspect-[2.5/3.5] w-full bg-cv-surface flex items-center justify-center text-[10px] text-cv-muted">{card.name}</div>}
                <button
                  className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white text-[10px]"
                  onClick={() => removeMutation.mutate(card.ptcg_id)}
                  type="button"
                >✕</button>
                <div className="p-1.5">
                  <p className="truncate text-[10px] font-semibold">{card.name}</p>
                  <p className="text-[9px] text-cv-muted">{card.set_name}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-cv-muted">#{card.card_number}</span>
                    {card.tcgplayer_price_cents != null && <span className="text-[9px] text-cv-muted">${(card.tcgplayer_price_cents / 100).toFixed(2)}</span>}
                  </div>
                  <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.name + ' ' + (card.set_name ?? '') + ' pokemon card')}`} target="_blank" rel="noreferrer" className="mt-1 block text-[9px] text-[var(--primary)] hover:underline" onClick={e => e.stopPropagation()}>Find on eBay →</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
