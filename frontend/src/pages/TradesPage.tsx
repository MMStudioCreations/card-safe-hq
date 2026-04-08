import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/hooks'
import type { TradeRow, TradeStatus } from '../lib/api'

const STATUS_COLORS: Record<TradeStatus, string> = {
  pending:   'bg-yellow-500/20 text-yellow-300',
  accepted:  'bg-green-500/20 text-green-300',
  declined:  'bg-red-500/20 text-red-300',
  cancelled: 'bg-zinc-500/20 text-zinc-400',
  completed: 'bg-blue-500/20 text-blue-300',
}

export default function TradesPage() {
  const { data: user } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<TradeStatus | 'all'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => api.listTrades(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTrade(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  })

  const trades: TradeRow[] = (data as any) ?? []
  const filtered = filter === 'all' ? trades : trades.filter((t) => t.status === filter)

  const sent     = trades.filter((t) => t.initiator_id === user?.id)
  const received = trades.filter((t) => t.recipient_id === user?.id)
  const pending  = trades.filter((t) => t.status === 'pending')

  if (isLoading) return <div className="glass p-6">Loading trades...</div>

  return (
    <div className="space-y-4 page-enter">
      {/* Stats */}
      <section className="glass p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-cv-muted">Total Trades</p>
            <p className="text-2xl font-bold">{trades.length}</p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Pending</p>
            <p className="text-2xl font-bold text-yellow-300">{pending.length}</p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Sent / Received</p>
            <p className="text-2xl font-bold">{sent.length} / {received.length}</p>
          </div>
        </div>
      </section>

      {/* Header + filter */}
      <section className="glass p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-[var(--primary)]" />
            Trade Offers
          </h2>
          <Link to="/trades/new" className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="h-4 w-4" /> New Trade
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'accepted', 'declined', 'cancelled', 'completed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition capitalize ${
                filter === s
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-cv-surface text-cv-muted hover:text-cv-text'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="glass p-8 text-center">
          <p className="text-lg font-semibold mb-2">No trades yet</p>
          <p className="text-sm text-cv-muted mb-4">
            Create a trade offer to propose swapping cards with another collector.
          </p>
          <Link to="/trades/new" className="btn-primary">
            Create your first trade
          </Link>
        </section>
      ) : (
        <section className="space-y-2">
          {filtered.map((trade) => {
            const isSent = trade.initiator_id === user?.id
            const other = isSent
              ? (trade.recipient_username ?? trade.recipient_email)
              : (trade.initiator_username ?? trade.initiator_email)

            return (
              <div key={trade.id} className="glass p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[trade.status]}`}>
                      {trade.status}
                    </span>
                    <span className="text-xs text-cv-muted">
                      {isSent ? `→ To: ${other}` : `← From: ${other}`}
                    </span>
                  </div>
                  {trade.message && (
                    <p className="text-xs text-cv-muted truncate">{trade.message}</p>
                  )}
                  <p className="text-xs text-cv-muted mt-0.5">
                    {new Date(trade.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/trades/${trade.id}`}
                    className="rounded-[var(--radius-sm)] bg-cv-surface px-3 py-1.5 text-xs font-medium hover:text-cv-text text-cv-muted transition"
                  >
                    View
                  </Link>
                  {isSent && trade.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this trade offer?')) deleteMutation.mutate(trade.id)
                      }}
                      className="rounded-[var(--radius-sm)] bg-red-600/20 p-1.5 text-red-400 hover:bg-red-600/40 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
