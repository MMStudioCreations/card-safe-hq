import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowLeft, CheckCircle, XCircle, Ban, Star } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/hooks'
import type { TradeItem, TradeStatus } from '../lib/api'
import CardCrop from '../components/CardCrop'

const STATUS_COLORS: Record<TradeStatus, string> = {
  pending:   'bg-yellow-500/20 text-yellow-300',
  accepted:  'bg-green-500/20 text-green-300',
  declined:  'bg-red-500/20 text-red-300',
  cancelled: 'bg-zinc-500/20 text-zinc-400',
  completed: 'bg-blue-500/20 text-blue-300',
}

function TradeItemCard({ item }: { item: TradeItem }) {
  const apiBase = import.meta.env.VITE_API_URL ?? ''
  const name = item.card_name ?? item.player_name ?? 'Unknown Card'

  const bbox = (item.bbox_x != null && item.bbox_y != null)
    ? { x: item.bbox_x, y: item.bbox_y, width: item.bbox_width ?? 28, height: item.bbox_height ?? 28 }
    : null
  const isSheet = item.front_image_url?.includes('sheets/')

  const imageSection = isSheet && bbox ? (
    <CardCrop
      sheetUrl={`${apiBase}/api/images/${encodeURIComponent(item.front_image_url!)}`}
      bbox={bbox}
      alt={name}
      className="w-full h-full object-contain"
    />
  ) : item.front_image_url ? (
    <img
      src={`${apiBase}/api/images/${encodeURIComponent(item.front_image_url)}`}
      alt={name}
      className="w-full h-full object-contain object-center"
    />
  ) : (
    <div className="w-full h-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))]" />
  )

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-cv-surface p-3">
      <div className="h-12 w-9 rounded-[var(--radius-sm)] overflow-hidden bg-zinc-900 shrink-0">
        {imageSection}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{name}</p>
        {item.set_name && <p className="text-xs text-cv-muted truncate">{item.set_name}</p>}
        {item.estimated_value_cents != null && (
          <p className="text-xs text-cv-muted">${(item.estimated_value_cents / 100).toFixed(2)}</p>
        )}
      </div>
    </div>
  )
}

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: user } = useAuth()
  const queryClient = useQueryClient()

  const { data: trade, isLoading } = useQuery({
    queryKey: ['trade', id],
    queryFn: () => api.getTrade(id!),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: TradeStatus) => api.updateTradeStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade', id] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  if (isLoading) return <div className="glass p-6">Loading trade...</div>
  if (!trade) return <div className="glass p-6">Trade not found.</div>

  const tradeData = trade as any
  const isInitiator = tradeData.initiator_id === user?.id
  const isRecipient = tradeData.recipient_id === user?.id
  const status: TradeStatus = tradeData.status

  const offerItems: TradeItem[] = tradeData.items?.filter((i: TradeItem) => i.direction === 'offer') ?? []
  const requestItems: TradeItem[] = tradeData.items?.filter((i: TradeItem) => i.direction === 'request') ?? []

  const offerValue = offerItems.reduce((s, i) => s + (i.estimated_value_cents ?? 0), 0)
  const requestValue = requestItems.reduce((s, i) => s + (i.estimated_value_cents ?? 0), 0)

  const otherName = isInitiator
    ? (tradeData.recipient_username ?? tradeData.recipient_email)
    : (tradeData.initiator_username ?? tradeData.initiator_email)

  return (
    <div className="space-y-4 page-enter">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/trades')} className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-[var(--primary)]" />
          <h1 className="text-xl font-bold">Trade #{tradeData.id}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status]}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Parties */}
      <section className="glass p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-cv-muted mb-1">From (Initiator)</p>
            <p className="font-medium">{tradeData.initiator_username ?? tradeData.initiator_email}</p>
            {isInitiator && <span className="text-xs text-[var(--primary)]">You</span>}
          </div>
          <div>
            <p className="text-xs text-cv-muted mb-1">To (Recipient)</p>
            <p className="font-medium">{tradeData.recipient_username ?? tradeData.recipient_email}</p>
            {isRecipient && <span className="text-xs text-[var(--primary)]">You</span>}
          </div>
        </div>
        {tradeData.message && (
          <div className="mt-3 rounded-[var(--radius-md)] bg-cv-surface p-3">
            <p className="text-xs text-cv-muted mb-1">Message</p>
            <p className="text-sm">{tradeData.message}</p>
          </div>
        )}
        <p className="mt-2 text-xs text-cv-muted">
          Created {new Date(tradeData.created_at).toLocaleDateString()} ·
          Updated {new Date(tradeData.updated_at).toLocaleDateString()}
        </p>
      </section>

      {/* Items */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="glass p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">
              {isInitiator ? 'You Offer' : `${tradeData.initiator_username ?? 'Initiator'} Offers`}
            </h2>
            <span className="text-xs text-cv-muted">${(offerValue / 100).toFixed(2)} est.</span>
          </div>
          <div className="space-y-2">
            {offerItems.length === 0
              ? <p className="text-xs text-cv-muted">No items</p>
              : offerItems.map((item) => <TradeItemCard key={item.id} item={item} />)
            }
          </div>
        </section>

        <section className="glass p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">
              {isRecipient ? 'Your Cards Requested' : `${tradeData.recipient_username ?? 'Recipient'}'s Cards Requested`}
            </h2>
            <span className="text-xs text-cv-muted">${(requestValue / 100).toFixed(2)} est.</span>
          </div>
          <div className="space-y-2">
            {requestItems.length === 0
              ? <p className="text-xs text-cv-muted">No items</p>
              : requestItems.map((item) => <TradeItemCard key={item.id} item={item} />)
            }
          </div>
        </section>
      </div>

      {/* Value comparison */}
      <section className="glass p-4">
        <h2 className="text-sm font-semibold mb-2">Value Comparison</h2>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-xs text-cv-muted">Offered</p>
            <p className="font-bold text-[var(--primary)]">${(offerValue / 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Difference</p>
            <p className={`font-bold ${offerValue >= requestValue ? 'text-green-400' : 'text-red-400'}`}>
              {offerValue >= requestValue ? '+' : ''}{((offerValue - requestValue) / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Requested</p>
            <p className="font-bold text-amber-300">${(requestValue / 100).toFixed(2)}</p>
          </div>
        </div>
      </section>

      {/* Action buttons */}
      {statusMutation.isError && (
        <div className="rounded-[var(--radius-md)] border border-cv-danger/50 bg-cv-danger/10 p-3 text-sm text-cv-danger">
          {(statusMutation.error as Error).message}
        </div>
      )}

      <section className="glass p-4">
        <div className="flex flex-wrap gap-2">
          {/* Recipient actions on pending trade */}
          {isRecipient && status === 'pending' && (
            <>
              <button
                type="button"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('accepted')}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-green-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition disabled:opacity-40"
              >
                <CheckCircle className="h-4 w-4" /> Accept
              </button>
              <button
                type="button"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('declined')}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-red-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-40"
              >
                <XCircle className="h-4 w-4" /> Decline
              </button>
            </>
          )}
          {/* Initiator can cancel pending trade */}
          {isInitiator && status === 'pending' && (
            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => {
                if (confirm('Cancel this trade offer?')) statusMutation.mutate('cancelled')
              }}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-zinc-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 transition disabled:opacity-40"
            >
              <Ban className="h-4 w-4" /> Cancel
            </button>
          )}
          {/* Recipient can mark accepted trade as completed */}
          {isRecipient && status === 'accepted' && (
            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate('completed')}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-blue-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition disabled:opacity-40"
            >
              <Star className="h-4 w-4" /> Mark Completed
            </button>
          )}
          {['declined', 'cancelled', 'completed'].includes(status) && (
            <p className="text-sm text-cv-muted self-center">
              This trade is {status} and no further actions are available.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
