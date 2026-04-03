import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Layers, Minus, Plus, RefreshCw, Trash2, CheckCircle, XCircle } from 'lucide-react'
import CardCrop from '../components/CardCrop'
import { api, type CollectionItem } from '../lib/api'
import { useCollection } from '../lib/hooks'

// ── Types ─────────────────────────────────────────────────────────────────────

type SelectedGame = 'pokemon' | 'magic' | 'yugioh' | 'lorcana' | 'onepiece'

interface MetaDeck {
  name: string
  archetype: string
  format: string
  theme: string
  description: string
  key_cards: string[]
  strategy: string
}

interface DeckAnalysis {
  have: CollectionItem[]
  need: string[]
  completion_pct: number
  have_count: number
  need_count: number
  total_key_cards: number
}

interface CustomDeckEntry {
  collectionItemId: number
  cardName: string
  copies: number
  item: CollectionItem
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GAMES: Array<{ id: SelectedGame; label: string; deckSize: number; maxCopies: number }> = [
  { id: 'pokemon', label: 'Pokémon', deckSize: 60, maxCopies: 4 },
  { id: 'magic', label: 'Magic', deckSize: 60, maxCopies: 4 },
  { id: 'yugioh', label: 'Yu-Gi-Oh', deckSize: 40, maxCopies: 3 },
  { id: 'lorcana', label: 'Lorcana', deckSize: 60, maxCopies: 4 },
  { id: 'onepiece', label: 'One Piece', deckSize: 50, maxCopies: 4 },
]

const FORMATS: Record<SelectedGame, string[]> = {
  pokemon: ['Standard', 'Expanded', 'Unlimited', 'Theme'],
  magic: ['Standard', 'Modern', 'Legacy', 'Vintage', 'Commander', 'Pioneer'],
  yugioh: ['Advanced', 'Traditional', 'Speed Duel'],
  lorcana: ['Standard', 'Casual'],
  onepiece: ['Standard', 'Casual'],
}

const STRATEGY_COLORS: Record<string, string> = {
  aggro: 'bg-red-500/20 text-red-300',
  control: 'bg-blue-500/20 text-blue-300',
  combo: 'bg-purple-500/20 text-purple-300',
  midrange: 'bg-green-500/20 text-green-300',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardImageUrl(item: CollectionItem): string | null {
  if (!item.front_image_url) return null
  const base = import.meta.env.VITE_API_URL ?? ''
  return `${base}/api/images/${encodeURIComponent(item.front_image_url)}`
}

function hasBbox(item: CollectionItem): boolean {
  return item.bbox_x != null && item.bbox_y != null && item.bbox_width != null && item.bbox_height != null
}

function itemBbox(item: CollectionItem) {
  return { x: item.bbox_x!, y: item.bbox_y!, width: item.bbox_width!, height: item.bbox_height! }
}

function cardName(item: CollectionItem): string {
  return item.player_name || item.card_name || item.card?.player_name || item.card?.card_name || 'Unknown'
}

// ── Mini card image ───────────────────────────────────────────────────────────

function MiniCard({ item, className = '' }: { item: CollectionItem; className?: string }) {
  const url = cardImageUrl(item)
  const name = cardName(item)
  if (url && hasBbox(item)) {
    return <CardCrop sheetUrl={url} bbox={itemBbox(item)} className={className} />
  }
  if (url) {
    return <img src={url} alt={name} className={className} />
  }
  return (
    <div className={`flex items-center justify-center bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-xs font-bold ${className}`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DeckBuilderPage() {
  const { data: allItems = [], isLoading: collectionLoading } = useCollection(true)

  // Game state
  const [selectedGame, setSelectedGame] = useState<SelectedGame>('pokemon')
  const [selectedFormat, setSelectedFormat] = useState('Standard')

  // Meta deck state
  const [selectedMetaDeck, setSelectedMetaDeck] = useState<MetaDeck | null>(null)
  const [deckAnalysis, setDeckAnalysis] = useState<DeckAnalysis | null>(null)
  const [analyzingDeck, setAnalyzingDeck] = useState(false)

  // Custom deck state
  const [customDeck, setCustomDeck] = useState<CustomDeckEntry[]>([])
  const [deckName, setDeckName] = useState('My Deck')
  const [deckSearch, setDeckSearch] = useState('')
  const [deckMessage, setDeckMessage] = useState('')
  const [generating, setGenerating] = useState(false)

  // Queries
  const { data: metaData } = useQuery({
    queryKey: ['meta', selectedGame],
    queryFn: () => api.getMetaDecks(selectedGame),
    staleTime: 1000 * 60 * 60,
  })

  const game = GAMES.find(g => g.id === selectedGame)!

  // Filter collection by game
  const gameItems = useMemo(() => {
    return allItems.filter(item => {
      const g = (item.game || item.sport || item.card?.game || item.card?.sport || '').toLowerCase()
      return g.includes(selectedGame)
    })
  }, [allItems, selectedGame])

  const filteredPool = useMemo(() => {
    if (!deckSearch) return gameItems
    const q = deckSearch.toLowerCase()
    return gameItems.filter(item => cardName(item).toLowerCase().includes(q))
  }, [gameItems, deckSearch])

  const metaDecks = metaData?.decks ?? []

  // Custom deck helpers
  const totalCards = useMemo(() => customDeck.reduce((s, e) => s + e.copies, 0), [customDeck])
  const deckValue = useMemo(
    () => customDeck.reduce((s, e) => s + (e.item.latest_sold_price_cents ?? e.item.estimated_value_cents ?? 0) * e.copies, 0),
    [customDeck],
  )
  const progressPct = Math.min(100, (totalCards / game.deckSize) * 100)
  const progressColor = progressPct === 100 ? 'bg-cv-good' : progressPct > 60 ? 'bg-[var(--primary)]' : 'bg-cv-warn'

  function getCopiesInDeck(itemId: number) {
    return customDeck.find(e => e.collectionItemId === itemId)?.copies ?? 0
  }

  function addCard(item: CollectionItem) {
    const name = cardName(item)
    setCustomDeck(prev => {
      const existing = prev.find(e => e.collectionItemId === item.id)
      if (existing) {
        if (existing.copies >= game.maxCopies) return prev
        return prev.map(e => e.collectionItemId === item.id ? { ...e, copies: e.copies + 1 } : e)
      }
      return [...prev, { collectionItemId: item.id, cardName: name, copies: 1, item }]
    })
  }

  function removeCard(itemId: number) {
    setCustomDeck(prev => {
      const existing = prev.find(e => e.collectionItemId === itemId)
      if (!existing) return prev
      if (existing.copies <= 1) return prev.filter(e => e.collectionItemId !== itemId)
      return prev.map(e => e.collectionItemId === itemId ? { ...e, copies: e.copies - 1 } : e)
    })
  }

  function clearDeck() {
    setCustomDeck([])
    setDeckMessage('')
  }

  function exportList() {
    const lines = customDeck.map(e => `${e.copies}x ${e.cardName}`).join('\n')
    void navigator.clipboard.writeText(lines)
    setDeckMessage('Copied to clipboard!')
  }

  async function handleSaveDeck() {
    if (!customDeck.length) return
    try {
      await api.saveDeck({
        name: deckName,
        game: selectedGame,
        format: selectedFormat,
        cards_json: JSON.stringify(customDeck.map(e => ({ id: e.collectionItemId, name: e.cardName, copies: e.copies }))),
      })
      setDeckMessage('Deck saved!')
    } catch {
      setDeckMessage('Save failed.')
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setDeckMessage('')
    try {
      const result = await api.generateDeck({ game: selectedGame, format: selectedFormat })
      const newEntries: CustomDeckEntry[] = []
      for (const d of result.deck) {
        const item = allItems.find(i => i.id === d.collection_item_id)
        if (item) newEntries.push({ collectionItemId: d.collection_item_id, cardName: d.card_name, copies: d.copies, item })
      }
      setCustomDeck(newEntries)
      setDeckMessage(result.message)
    } catch (err) {
      setDeckMessage(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function buildFromCollection(deck: MetaDeck) {
    setAnalyzingDeck(true)
    setSelectedMetaDeck(deck)
    setDeckAnalysis(null)
    try {
      const result = await api.analyzeDeck({
        key_cards: deck.key_cards,
        game: selectedGame,
        deck_size: game.deckSize,
      })
      setDeckAnalysis(result)
    } catch (err) {
      console.error('analyzeDeck failed:', err)
    } finally {
      setAnalyzingDeck(false)
    }
  }

  function onGameChange(id: SelectedGame) {
    setSelectedGame(id)
    setSelectedFormat(FORMATS[id][0])
    setSelectedMetaDeck(null)
    setDeckAnalysis(null)
    clearDeck()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-enter space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-[var(--primary)]" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Deck Builder</h2>
          <p className="text-sm text-cv-muted">Build decks from your collection</p>
        </div>
      </div>

      {/* Game selector + format */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-[var(--radius-md)] bg-cv-surface p-1">
          {GAMES.map(g => (
            <button
              key={g.id}
              className={`px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition ${selectedGame === g.id ? 'bg-[var(--primary)] text-white' : 'text-cv-muted hover:text-cv-text'}`}
              onClick={() => onGameChange(g.id)}
              type="button"
            >
              {g.label}
            </button>
          ))}
        </div>
        <select
          className="input w-auto text-sm"
          value={selectedFormat}
          onChange={e => setSelectedFormat(e.target.value)}
        >
          {FORMATS[selectedGame].map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      {/* ── DECK BUILDER ── */}
      <div className="grid gap-4 lg:grid-cols-[30%_40%_30%]">

          {/* LEFT — Meta Deck Browser */}
          <div className="space-y-3">
            <div className="glass p-4">
              <h3 className="mb-3 font-semibold">Meta Decks</h3>
              {metaDecks.length === 0 ? (
                <p className="text-sm text-cv-muted">No meta decks for this game.</p>
              ) : (
                <div className="space-y-3">
                  {metaDecks.map(deck => (
                    <div
                      key={deck.name}
                      className={`rounded-[var(--radius-md)] border p-3 cursor-pointer transition ${selectedMetaDeck?.name === deck.name ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-cv-border bg-cv-surface hover:border-cv-border/60'}`}
                      onClick={() => setSelectedMetaDeck(deck)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm">{deck.name}</p>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STRATEGY_COLORS[deck.strategy] ?? 'bg-gray-500/20 text-gray-300'}`}>
                          {deck.theme}
                        </span>
                      </div>
                      <p className="text-xs text-cv-muted mb-2">{deck.description}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {deck.key_cards.map(kc => (
                          <span key={kc} className="rounded bg-cv-bg2 px-1.5 py-0.5 text-[10px] text-cv-muted">{kc}</span>
                        ))}
                      </div>
                      <button
                        className="btn-primary w-full text-xs py-1"
                        onClick={e => { e.stopPropagation(); void buildFromCollection(deck) }}
                        disabled={analyzingDeck}
                        type="button"
                      >
                        {analyzingDeck && selectedMetaDeck?.name === deck.name ? (
                          <span className="flex items-center justify-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Analyzing...</span>
                        ) : 'Build from my collection'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Have/Need Analysis */}
            {deckAnalysis && selectedMetaDeck && (
              <div className="glass p-4">
                <h3 className="mb-2 font-semibold text-sm">{selectedMetaDeck.name} — Collection Analysis</h3>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-cv-muted">You have {deckAnalysis.have_count}/{deckAnalysis.total_key_cards} key cards</span>
                    <span className="font-semibold">{deckAnalysis.completion_pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cv-surface">
                    <div
                      className="h-full rounded-full bg-cv-good transition-all"
                      style={{ width: `${deckAnalysis.completion_pct}%` }}
                    />
                  </div>
                </div>

                {deckAnalysis.have.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-green-400 mb-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Have ({deckAnalysis.have_count})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {deckAnalysis.have.map(item => (
                        <div key={item.id} className="h-12 w-9 overflow-hidden rounded" title={cardName(item)}>
                          <MiniCard item={item} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {deckAnalysis.need.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Need ({deckAnalysis.need_count})
                    </p>
                    <div className="space-y-1">
                      {deckAnalysis.need.map(name => (
                        <div key={name} className="flex items-center justify-between text-xs">
                          <span className="text-cv-muted">{name}</span>
                          <a
                            href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name + ' pokemon card')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--primary)] hover:underline shrink-0"
                          >
                            eBay →
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CENTER — Collection Card Pool */}
          <div className="glass p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{GAMES.find(g => g.id === selectedGame)?.label} Cards</h3>
              <span className="text-xs text-cv-muted">{gameItems.length} cards</span>
            </div>
            <input
              className="input mb-3"
              placeholder="Search cards..."
              value={deckSearch}
              onChange={e => setDeckSearch(e.target.value)}
            />
            {collectionLoading ? (
              <p className="py-8 text-center text-sm text-cv-muted">Loading collection...</p>
            ) : filteredPool.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-cv-muted">No {GAMES.find(g => g.id === selectedGame)?.label} cards in your collection.</p>
                <p className="mt-1 text-xs text-cv-muted">Scan or upload cards to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pr-1">
                {filteredPool.map(item => {
                  const copies = getCopiesInDeck(item.id)
                  const atMax = copies >= game.maxCopies
                  const name = cardName(item)
                  const value = item.latest_sold_price_cents ?? item.estimated_value_cents ?? 0
                  return (
                    <button
                      key={item.id}
                      className={`card-hover glass relative overflow-hidden rounded-[var(--radius-md)] p-2 text-left transition-opacity ${atMax ? 'opacity-50' : ''}`}
                      onClick={() => !atMax && addCard(item)}
                      disabled={atMax}
                      type="button"
                    >
                      <div className="h-24 w-full overflow-hidden rounded-[var(--radius-sm)]">
                        <MiniCard item={item} className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-1.5 truncate text-xs font-semibold">{name}</p>
                      <p className="text-[10px] text-cv-muted">${(value / 100).toFixed(2)}</p>
                      {copies > 0 && (
                        <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                          {copies}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT — Custom Deck Builder */}
          <div className="space-y-4">
            <div className="glass p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Custom Deck</h3>
                <span className="text-sm text-cv-muted">{totalCards}/{game.deckSize}</span>
              </div>

              <input
                className="input mb-3 text-sm"
                placeholder="Deck name..."
                value={deckName}
                onChange={e => setDeckName(e.target.value)}
              />

              {/* Progress bar */}
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-cv-surface">
                <div
                  className={`h-full rounded-full transition-all ${progressColor}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {customDeck.length === 0 ? (
                <p className="py-4 text-center text-sm text-cv-muted">
                  Click cards from your collection →
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {customDeck.map(entry => (
                    <div key={entry.collectionItemId} className="flex items-center gap-2 rounded-[var(--radius-md)] bg-cv-surface p-2">
                      <div className="h-8 w-6 flex-shrink-0 overflow-hidden rounded">
                        <MiniCard item={entry.item} className="h-full w-full object-cover" />
                      </div>
                      <span className="flex-1 truncate text-xs">{entry.cardName}</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-cv-surfaceStrong text-cv-muted hover:text-cv-text"
                          onClick={() => removeCard(entry.collectionItemId)}
                          type="button"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-4 text-center text-xs font-bold">{entry.copies}</span>
                        <button
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-cv-surfaceStrong text-cv-muted hover:text-cv-text disabled:opacity-40"
                          onClick={() => addCard(entry.item)}
                          disabled={entry.copies >= game.maxCopies}
                          type="button"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {customDeck.length > 0 && (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-cv-muted">
                    <span>Value: <strong className="text-cv-text">${(deckValue / 100).toFixed(2)}</strong></span>
                    <span>Avg: <strong className="text-cv-text">${totalCards > 0 ? (deckValue / totalCards / 100).toFixed(2) : '0.00'}</strong></span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-primary flex-1 text-xs" onClick={() => void handleSaveDeck()} type="button">
                      Save Deck
                    </button>
                    <button className="btn-secondary text-xs" onClick={exportList} title="Copy to clipboard" type="button">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button className="btn-ghost text-xs text-cv-danger" onClick={clearDeck} title="Clear deck" type="button">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {deckMessage && <p className="mt-2 text-xs text-cv-muted">{deckMessage}</p>}
                </>
              )}
            </div>

            {/* AI Generator */}
            <div className="glass p-4">
              <h3 className="mb-2 font-semibold text-sm">AI Deck Generator</h3>
              <p className="mb-3 text-xs text-cv-muted">Auto-build a {selectedFormat} deck from your collection.</p>
              <button
                className="btn-primary w-full text-sm"
                onClick={() => void handleGenerate()}
                disabled={generating}
                type="button"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
                  </span>
                ) : 'Generate from Collection'}
              </button>
              {!customDeck.length && deckMessage && (
                <p className="mt-2 text-xs text-cv-muted">{deckMessage}</p>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
