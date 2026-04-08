import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Layers, Minus, Plus, RefreshCw, Trash2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import CardCrop from '../components/CardCrop'
import { api, type CollectionItem } from '../lib/api'
import { useCollection } from '../lib/hooks'

// ── Types ─────────────────────────────────────────────────────────────────────

type SelectedGame = 'pokemon' | 'magic' | 'yugioh' | 'lorcana' | 'onepiece'

interface DeckCard {
  name: string
  qty: number
  category: string
  search: string
  isEvolution?: boolean   // Pokémon only
  cmc?: number            // MTG mana value
}

interface MetaDeck {
  name: string
  archetype: string
  game: string
  format: string
  theme: 'Aggro' | 'Control' | 'Combo' | 'Midrange'
  description: string
  key_cards: string[]
  strategy: string
  full_deck?: DeckCard[]
  estimated_budget_usd?: number
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  commander?: DeckCard | null
  sideboard?: DeckCard[]
  main_deck?: DeckCard[]
  extra_deck?: DeckCard[]
  side_deck?: DeckCard[]
}

interface DeckAnalysis {
  have: CollectionItem[]
  need: Array<{
    name: string
    qty: number
    category: string
    search: string
    ebay_url: string
    tcgplayer_url: string
  }>
  completion_pct: number
  have_count: number
  need_count: number
  total_key_cards: number
  // Extended for YGO / MTG
  main_deck?: { have: CollectionItem[]; need: DeckAnalysis['need']; have_count: number; total_count: number } | null
  extra_deck?: { have: CollectionItem[]; need: DeckAnalysis['need']; have_count: number; total_count: number } | null
  side_deck?: { have: CollectionItem[]; need: DeckAnalysis['need']; have_count: number; total_count: number } | null
}

interface CustomDeckEntry {
  collectionItemId: number
  cardName: string
  copies: number
  item: CollectionItem
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GAMES = [
  {
    id: 'pokemon' as SelectedGame,
    label: 'Pokémon TCG',
    deckSize: 60,
    maxCopies: 4,
    maxCopiesExceptions: ['Basic Energy'],
    hasExtraDeck: false,
    hasSideDeck: false,
    color: '#FFDE00',
    accentColor: '#CC0000',
  },
  {
    id: 'magic' as SelectedGame,
    label: 'Magic: The Gathering',
    deckSize: 60,
    maxCopies: 4,
    maxCopiesExceptions: ['Basic Land'],
    hasExtraDeck: false,
    hasSideDeck: true,
    sideboardSize: 15,
    color: '#A67C52',
    accentColor: '#1F1F1F',
  },
  {
    id: 'yugioh' as SelectedGame,
    label: 'Yu-Gi-Oh!',
    deckSize: 40,
    deckSizeMax: 60,
    maxCopies: 3,
    hasExtraDeck: true,
    extraDeckSize: 15,
    hasSideDeck: true,
    sideboardSize: 15,
    color: '#8B6914',
    accentColor: '#4B0082',
  },
  {
    id: 'lorcana' as SelectedGame,
    label: 'Lorcana',
    deckSize: 60,
    maxCopies: 4,
    hasExtraDeck: false,
    hasSideDeck: false,
    color: '#6B5CE7',
    accentColor: '#2D1B69',
  },
  {
    id: 'onepiece' as SelectedGame,
    label: 'One Piece',
    deckSize: 50,
    maxCopies: 4,
    hasExtraDeck: false,
    hasSideDeck: false,
    color: '#E63946',
    accentColor: '#1D3557',
  },
]

const FORMATS: Record<SelectedGame, Array<{ id: string; label: string; description: string }>> = {
  pokemon: [
    { id: 'standard', label: 'Standard', description: '60 cards • Max 4 copies • Current rotation only' },
    { id: 'expanded', label: 'Expanded', description: '60 cards • Max 4 copies • Black & White onwards' },
    { id: 'unlimited', label: 'Unlimited', description: '60 cards • All sets ever printed' },
  ],
  magic: [
    { id: 'standard', label: 'Standard', description: '60 cards • Min 60 main • 15 sideboard • Last 2 years of sets' },
    { id: 'pioneer', label: 'Pioneer', description: '60+ cards • 15 sideboard • Return to Ravnica onwards' },
    { id: 'modern', label: 'Modern', description: '60+ cards • 15 sideboard • 8th Edition onwards' },
    { id: 'legacy', label: 'Legacy', description: '60+ cards • 15 sideboard • All sets, select bans' },
    { id: 'vintage', label: 'Vintage', description: '60+ cards • 15 sideboard • All sets, restricted list' },
    { id: 'commander', label: 'Commander / EDH', description: '100 cards • 1 Commander • Max 1 copy of each non-basic' },
    { id: 'pauper', label: 'Pauper', description: '60+ cards • Commons only across all formats' },
  ],
  yugioh: [
    { id: 'advanced', label: 'Advanced', description: '40–60 main • 0–15 extra • 0–15 side • Banlist enforced' },
    { id: 'traditional', label: 'Traditional', description: '40–60 main • Banned cards limited to 1 instead' },
    { id: 'goat', label: 'GOAT Format', description: 'April 2005 format • Classic competitive environment' },
    { id: 'edison', label: 'Edison Format', description: 'March 2010 format • Synchro era competitive play' },
    { id: 'speed', label: 'Speed Duel', description: '20 main deck cards • Speed duel rules' },
  ],
  lorcana: [
    { id: 'standard', label: 'Standard', description: '60 cards • Max 4 copies' },
    { id: 'casual', label: 'Casual', description: 'Casual play' },
  ],
  onepiece: [
    { id: 'standard', label: 'Standard', description: '50 cards • Max 4 copies' },
    { id: 'casual', label: 'Casual', description: 'Casual play' },
  ],
}

const STRATEGY_COLORS: Record<string, string> = {
  aggro: 'bg-red-500/20 text-red-300',
  control: 'bg-blue-500/20 text-blue-300',
  combo: 'bg-purple-500/20 text-purple-300',
  midrange: 'bg-green-500/20 text-green-300',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-green-500/20 text-green-300',
  Intermediate: 'bg-blue-500/20 text-blue-300',
  Advanced: 'bg-yellow-500/20 text-yellow-300',
  Expert: 'bg-red-500/20 text-red-300',
}

// Card categories per game for custom deck builder
const CARD_CATEGORIES: Record<SelectedGame, string[]> = {
  pokemon: ['Basic Pokémon', 'Stage 1', 'Stage 2', 'EX/GX/V/VMAX/VSTAR', 'Trainer', 'Energy'],
  magic: ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'],
  yugioh: ['Normal Monster', 'Effect Monster', 'Fusion', 'Synchro', 'XYZ', 'Link', 'Spell', 'Trap'],
  lorcana: ['Character', 'Action', 'Item', 'Location'],
  onepiece: ['Character', 'Event', 'Stage'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDeckSize(game: string, format: string): number {
  if (game === 'magic' && format === 'commander') return 100
  if (game === 'yugioh') return 40
  return 60
}

function calculateDeckStats(deckCards: DeckCard[], game: string) {
  const total = deckCards.reduce((sum, c) => sum + c.qty, 0)

  if (game === 'pokemon') {
    const pokemon = deckCards.filter(c => c.category === 'pokemon').reduce((s, c) => s + c.qty, 0)
    const trainers = deckCards.filter(c => c.category === 'trainer').reduce((s, c) => s + c.qty, 0)
    const energy = deckCards.filter(c => c.category === 'energy').reduce((s, c) => s + c.qty, 0)
    const basicPokemon = deckCards.filter(c => c.category === 'pokemon' && !c.isEvolution).reduce((s, c) => s + c.qty, 0)
    return { total, pokemon, trainers, energy, basicPokemon }
  }

  if (game === 'magic') {
    const lands = deckCards.filter(c => c.category === 'land').reduce((s, c) => s + c.qty, 0)
    const creatures = deckCards.filter(c => c.category === 'creature').reduce((s, c) => s + c.qty, 0)
    const spells = deckCards.filter(c => !['land', 'creature'].includes(c.category)).reduce((s, c) => s + c.qty, 0)
    const nonLandTotal = total - lands
    const avgCMC = deckCards
      .filter(c => c.category !== 'land')
      .reduce((sum, c) => sum + (c.cmc || 0) * c.qty, 0) / Math.max(1, nonLandTotal)
    return { total, lands, creatures, spells, avgCMC: avgCMC.toFixed(1) }
  }

  if (game === 'yugioh') {
    const monsters = deckCards.filter(c => c.category === 'monster').reduce((s, c) => s + c.qty, 0)
    const spells = deckCards.filter(c => c.category === 'spell').reduce((s, c) => s + c.qty, 0)
    const traps = deckCards.filter(c => c.category === 'trap').reduce((s, c) => s + c.qty, 0)
    const extra = deckCards.filter(c => c.category === 'extra').reduce((s, c) => s + c.qty, 0)
    return { total, monsters, spells, traps, extra }
  }

  return { total }
}

function formatDeckExport(deck: MetaDeck, game: string): string {
  const mainCards = deck.full_deck ?? deck.main_deck ?? []

  if (game === 'pokemon') {
    const pokemon = mainCards.filter(c => c.category === 'pokemon')
    const trainers = mainCards.filter(c => c.category === 'trainer')
    const energy = mainCards.filter(c => c.category === 'energy')
    const pokemonTotal = pokemon.reduce((s, c) => s + c.qty, 0)
    const trainerTotal = trainers.reduce((s, c) => s + c.qty, 0)
    const energyTotal = energy.reduce((s, c) => s + c.qty, 0)
    const lines: string[] = []
    lines.push(`Pokémon: ${pokemonTotal}`)
    pokemon.forEach(c => {
      const parts = c.search.split(' ')
      const setCode = parts.find(p => /^[A-Z]{2,4}$/.test(p)) ?? ''
      const num = parts.find(p => /^\d{3}$/.test(p)) ?? ''
      lines.push(`${c.qty} ${c.name}${setCode ? ' ' + setCode : ''}${num ? ' ' + num : ''}`)
    })
    lines.push('')
    lines.push(`Trainer: ${trainerTotal}`)
    trainers.forEach(c => {
      const parts = c.search.split(' ')
      const setCode = parts.find(p => /^[A-Z]{2,4}$/.test(p)) ?? ''
      const num = parts.find(p => /^\d{3}$/.test(p)) ?? ''
      lines.push(`${c.qty} ${c.name}${setCode ? ' ' + setCode : ''}${num ? ' ' + num : ''}`)
    })
    lines.push('')
    lines.push(`Energy: ${energyTotal}`)
    energy.forEach(c => lines.push(`${c.qty} ${c.name}`))
    return lines.join('\n')
  }

  if (game === 'magic') {
    const lines: string[] = [`// ${deck.name}`]
    mainCards.forEach(c => lines.push(`${c.qty} ${c.name}`))
    if (deck.sideboard && deck.sideboard.length > 0) {
      lines.push('')
      lines.push('// Sideboard')
      deck.sideboard.forEach(c => lines.push(`${c.qty} ${c.name}`))
    }
    return lines.join('\n')
  }

  if (game === 'yugioh') {
    const lines: string[] = []
    const mainTotal = mainCards.reduce((s, c) => s + c.qty, 0)
    lines.push(`// Main Deck (${mainTotal})`)
    mainCards.forEach(c => lines.push(`${c.qty} ${c.name}`))
    if (deck.extra_deck && deck.extra_deck.length > 0) {
      const extraTotal = deck.extra_deck.reduce((s, c) => s + c.qty, 0)
      lines.push('')
      lines.push(`// Extra Deck (${extraTotal})`)
      deck.extra_deck.forEach(c => lines.push(`${c.qty} ${c.name}`))
    }
    if (deck.side_deck && deck.side_deck.length > 0) {
      const sideTotal = deck.side_deck.reduce((s, c) => s + c.qty, 0)
      lines.push('')
      lines.push(`// Side Deck (${sideTotal})`)
      deck.side_deck.forEach(c => lines.push(`${c.qty} ${c.name}`))
    }
    return lines.join('\n')
  }

  // Default
  return mainCards.map(c => `${c.qty}x ${c.name}`).join('\n')
}

function validateDeck(deckCards: CustomDeckEntry[], game: SelectedGame, format: string): string[] {
  const warnings: string[] = []
  const totalCards = deckCards.reduce((s, e) => s + e.copies, 0)

  if (game === 'pokemon') {
    const basicPokemon = deckCards.filter(e => {
      const cat = (e.item.game || '').toLowerCase()
      return cat.includes('pokemon')
    }).length
    if (basicPokemon < 5) warnings.push('⚠️ Fewer than 5 basic Pokémon — you may not be able to start the game')
    deckCards.forEach(e => {
      if (e.copies > 4) warnings.push(`⚠️ ${e.cardName} has ${e.copies} copies (max 4)`)
    })
    if (totalCards === 60) warnings.push('✅ Deck is exactly 60 cards')
  }

  if (game === 'magic') {
    if (format === 'commander') {
      deckCards.forEach(e => {
        if (e.copies > 1) warnings.push(`⚠️ Commander: ${e.cardName} has ${e.copies} copies (max 1 for non-basics)`)
      })
    } else {
      deckCards.forEach(e => {
        if (e.copies >= 5) warnings.push(`⚠️ ${e.cardName} has ${e.copies} copies (max 4 for non-basics)`)
      })
      const landCount = deckCards.reduce((s, e) => s + e.copies, 0)
      if (landCount < 20 && totalCards >= 60) warnings.push('⚠️ Fewer than 20 lands in a 60-card deck')
    }
    if (totalCards >= 60) warnings.push('✅ Deck meets minimum card count')
  }

  if (game === 'yugioh') {
    if (totalCards < 40) warnings.push(`⚠️ Main deck has ${totalCards} cards (minimum 40)`)
    deckCards.forEach(e => {
      if (e.copies > 3) warnings.push(`⚠️ ${e.cardName} has ${e.copies} copies (max 3)`)
    })
    if (totalCards >= 40 && totalCards <= 60) warnings.push('✅ Deck is valid')
  }

  return warnings
}

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

// ── Have/Need Section Component ───────────────────────────────────────────────

function HaveNeedSection({
  title,
  have,
  need,
  haveCount,
  totalCount,
}: {
  title: string
  have: CollectionItem[]
  need: DeckAnalysis['need']
  haveCount: number
  totalCount: number
}) {
  const pct = totalCount > 0 ? Math.round((haveCount / totalCount) * 100) : 0
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-cv-muted">{title}</p>
        <span className="text-xs font-semibold">{haveCount}/{totalCount} ({pct}%)</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-cv-surface mb-2">
        <div className="h-full rounded-full bg-cv-good transition-all" style={{ width: `${pct}%` }} />
      </div>
      {have.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-green-400 mb-1 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Have ({have.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {have.map(item => (
              <div key={item.id} className="h-10 w-7 overflow-hidden rounded" title={cardName(item)}>
                <MiniCard item={item} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
      {need.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-red-400 mb-1 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Need ({need.length})
          </p>
          <div className="space-y-1">
            {need.map(card => (
              <div key={card.name} className="rounded-[var(--radius-sm)] bg-cv-bg2 p-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium">{card.qty}× {card.name}</span>
                  <span className={`text-[9px] rounded px-1 py-0.5 ${
                    card.category === 'pokemon' ? 'bg-yellow-500/20 text-yellow-300' :
                    card.category === 'trainer' ? 'bg-blue-500/20 text-blue-300' :
                    card.category === 'monster' ? 'bg-orange-500/20 text-orange-300' :
                    card.category === 'spell' ? 'bg-teal-500/20 text-teal-300' :
                    card.category === 'trap' ? 'bg-pink-500/20 text-pink-300' :
                    card.category === 'extra' ? 'bg-purple-500/20 text-purple-300' :
                    card.category === 'land' ? 'bg-green-500/20 text-green-300' :
                    card.category === 'creature' ? 'bg-cyan-500/20 text-cyan-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>{card.category}</span>
                </div>
                <div className="flex gap-2">
                  <a href={card.ebay_url} target="_blank" rel="noreferrer" className="text-[9px] text-[var(--primary)] hover:underline">eBay →</a>
                  <a href={card.tcgplayer_url} target="_blank" rel="noreferrer" className="text-[9px] text-cv-muted hover:underline">TCGPlayer →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DeckBuilderPage() {
  const { data: allItems = [], isLoading: collectionLoading } = useCollection(true)

  // Game state
  const [selectedGame, setSelectedGame] = useState<SelectedGame>('pokemon')
  const [selectedFormat, setSelectedFormat] = useState('standard')

  // Meta deck state
  const [selectedMetaDeck, setSelectedMetaDeck] = useState<MetaDeck | null>(null)
  const [deckAnalysis, setDeckAnalysis] = useState<DeckAnalysis | null>(null)
  const [analyzingDeck, setAnalyzingDeck] = useState(false)
  const [ygoActiveTab, setYgoActiveTab] = useState<'main' | 'extra' | 'side'>('main')

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
  const currentFormat = FORMATS[selectedGame].find(f => f.id === selectedFormat) ?? FORMATS[selectedGame][0]
  const deckSize = getDeckSize(selectedGame, selectedFormat)

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

  const metaDecks = (metaData?.decks ?? []) as MetaDeck[]

  // Custom deck helpers
  const totalCards = useMemo(() => customDeck.reduce((s, e) => s + e.copies, 0), [customDeck])
  const deckValue = useMemo(
    () => customDeck.reduce((s, e) => s + (e.item.latest_sold_price_cents ?? e.item.estimated_value_cents ?? 0) * e.copies, 0),
    [customDeck],
  )
  const progressPct = Math.min(100, (totalCards / deckSize) * 100)
  const progressColor = progressPct === 100 ? 'bg-cv-good' : progressPct > 60 ? 'bg-[var(--primary)]' : 'bg-cv-warn'

  // Deck validation warnings
  const validationWarnings = useMemo(
    () => validateDeck(customDeck, selectedGame, selectedFormat),
    [customDeck, selectedGame, selectedFormat],
  )

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
    if (selectedMetaDeck) {
      const text = formatDeckExport(selectedMetaDeck, selectedGame)
      void navigator.clipboard.writeText(text)
    } else {
      const lines = customDeck.map(e => `${e.copies}x ${e.cardName}`).join('\n')
      void navigator.clipboard.writeText(lines)
    }
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
    setYgoActiveTab('main')
    try {
      const mainCards = deck.full_deck ?? deck.main_deck ?? []
      const result = await api.analyzeDeck({
        key_cards: deck.key_cards,
        full_deck: mainCards.length > 0 ? mainCards : null,
        extra_deck: deck.extra_deck ?? null,
        side_deck: deck.side_deck ?? null,
        sideboard: deck.sideboard ?? null,
        game: selectedGame,
        deck_size: deckSize,
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
    setSelectedFormat(FORMATS[id][0].id)
    setSelectedMetaDeck(null)
    setDeckAnalysis(null)
    clearDeck()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
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
          {FORMATS[selectedGame].map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        {currentFormat && (
          <span className="text-xs text-cv-muted hidden md:block">{currentFormat.description}</span>
        )}
      </div>

      {/* ── THREE-PANEL LAYOUT ── */}
      <div className="grid gap-4 lg:grid-cols-3">

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

                    {/* Difficulty + Budget badges */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {deck.difficulty && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${DIFFICULTY_COLORS[deck.difficulty] ?? 'bg-gray-500/20 text-gray-300'}`}>
                          {deck.difficulty}
                        </span>
                      )}
                      {deck.estimated_budget_usd != null && (
                        <span className="rounded bg-cv-bg2 px-1.5 py-0.5 text-[10px] text-cv-muted">
                          ~${deck.estimated_budget_usd}
                        </span>
                      )}
                      {deck.format && (
                        <span className="rounded bg-cv-bg2 px-1.5 py-0.5 text-[10px] text-cv-muted">
                          {deck.format}
                        </span>
                      )}
                    </div>

                    {/* Key cards */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {deck.key_cards.map(kc => (
                        <span key={kc} className="rounded bg-cv-bg2 px-1.5 py-0.5 text-[10px] text-cv-muted">{kc}</span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="btn-primary flex-1 text-xs py-1"
                        onClick={e => { e.stopPropagation(); void buildFromCollection(deck) }}
                        disabled={analyzingDeck}
                        type="button"
                      >
                        {analyzingDeck && selectedMetaDeck?.name === deck.name ? (
                          <span className="flex items-center justify-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Analyzing...</span>
                        ) : 'Build from my collection'}
                      </button>
                      <button
                        className="btn-secondary text-xs py-1 px-2"
                        onClick={e => {
                          e.stopPropagation()
                          const text = formatDeckExport(deck, selectedGame)
                          void navigator.clipboard.writeText(text)
                        }}
                        title="Copy deck list"
                        type="button"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Have/Need Analysis */}
          {deckAnalysis && selectedMetaDeck && (
            <div className="glass p-4">
              <h3 className="mb-2 font-semibold text-sm">{selectedMetaDeck.name} — Collection Analysis</h3>

              {/* Overall completion bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-cv-muted">Overall completion</span>
                  <span className="font-semibold">{deckAnalysis.completion_pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-cv-surface">
                  <div
                    className="h-full rounded-full bg-cv-good transition-all"
                    style={{ width: `${deckAnalysis.completion_pct}%` }}
                  />
                </div>
              </div>

              {/* YGO: Three tabs */}
              {selectedGame === 'yugioh' ? (
                <>
                  <div className="flex gap-1 rounded-[var(--radius-md)] bg-cv-surface p-1 mb-3">
                    {(['main', 'extra', 'side'] as const).map(tab => (
                      <button
                        key={tab}
                        className={`flex-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition capitalize ${ygoActiveTab === tab ? 'bg-[var(--primary)] text-white' : 'text-cv-muted hover:text-cv-text'}`}
                        onClick={() => setYgoActiveTab(tab)}
                        type="button"
                      >
                        {tab === 'main' ? 'Main Deck' : tab === 'extra' ? 'Extra Deck' : 'Side Deck'}
                      </button>
                    ))}
                  </div>

                  {ygoActiveTab === 'main' && (
                    <HaveNeedSection
                      title="Main Deck"
                      have={deckAnalysis.main_deck?.have ?? deckAnalysis.have}
                      need={deckAnalysis.main_deck?.need ?? deckAnalysis.need}
                      haveCount={deckAnalysis.main_deck?.have_count ?? deckAnalysis.have_count}
                      totalCount={deckAnalysis.main_deck?.total_count ?? deckAnalysis.total_key_cards}
                    />
                  )}
                  {ygoActiveTab === 'extra' && (
                    <HaveNeedSection
                      title="Extra Deck"
                      have={deckAnalysis.extra_deck?.have ?? []}
                      need={deckAnalysis.extra_deck?.need ?? []}
                      haveCount={deckAnalysis.extra_deck?.have_count ?? 0}
                      totalCount={deckAnalysis.extra_deck?.total_count ?? 15}
                    />
                  )}
                  {ygoActiveTab === 'side' && (
                    <HaveNeedSection
                      title="Side Deck"
                      have={deckAnalysis.side_deck?.have ?? []}
                      need={deckAnalysis.side_deck?.need ?? []}
                      haveCount={deckAnalysis.side_deck?.have_count ?? 0}
                      totalCount={deckAnalysis.side_deck?.total_count ?? 15}
                    />
                  )}
                </>
              ) : selectedGame === 'magic' ? (
                /* MTG: Creatures / Spells / Lands / Sideboard sections */
                <>
                  {(() => {
                    const mainCards = selectedMetaDeck.full_deck ?? []
                    const stats = calculateDeckStats(mainCards, 'magic') as { total: number; lands: number; creatures: number; spells: number; avgCMC: string }
                    return (
                      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-cv-bg2 p-2">
                          <p className="text-cv-muted text-[10px]">Creatures</p>
                          <p className="font-bold">{stats.creatures}</p>
                        </div>
                        <div className="rounded bg-cv-bg2 p-2">
                          <p className="text-cv-muted text-[10px]">Spells</p>
                          <p className="font-bold">{stats.spells}</p>
                        </div>
                        <div className="rounded bg-cv-bg2 p-2">
                          <p className="text-cv-muted text-[10px]">Lands</p>
                          <p className="font-bold">{stats.lands} <span className="text-cv-muted font-normal">(rec. {Math.round(stats.total * 0.4)})</span></p>
                        </div>
                        <div className="rounded bg-cv-bg2 p-2">
                          <p className="text-cv-muted text-[10px]">Avg CMC</p>
                          <p className="font-bold">{stats.avgCMC}</p>
                        </div>
                      </div>
                    )
                  })()}
                  <HaveNeedSection
                    title="Main Deck"
                    have={deckAnalysis.have}
                    need={deckAnalysis.need}
                    haveCount={deckAnalysis.have_count}
                    totalCount={deckAnalysis.total_key_cards}
                  />
                  {selectedMetaDeck.sideboard && selectedMetaDeck.sideboard.length > 0 && (
                    <HaveNeedSection
                      title="Sideboard"
                      have={deckAnalysis.side_deck?.have ?? []}
                      need={deckAnalysis.side_deck?.need ?? []}
                      haveCount={deckAnalysis.side_deck?.have_count ?? 0}
                      totalCount={deckAnalysis.side_deck?.total_count ?? selectedMetaDeck.sideboard.length}
                    />
                  )}
                </>
              ) : (
                /* Pokémon: Pokémon / Trainers / Energy sections */
                <>
                  {(() => {
                    const mainCards = selectedMetaDeck.full_deck ?? []
                    const stats = calculateDeckStats(mainCards, 'pokemon') as { total: number; pokemon: number; trainers: number; energy: number; basicPokemon: number }
                    return (
                      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-cv-bg2 p-2 text-center">
                          <p className="text-cv-muted text-[10px]">Pokémon</p>
                          <p className="font-bold">{stats.pokemon}</p>
                        </div>
                        <div className="rounded bg-cv-bg2 p-2 text-center">
                          <p className="text-cv-muted text-[10px]">Trainers</p>
                          <p className="font-bold">{stats.trainers}</p>
                        </div>
                        <div className="rounded bg-cv-bg2 p-2 text-center">
                          <p className="text-cv-muted text-[10px]">Energy</p>
                          <p className="font-bold">{stats.energy}</p>
                        </div>
                      </div>
                    )
                  })()}
                  <HaveNeedSection
                    title="Full Deck"
                    have={deckAnalysis.have}
                    need={deckAnalysis.need}
                    haveCount={deckAnalysis.have_count}
                    totalCount={deckAnalysis.total_key_cards}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* CENTER — Collection Card Pool */}
        <div className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{game.label} Cards</h3>
            <span className="text-xs text-cv-muted">{gameItems.length} cards</span>
          </div>
          <input
            className="input mb-3"
            placeholder="Search cards..."
            value={deckSearch}
            onChange={e => setDeckSearch(e.target.value)}
          />

          {/* Card categories hint */}
          <div className="mb-3 flex flex-wrap gap-1">
            {CARD_CATEGORIES[selectedGame].map(cat => (
              <span key={cat} className="rounded bg-cv-bg2 px-1.5 py-0.5 text-[10px] text-cv-muted">{cat}</span>
            ))}
          </div>

          {collectionLoading ? (
            <p className="py-8 text-center text-sm text-cv-muted">Loading collection...</p>
          ) : filteredPool.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-cv-muted">No {game.label} cards in your collection.</p>
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
              <span className="text-sm text-cv-muted">{totalCards}/{deckSize}</span>
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

            {/* Validation warnings */}
            {validationWarnings.length > 0 && (
              <div className="mb-3 space-y-1">
                {validationWarnings.map((w, i) => (
                  <div key={i} className={`flex items-center gap-1 text-[10px] rounded px-2 py-1 ${w.startsWith('✅') ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
                    {w.startsWith('✅') ? null : <AlertTriangle className="h-3 w-3 shrink-0" />}
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

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
            <p className="mb-3 text-xs text-cv-muted">Auto-build a {currentFormat.label} deck from your collection.</p>
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
