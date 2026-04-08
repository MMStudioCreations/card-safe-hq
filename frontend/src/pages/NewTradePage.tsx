import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowLeft, Plus, Minus } from 'lucide-react'
import { api } from '../lib/api'
import { useCollection } from '../lib/hooks'
import type { CollectionItem } from '../lib/api'

export default function NewTradePage() {
  const navigate = useNavigate()
  const { data: myCollection = [] } = useCollection(true)

  const [recipientId, setRecipientId] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [offerIds, setOfferIds] = useState<number[]>([])
  const [requestIds, setRequestIds] = useState<number[]>([])
  const [recipientCollection, setRecipientCollection] = useState<CollectionItem[]>([])
  const [loadingRecipient, setLoadingRecipient] = useState(false)
  const [recipientError, setRecipientError] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTrade({
        recipient_id: Number(recipientId),
        offer_item_ids: offerIds,
        request_item_ids: requestIds,
        message: message.trim() || undefined,
      }),
    onSuccess: (data: any) => {
      navigate(`/trades/${data.trade_id}`)
    },
  })

  function toggleId(list: number[], setList: (v: number[]) => void, id: number) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function lookupRecipient() {
    if (!recipientEmail.trim()) return
    setLoadingRecipient(true)
    setRecipientError('')
    setRecipientCollection([])
    try {
      // We use the admin users endpoint to find user by email — fallback: user must know the ID
      // For now, we ask the user to enter the numeric user ID directly
      setRecipientError('Enter the recipient\'s numeric user ID in the field above, then click Load Collection.')
    } catch {
      setRecipientError('Could not load recipient.')
    } finally {
      setLoadingRecipient(false)
    }
  }

  async function loadRecipientCollection() {
    if (!recipientId || isNaN(Number(recipientId))) {
      setRecipientError('Enter a valid numeric user ID')
      return
    }
    setLoadingRecipient(true)
    setRecipientError('')
    try {
      // We can't directly list another user's collection from the frontend
      // without a public endpoint. For now, show a placeholder message.
      // In a full implementation, a /api/users/:id/collection public endpoint would be needed.
      setRecipientCollection([])
      setRecipientError('Public collection browsing is not yet available. Enter item IDs manually or ask the recipient to share their collection item IDs.')
    } catch {
      setRecipientError('Could not load recipient collection.')
    } finally {
      setLoadingRecipient(false)
    }
  }

  const [manualRequestId, setManualRequestId] = useState('')

  function addManualRequestId() {
    const id = Number(manualRequestId.trim())
    if (!id || isNaN(id)) return
    if (!requestIds.includes(id)) setRequestIds([...requestIds, id])
    setManualRequestId('')
  }

  const apiBase = import.meta.env.VITE_API_URL ?? ''

  return (
    <div className="space-y-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/trades')} className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-[var(--primary)]" />
          <h1 className="text-xl font-bold">New Trade Offer</h1>
        </div>
      </div>

      {/* Recipient */}
      <section className="glass p-4 space-y-3">
        <h2 className="font-semibold">Recipient</h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="number"
            placeholder="Recipient user ID"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={loadRecipientCollection}
            disabled={loadingRecipient}
          >
            {loadingRecipient ? 'Loading...' : 'Load Collection'}
          </button>
        </div>
        {recipientError && (
          <p className="text-xs text-amber-400">{recipientError}</p>
        )}
      </section>

      {/* Your items to offer */}
      <section className="glass p-4">
        <h2 className="font-semibold mb-3">
          Your Items to Offer
          {offerIds.length > 0 && (
            <span className="ml-2 text-xs text-[var(--primary)]">{offerIds.length} selected</span>
          )}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(myCollection as CollectionItem[]).map((item) => {
            const name = item.card_name ?? item.player_name ?? 'Unknown'
            const selected = offerIds.includes(item.id)
            const imageUrl = item.front_image_url
              ? `${apiBase}/api/images/${encodeURIComponent(item.front_image_url)}`
              : null
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleId(offerIds, setOfferIds, item.id)}
                className={`glass text-left p-2 transition ${selected ? 'ring-2 ring-[var(--primary)]' : ''}`}
              >
                <div className="w-full rounded overflow-hidden bg-zinc-900 mb-2" style={{ aspectRatio: '2.5/3.5' }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={name} className="w-full h-full object-contain object-center" />
                  ) : (
                    <div className="w-full h-full bg-[linear-gradient(135deg,var(--primary),var(--secondary))]" />
                  )}
                </div>
                <p className="text-xs font-medium truncate">{name}</p>
                {item.estimated_value_cents != null && (
                  <p className="text-xs text-cv-muted">${(item.estimated_value_cents / 100).toFixed(2)}</p>
                )}
                {selected && (
                  <div className="mt-1 flex items-center gap-1 text-[var(--primary)] text-xs">
                    <Minus className="h-3 w-3" /> Remove
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {myCollection.length === 0 && (
          <p className="text-sm text-cv-muted">Your collection is empty.</p>
        )}
      </section>

      {/* Items to request */}
      <section className="glass p-4">
        <h2 className="font-semibold mb-3">
          Items to Request
          {requestIds.length > 0 && (
            <span className="ml-2 text-xs text-[var(--primary)]">{requestIds.length} selected</span>
          )}
        </h2>
        <p className="text-xs text-cv-muted mb-3">
          Enter the collection item IDs of the cards you want from the recipient.
          Ask the recipient to share their item IDs from their collection.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            className="input flex-1"
            type="number"
            placeholder="Collection item ID"
            value={manualRequestId}
            onChange={(e) => setManualRequestId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManualRequestId()}
          />
          <button type="button" className="btn-ghost text-sm" onClick={addManualRequestId}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {requestIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {requestIds.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-xs text-[var(--primary)]"
              >
                #{id}
                <button
                  type="button"
                  onClick={() => setRequestIds(requestIds.filter((x) => x !== id))}
                  className="hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Message */}
      <section className="glass p-4">
        <h2 className="font-semibold mb-2">Message (optional)</h2>
        <textarea
          className="input w-full resize-none"
          rows={3}
          placeholder="Add a note to the recipient..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </section>

      {/* Submit */}
      {createMutation.isError && (
        <div className="rounded-[var(--radius-md)] border border-cv-danger/50 bg-cv-danger/10 p-3 text-sm text-cv-danger">
          {(createMutation.error as Error).message}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={
            !recipientId ||
            offerIds.length === 0 ||
            requestIds.length === 0 ||
            createMutation.isPending
          }
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Sending...' : 'Send Trade Offer'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => navigate('/trades')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
