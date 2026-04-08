import axios, { AxiosError } from 'axios'

export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string }

export type User = {
  id: number
  email: string
  username?: string | null
  created_at: string
}

export type Card = {
  id: number
  game?: string | null
  sport?: string | null
  set_name?: string | null
  card_name?: string | null
  player_name?: string | null
  year?: number | null
  card_number?: string | null
  rarity?: string | null
  variation?: string | null
  manufacturer?: string | null
  image_url?: string | null
  external_ref?: string | null
  created_at?: string
  updated_at?: string
}

export type CollectionItem = {
  id: number
  user_id?: number
  card_id?: number | null
  card?: Card | null
  quantity?: number
  condition_note?: string | null
  condition_notes?: string | null
  estimated_grade?: string | null
  estimated_value_cents?: number | null
  front_image_url?: string | null
  back_image_url?: string | null
  confirmed_at?: string | null
  confidence?: number | null
  suggestions?: Partial<VisionConfirmPayload> | null
  created_at?: string
  updated_at?: string
  // bbox for canvas cropping
  bbox_x?: number | null
  bbox_y?: number | null
  bbox_width?: number | null
  bbox_height?: number | null
  // latest eBay sold price (from sales_comps join)
  latest_sold_price_cents?: number | null
  // card fields joined from cards table
  card_name?: string | null
  set_name?: string | null
  sport?: string | null
  player_name?: string | null
  year?: number | null
  variation?: string | null
  manufacturer?: string | null
  game?: string | null
  card_number?: string | null
  // sealed product fields
  product_type?: 'single_card' | 'booster_pack' | 'booster_box' | 'etb' | 'tin' | 'bundle' | 'promo_pack' | 'other_sealed' | null
  product_name?: string | null
  purchase_price_cents?: number | null
}

export type SalesComp = {
  id?: number
  source?: string
  title: string
  sold_price_cents: number
  sold_date?: string
  sold_platform?: string
  listing_url?: string
  condition_text?: string
}

export type CompsResponse = {
  sold: SalesComp[]
  active: SalesComp[]
  summary: {
    low_price_cents: number | null
    average_price_cents: number | null
    high_price_cents: number | null
    count: number
  }
  cached: boolean
  last_synced: string
}

export type GradingEstimate = {
  id: number
  collection_item_id: number
  estimated_grade_range: string
  centering_score: number
  corners_score: number
  edges_score: number
  surface_score: number
  confidence_score: number
  explanation?: string
  created_at: string
}

export type Release = {
  id: number
  game: string
  release_name: string
  product_type?: string | null
  release_date: string
  source_url?: string | null
  created_at: string
}

export type WishlistItem = {
  id: number
  ptcg_id: string
  name: string
  set_name: string | null
  set_series: string | null
  card_number: string | null
  rarity: string | null
  image_url: string | null
  tcgplayer_price_cents: number | null
  tcgplayer_url: string | null
  created_at: string
}

export type VisionConfirmPayload = {
  player_name: string
  year: number | null
  set_name: string
  card_number: string
  sport: string
  variation: string
  manufacturer: string
  condition_notes: string
  confidence: number
}

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'

export type TradeRow = {
  id: number
  initiator_id: number
  recipient_id: number
  status: TradeStatus
  message: string | null
  created_at: string
  updated_at: string
  initiator_username: string | null
  initiator_email: string
  recipient_username: string | null
  recipient_email: string
}

export type TradeItem = {
  id: number
  collection_item_id: number
  direction: 'offer' | 'request'
  card_name: string | null
  player_name: string | null
  set_name: string | null
  estimated_value_cents: number | null
  front_image_url: string | null
}

export type TradeDetail = TradeRow & { items: TradeItem[] }

export type Notification = {
  id: number
  type: string
  title: string
  body: string | null
  trade_id: number | null
  read: number
  created_at: string
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://cardsafehq-api.michaelamarino16.workers.dev',
  withCredentials: true,
});

(http.interceptors.response.use as any)(
  (response: { data: ApiEnvelope<unknown> }) => {
    const payload = response.data
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid API response')
    }
    if (!payload.ok) {
      throw new Error(payload.error || 'Request failed')
    }
    return payload.data
  },
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error || error.message || 'Network error'
    return Promise.reject(new Error(message))
  },
)


export const api = {
  register: (payload: { email: string; password: string; username?: string }) =>
    http.post<never, User>('/api/auth/register', payload),
  login: (payload: { email: string; password: string }) =>
    http.post<never, User>('/api/auth/login', payload),
  logout: () => http.post<never, { success: boolean }>('/api/auth/logout'),
  me: () => http.get<never, User>('/api/me'),

  listCards: () => http.get<never, Card[]>('/api/cards'),
  createCard: (payload: Partial<Card>) => http.post<never, Card>('/api/cards', payload),
  getCard: (id: number | string) => http.get<never, Card>(`/api/cards/${id}`),
  updateCard: (id: number | string, payload: Partial<Card>) =>
    http.patch<never, Card>(`/api/cards/${id}`, payload),
  deleteCard: (id: number | string) => http.delete<never, { success: boolean }>(`/api/cards/${id}`),

  listCollection: (confirmed?: boolean) =>
    http.get<never, CollectionItem[]>('/api/collection', {
      params: confirmed === undefined ? undefined : { confirmed },
    }),
  createCollectionItem: (payload: Partial<CollectionItem>) =>
    http.post<never, CollectionItem>('/api/collection', payload),
  getCollectionItem: (id: number | string) =>
    http.get<never, CollectionItem>(`/api/collection/${id}`),
  updateCollectionItem: (id: number | string, payload: Partial<CollectionItem>) =>
    http.patch<never, CollectionItem>(`/api/collection/${id}`, payload),
  deleteCollectionItem: (id: number | string) =>
    http.delete<never, { success: boolean }>(`/api/collection/${id}`),

  batchDeleteCollectionItems: (ids: number[]) =>
    http.delete<never, { deleted: number[] }>('/api/collection/items/batch', { data: { ids } }),

  uploadDirect: (collectionItemId: number, side: 'front' | 'back', file: File) => {
    const formData = new FormData()
    formData.append('collectionItemId', String(collectionItemId))
    formData.append('side', side)
    formData.append('file', file)
    return http.post<never, { url?: string }>('/api/uploads/direct', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  identifyCard: (collectionItemId: number) =>
    http.post<never, CollectionItem>('/api/vision/identify', { collectionItemId }),
  confirmVision: (collectionItemId: number, payload: VisionConfirmPayload) =>
    http.post<never, CollectionItem>(`/api/vision/confirm/${collectionItemId}`, payload),

  getComps: (cardId: number | string) => http.get<never, CompsResponse>(`/api/comps/${cardId}`),
  refreshComps: (cardId: number | string) =>
    http.post<never, CompsResponse>(`/api/comps/refresh/${cardId}`),
  getCompsHistory: (cardId: number | string) =>
    http.get<never, {
      card_id: number;
      history: Array<{
        date: string;
        avg_price_cents: number;
        count: number;
      }>;
    }>(`/api/comps/history/${cardId}`),

  estimateGrade: (collectionItemId: number) =>
    http.post<never, GradingEstimate>('/api/grading/estimate', { collectionItemId }),
  getGrade: (collectionItemId: number | string) =>
    http.get<never, GradingEstimate>(`/api/grading/${collectionItemId}`),

  scanSheet: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.post<never, {
      sheet_url: string;
      cards_detected: number;
      collection_items: Array<CollectionItem & {
        sheet_url?: string;
        bbox?: { x: number; y: number; width: number; height: number };
      }>;
    }>('/api/scan/sheet', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  generateDeck: (payload: { game: string; format: string; strategy?: string; must_include?: number[] }) =>
    http.post<never, {
      deck: Array<{ collection_item_id: number; card_name: string; copies: number }>;
      cards_available?: number;
      deck_size?: number;
      target_size?: number;
      total_value_cents?: number;
      message: string;
      stats?: null;
    }>('/api/deck/generate', payload),

  listReleases: () => http.get<never, Release[]>('/api/releases'),
  createRelease: (payload: Omit<Release, 'id' | 'created_at'>) =>
    http.post<never, Release>('/api/releases', payload),
  getRelease: (id: number | string) => http.get<never, Release>(`/api/releases/${id}`),

  // ── Trades ──────────────────────────────────────────────────────────────
  listTrades: () => http.get<never, TradeRow[]>('/api/trades'),
  createTrade: (payload: {
    recipient_id: number;
    offer_item_ids: number[];
    request_item_ids: number[];
    message?: string;
  }) => http.post<never, { trade_id: number; status: string }>('/api/trades', payload),
  getTrade: (id: number | string) => http.get<never, TradeDetail>(`/api/trades/${id}`),
  updateTradeStatus: (id: number | string, status: TradeStatus) =>
    http.patch<never, { trade_id: number; status: string }>(`/api/trades/${id}/status`, { status }),
  deleteTrade: (id: number | string) =>
    http.delete<never, { deleted: boolean; trade_id: number }>(`/api/trades/${id}`),

  // ── Notifications ────────────────────────────────────────────────────────
  listNotifications: () =>
    http.get<never, { notifications: Notification[]; unread_count: number }>('/api/notifications'),
  markAllNotificationsRead: () =>
    http.patch<never, { marked_read: boolean }>('/api/notifications/read-all'),
  markNotificationRead: (id: number) =>
    http.patch<never, { marked_read: boolean; notification_id: number }>(`/api/notifications/${id}/read`),

  getCardPricing: (cardId: number | string) =>
    http.get<never, {
      card_id: number;
      tcgplayer: {
        market: number | null;
        low: number | null;
        mid: number | null;
        high: number | null;
        url: string | null;
      } | null;
      pricecharting: {
        loose_price_cents: number | null;
        graded_price_cents: number | null;
        psa_10_price_cents: number | null;
        psa_9_price_cents: number | null;
        url: string | null;
      } | null;
      ptcg_set_name?: string;
      ptcg_series?: string;
      ptcg_legalities?: Record<string, string>;
      tcgplayer_url?: string;
    }>(`/api/pricing/${cardId}`),

  getPokemonSets: (all?: boolean) =>
    http.get<never, {
      sets: Array<{
        id: string;
        name: string;
        series: string;
        printedTotal: number;
        total: number;
        releaseDate: string;
        images: { symbol: string; logo: string };
      }>;
    }>(`/api/sets/pokemon${all ? '?all=1' : ''}`),

  getSetChecklist: (setId: string) =>
    http.get<never, {
      set_id: string;
      total_count: number;
      owned_count: number;
      missing_count: number;
      completion_pct: number;
      cards: Array<{
        id: string;
        name: string;
        number: string;
        rarity: string;
        image: string;
        tcgplayer_price: number | null;
        owned: boolean;
        collection_item_id: number | null;
      }>;
    }>(`/api/sets/pokemon/${setId}/checklist`),

  getMetaDecks: (game: string) =>
    http.get<never, {
      game: string;
      decks: Array<{
        name: string;
        archetype: string;
        game: string;
        format: string;
        theme: string;
        description: string;
        key_cards: string[];
        strategy: string;
        estimated_budget_usd?: number | null;
        difficulty?: string | null;
        commander?: { name: string; category: string; cmc: number; search: string } | null;
        full_deck: Array<{ name: string; qty: number; category: string; search: string; isEvolution?: boolean; cmc?: number }>;
        main_deck: Array<{ name: string; qty: number; category: string; search: string; isEvolution?: boolean; cmc?: number }>;
        extra_deck: Array<{ name: string; qty: number; category: string; search: string }>;
        side_deck: Array<{ name: string; qty: number; category: string; search: string }>;
        sideboard: Array<{ name: string; qty: number; category: string; search: string; cmc?: number }>;
      }>;
    }>(`/api/meta/${game}`),

  analyzeDeck: (payload: {
    key_cards: string[];
    full_deck?: Array<{ name: string; qty: number; category: string; search: string }> | null;
    extra_deck?: Array<{ name: string; qty: number; category: string; search: string }> | null;
    side_deck?: Array<{ name: string; qty: number; category: string; search: string }> | null;
    sideboard?: Array<{ name: string; qty: number; category: string; search: string }> | null;
    game: string;
    deck_size: number;
  }) =>
    http.post<never, {
      have: CollectionItem[];
      need: Array<{
        name: string;
        qty: number;
        category: string;
        search: string;
        ebay_url: string;
        tcgplayer_url: string;
      }>;
      completion_pct: number;
      have_count: number;
      need_count: number;
      total_key_cards: number;
      main_deck: {
        have: CollectionItem[];
        need: Array<{ name: string; qty: number; category: string; search: string; ebay_url: string; tcgplayer_url: string }>;
        have_count: number;
        total_count: number;
      } | null;
      extra_deck: {
        have: CollectionItem[];
        need: Array<{ name: string; qty: number; category: string; search: string; ebay_url: string; tcgplayer_url: string }>;
        have_count: number;
        total_count: number;
      } | null;
      side_deck: {
        have: CollectionItem[];
        need: Array<{ name: string; qty: number; category: string; search: string; ebay_url: string; tcgplayer_url: string }>;
        have_count: number;
        total_count: number;
      } | null;
    }>('/api/deck/analyze', payload),

  saveDeck: (payload: { name: string; game: string; format: string; cards_json: string }) =>
    http.post<never, { id: number }>('/api/decks', payload),

  listSavedDecks: () =>
    http.get<never, Array<{
      id: number;
      name: string;
      game: string;
      format: string | null;
      archetype: string | null;
      cards_json: string;
      created_at: string;
    }>>('/api/decks'),

  listWishlist: () => http.get<never, WishlistItem[]>('/api/wishlist'),
  addWishlistItem: (payload: {
    ptcg_id: string
    name: string
    set_name?: string | null
    set_series?: string | null
    card_number?: string | null
    rarity?: string | null
    image_url?: string | null
    tcgplayer_price_cents?: number | null
    tcgplayer_url?: string | null
  }) => http.post<never, { added: boolean }>('/api/wishlist', payload),
  removeWishlistItem: (ptcgId: string) =>
    http.delete<never, { removed: boolean }>(`/api/wishlist/${encodeURIComponent(ptcgId)}`),
}
