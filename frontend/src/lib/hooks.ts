import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export const queryKeys = {
  auth: ['auth'] as const,
  collection: (confirmed?: boolean) => ['collection', confirmed] as const,
  collectionItem: (id?: number | string) => ['collection-item', id] as const,
  card: (id?: number | string) => ['card', id] as const,
  comps: (cardId?: number | string) => ['comps', cardId] as const,
  grade: (collectionItemId?: number | string) => ['grade', collectionItemId] as const,
}

export function useAuth() {
  return useQuery({
    queryKey: queryKeys.auth,
    queryFn: () => api.me(),
    retry: false,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCollection(confirmed?: boolean) {
  return useQuery({
    queryKey: queryKeys.collection(confirmed),
    queryFn: () => api.listCollection(confirmed),
  })
}

export function useCollectionItem(id?: number | string) {
  return useQuery({
    queryKey: queryKeys.collectionItem(id),
    queryFn: () => api.getCollectionItem(id as number | string),
    enabled: Boolean(id),
  })
}

export function useCard(id?: number | string) {
  return useQuery({
    queryKey: queryKeys.card(id),
    queryFn: () => api.getCard(id as number | string),
    enabled: Boolean(id),
  })
}

export function useComps(cardId?: number | string) {
  return useQuery({
    queryKey: queryKeys.comps(cardId),
    queryFn: () => api.getComps(cardId as number | string),
    enabled: Boolean(cardId),
  })
}

export function useGrade(collectionItemId?: number | string) {
  return useQuery({
    queryKey: queryKeys.grade(collectionItemId),
    queryFn: () => api.getGrade(collectionItemId as number | string),
    enabled: Boolean(collectionItemId),
    retry: false,
  })
}

export function useCompsHistory(cardId: number | undefined) {
  return useQuery({
    queryKey: ['comps-history', cardId],
    queryFn: () => api.getCompsHistory(cardId!),
    enabled: cardId != null,
  })
}
