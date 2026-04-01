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
}

export type SalesComp = {
  id: number
  source?: string
  title: string
  sold_price_cents: number
  sold_date?: string
  sold_platform?: string
  listing_url?: string
  condition_text?: string
}

export type CompsResponse = {
  cardId?: number
  low: number
  avg: number
  high: number
  count: number
  lastSynced?: string
  activeCount?: number
  activeLow?: number
  activeHigh?: number
  sold?: SalesComp[]
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

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://card-vault-ai.michaelamarino16.workers.dev',
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

  listReleases: () => http.get<never, Release[]>('/api/releases'),
  createRelease: (payload: Omit<Release, 'id' | 'created_at'>) =>
    http.post<never, Release>('/api/releases', payload),
  getRelease: (id: number | string) => http.get<never, Release>(`/api/releases/${id}`),
}
