import { useMemo, useState } from 'react'
import { Copy, Layers, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react'
import CardCrop from '../components/CardCrop'
import { api, type CollectionItem } from '../lib/api'
import { useCollection } from '../lib/hooks'

const GAMES = [
  { id: 'pokemon', label: 'Pokémon TCG', deckSize: 60, maxCopies: 4 },
  { id: 'yugioh', label: 'Yu-Gi-Oh!', deckSize: 40, maxCopies: 3 },
  { id: 'magic', label: 'Magic: The Gathering', deckSize: 60, maxCopies: 4 },
  { id: 'other', label: 'Other', deckSize: 60, maxCopies: 4 },
] as const

type GameId = (typeof GAMES)[number]['id']

const FORMATS: Record<GameId, string[]> = {
  pokemon: ['Standard', 'Expanded', 'Unlimited', 'Theme'],
  yugioh: ['Advanced', 'Traditional', 'Speed Duel'],
  magic: ['Standard', 'Modern', 'Legacy', 'Vintage', 'Commander', 'Pioneer'],
  other: ['Custom'],
}

const FORMAT_RULES: Record<string, Record<string, string>> = {
  pokemon: {
    Standard: '60 cards, max 4 copies (except basic energy), 1 Prize card format',
    Expanded: '60 cards, all Black & White onwards sets legal',
    Unlimited: '60 cards, all sets legal',
    Theme: '60 cards, pre-constructed theme decks only',
  },
  yugioh: {
    Advanced: '40–60 cards main deck, banned list applies',
    Traditional: '40–60 cards, all cards legal',
    'Speed Duel': '20 card deck, simplified rules',
  },
  magic: {
    Standard: '60 cards, last 2 years of sets',
    Modern: '60 cards, 8th Edition onwards',
    Legacy: '60 cards, most sets legal with banned list',
    Vintage: '60 cards, all sets with restricted list',
    Commander: '100 card singleton, 1 commander',
    Pioneer: '60 cards, Return to Ravnica onwards',
  },
  other: { Custom: 'Custom format rules' },
}

interface DeckEntry {
  collection_item_id: number
  card_name: string
  copies: number
  item: CollectionItem
}

const SPORT_COLORS: Record<string, string> = {
  pokemon: 'bg-yellow-500/20 text-yellow-300',
  yugioh: 'bg-purple-500/20 text-purple-300',
  magic: 'bg-blue-500/20 text-blue-300',
  baseball: 'bg-blue-500/20 text-blue-200',
  basketball: 'bg-orange-500/20 text-orange-200',
  football: 'bg-green-500/20 text-green-200',
}

function getGameColor(item: CollectionItem) {
  const g = (item.game || item.sport || item.card?.game || item.card?.sport || '').toLowerCase()
  return SPORT_COLORS[g] ?? 'bg-violet-500/20 text-violet-200'
}

export default function DeckBuilderPage() {
  const { data: allItems = [], isLoading } = useCollection(true)

  const [gameId, setGameId] = useState<GameId>('pokemon')
  const [format, setFormat] = useState('Standard')
  const [deckEntries, setDeckEntries] = useState<DeckEntry[]>([])
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState('')

  const game = GAMES.find((g) => g.id === gameId)!

  // Filter collection by selected game
  const gameItems = useMemo(() => {
    return allItems.filter((item) => {
      const g = (item.game || item.sport || item.card?.game || item.card?.sport || '').toLowerCase()
      return g.includes(gameId) || gameId === 'other'
    })
  }, [allItems, gameId])

  const filteredPool = useMemo(() => {
    if (!search) return gameItems
    const q = search.toLowerCase()
    return gameItems.filter((item) => {
      const name = `${item.player_name || ''} ${item.card_name || ''} ${item.card?.player_name || ''} ${item.card?.card_name || ''}`.toLowerCase()
      return name.includes(q)
    })
  }, [gameItems, search])

  const totalCards = useMemo(() => deckEntries.reduce((s, e) => s + e.copies, 0), [deckEntries])
  const deckValue = useMemo(
    () => deckEntries.reduce((s, e) => s + (e.item.latest_sold_price_cents ?? e.item.estimated_value_cents ?? 0) * e.copies, 0),
    [deckEntries],
  )

  function getCopiesInDeck(itemId: number) {
    return deckEntries.find((e) => e.collection_item_id === itemId)?.copies ?? 0
  }

  function addCard(item: CollectionItem) {
    const name = item.player_name || item.card_name || item.card?.player_name || item.card?.card_name || 'Unknown'
    setDeckEntries((prev) => {
      const existing = prev.find((e) => e.collection_item_id === item.id)
      if (existing) {
        if (existing.copies >= game.maxCopies) return prev
        return prev.map((e) => e.collection_item_id === item.id ? { ...e, copies: e.copies + 1 } : e)
      }
      return [...prev, { collection_item_id: item.id, card_name: name, copies: 1, item }]
    })
  }

  function removeCard(itemId: number) {
    setDeckEntries((prev) => {
      const existing = prev.find((e) => e.collection_item_id === itemId)
      if (!existing) return prev
      if (existing.copies <= 1) return prev.filter((e) => e.collection_item_id !== itemId)
      return prev.map((e) => e.collection_item_id === itemId ? { ...e, copies: e.copies - 1 } : e)
    })
  }

  function clearDeck() {
    setDeckEntries([])
    setGenMessage('')
  }

  function exportList() {
    const lines = deckEntries.map((e) => `${e.copies}x ${e.card_name}`).join('\n')
    void navigator.clipboard.writeText(lines)
  }

  function saveDeck() {
    const saved = { game: gameId, format, entries: deckEntries.map((e) => ({ id: e.collection_item_id, name: e.card_name, copies: e.copies })) }
    localStorage.setItem('cardvault_deck', JSON.stringify(saved))
    setGenMessage('Deck saved locally!')
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenMessage('')
    try {
      const result = await api.generateDeck({ game: gameId, format })
      const newEntries: DeckEntry[] = []
      for (const d of result.deck) {
        const item = allItems.find((i) => i.id === d.collection_item_id)
        if (item) newEntries.push({ collection_item_id: d.collection_item_id, card_name: d.card_name, copies: d.copies, item })
      }
      setDeckEntries(newEntries)
      setGenMessage(result.message)
    } catch (err) {
      setGenMessage(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function onGameChange(id: GameId) {
    setGameId(id)
    setFormat(FORMATS[id][0])
    clearDeck()
  }

  const progressPct = Math.min(100, (totalCards / game.deckSize) * 100)
  const progressColor = progressPct === 100 ? 'bg-cv-good' : progressPct > 60 ? 'bg-[var(--primary)]' : 'bg-cv-warn'

  return (
    <div className="page-enter space-y-4">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-[var(--primary)]" />
        <div>
          <h2 className="text-2xl font-bold">Deck Builder</h2>
          <p className="text-sm text-cv-muted">Build decks from your collection</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[30%_40%_30%]">
        {/* LEFT PANEL — Deck Configuration + Deck List */}
        <div className="space-y-4">
          <div className="glass p-4">
            <h3 className="mb-3 font-semibold">Deck Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-cv-muted">Game</label>
                <select
                  className="input"
                  value={gameId}
                  onChange={(e) => onGameChange(e.target.value as GameId)}
                >
                  {GAMES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-cv-muted">Format</label>
                <select
                  className="input"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  {FORMATS[gameId].map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="glass p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Deck List</h3>
              <span className="text-sm text-cv-muted">{totalCards}/{game.deckSize}</span>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-cv-surface">
              <div
                className={`h-full rounded-full transition-all ${progressColor}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {deckEntries.length === 0 ? (
              <p className="py-4 text-center text-sm text-cv-muted">
                No cards added yet. Browse your collection →
              </p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {deckEntries.map((entry) => {
                  const apiBase = import.meta.env.VITE_API_URL ?? ''
                  const imageUrl = entry.item.front_image_url
                    ? `${apiBase}/api/images/${encodeURIComponent(entry.item.front_image_url)}`
                    : null
                  const hasBbox = entry.item.bbox_x != null && entry.item.bbox_y != null
                  const bbox = hasBbox
                    ? { x: entry.item.bbox_x!, y: entry.item.bbox_y!, width: entry.item.bbox_width!, height: entry.item.bbox_height! }
                    : null

                  return (
                    <div key={entry.collection_item_id} className="flex items-center gap-2 rounded-[var(--radius-md)] bg-cv-surface p-2">
                      <div className="h-8 w-6 flex-shrink-0 overflow-hidden rounded">
                        {imageUrl && bbox ? (
                          <CardCrop sheetUrl={imageUrl} bbox={bbox} className="h-full w-full object-cover" />
                        ) : imageUrl ? (
                          <img src={imageUrl} alt={entry.card_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))]" />
                        )}
                      </div>
                      <span className="flex-1 truncate text-xs">{entry.card_name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-cv-surfaceStrong text-cv-muted hover:text-cv-text"
                          onClick={() => removeCard(entry.collection_item_id)}
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
                  )
                })}
              </div>
            )}

            {deckEntries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-primary flex-1 text-xs" onClick={saveDeck} type="button">
                  Save Deck
                </button>
                <button className="btn-secondary text-xs" onClick={exportList} title="Copy to clipboard" type="button">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button className="btn-ghost text-xs text-cv-danger" onClick={clearDeck} title="Clear deck" type="button">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CENTER PANEL — Card Pool */}
        <div className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Your {GAMES.find((g) => g.id === gameId)?.label} Cards</h3>
            <span className="text-xs text-cv-muted">{gameItems.length} cards</span>
          </div>

          <input
            className="input mb-3"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {isLoading ? (
            <p className="py-8 text-center text-sm text-cv-muted">Loading collection...</p>
          ) : filteredPool.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-cv-muted">No {GAMES.find((g) => g.id === gameId)?.label} cards in your collection.</p>
              <p className="mt-1 text-xs text-cv-muted">Scan or upload cards to get started.</p>
            </div>
          ) : (
            <div className="grid max-h-[600px] grid-cols-2 gap-2 overflow-y-auto pr-1">
              {filteredPool.map((item) => {
                const apiBase = import.meta.env.VITE_API_URL ?? ''
                const imageUrl = item.front_image_url
                  ? `${apiBase}/api/images/${encodeURIComponent(item.front_image_url)}`
                  : null
                const hasBbox = item.bbox_x != null && item.bbox_y != null
                const bbox = hasBbox
                  ? { x: item.bbox_x!, y: item.bbox_y!, width: item.bbox_width!, height: item.bbox_height! }
                  : null
                const copies = getCopiesInDeck(item.id)
                const atMax = copies >= game.maxCopies
                const name = item.player_name || item.card_name || item.card?.player_name || item.card?.card_name || 'Unknown'
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
                      {imageUrl && bbox ? (
                        <CardCrop sheetUrl={imageUrl} bbox={bbox} className="h-full w-full object-cover" />
                      ) : imageUrl ? (
                        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--primary),var(--secondary))] text-xl font-bold">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs font-semibold">{name}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <span className={`badge border-0 px-1.5 py-0.5 text-[10px] ${getGameColor(item)}`}>
                        {item.estimated_grade || 'Raw'}
                      </span>
                      <span className="ml-auto text-[10px] text-cv-muted">${(value / 100).toFixed(2)}</span>
                    </div>
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

        {/* RIGHT PANEL — AI Generator + Stats */}
        <div className="space-y-4">
          <div className="glass p-4">
            <h3 className="mb-3 font-semibold">AI Deck Generator</h3>
            <p className="mb-3 text-xs text-cv-muted">
              {FORMAT_RULES[gameId]?.[format] || 'Select a format to see rules.'}
            </p>
            <button
              className="btn-primary w-full"
              onClick={() => void handleGenerate()}
              disabled={generating}
              type="button"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
                </span>
              ) : (
                'Generate Deck from Collection'
              )}
            </button>
            {genMessage && (
              <p className="mt-2 text-xs text-cv-muted">{genMessage}</p>
            )}
          </div>

          {deckEntries.length > 0 && (
            <div className="glass p-4">
              <h3 className="mb-3 font-semibold">Deck Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-cv-muted">Cards</span>
                  <span className="font-semibold">{totalCards} / {game.deckSize}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cv-muted">Unique Cards</span>
                  <span className="font-semibold">{deckEntries.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cv-muted">Deck Value</span>
                  <span className="gradient-text font-bold">${(deckValue / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cv-muted">Avg per Card</span>
                  <span className="font-semibold">
                    ${totalCards > 0 ? (deckValue / totalCards / 100).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cv-muted">Completion</span>
                  <span className={`font-semibold ${progressPct === 100 ? 'text-cv-good' : 'text-cv-warn'}`}>
                    {progressPct.toFixed(0)}%
                  </span>
                </div>

                {/* Type breakdown SVG donut */}
                <div className="pt-2">
                  <p className="mb-2 text-xs text-cv-muted">Card breakdown</p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cv-surface">
                    <div
                      className={`h-full rounded-full transition-all ${progressColor}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs text-cv-muted">{totalCards}/{game.deckSize} cards</div>
                </div>
              </div>
            </div>
          )}

          <div className="glass p-4">
            <h3 className="mb-2 font-semibold text-sm">Format Rules</h3>
            <div className="space-y-1">
              {FORMATS[gameId].map((f) => (
                <button
                  key={f}
                  className={`w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-xs transition ${
                    f === format
                      ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
                      : 'text-cv-muted hover:bg-cv-surface'
                  }`}
                  onClick={() => setFormat(f)}
                  type="button"
                >
                  <span className="font-semibold">{f}</span>
                  {f === format && (
                    <p className="mt-0.5 text-[10px] opacity-80">{FORMAT_RULES[gameId]?.[f]}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
