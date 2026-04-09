import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

type BillingStatus = {
  tier: 'free' | 'pro'
  status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingPage() {
  const [searchParams] = useSearchParams()
  const successParam = searchParams.get('success')
  const canceledParam = searchParams.get('canceled')

  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'yearly' | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [error, setError] = useState('')

  const { data: billing, isLoading, refetch } = useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn: () => api.getBillingStatus(),
    staleTime: 30_000,
  })

  // Refetch after returning from Stripe
  useEffect(() => {
    if (successParam) void refetch()
  }, [successParam, refetch])

  async function handleSubscribe(plan: 'monthly' | 'yearly') {
    setError('')
    setLoadingPlan(plan)
    try {
      const { url } = await api.createCheckoutSession(plan)
      window.location.href = url
    } catch (err) {
      setError((err as Error).message)
      setLoadingPlan(null)
    }
  }

  async function handleManage() {
    setError('')
    setLoadingPortal(true)
    try {
      const { url } = await api.createPortalSession()
      window.location.href = url
    } catch (err) {
      setError((err as Error).message)
      setLoadingPortal(false)
    }
  }

  const isPro = billing?.tier === 'pro'

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-sm text-cv-muted mt-1">
          Support Card Safe HQ and unlock Pro features for your collection.
        </p>
      </div>

      {/* Success / canceled banners */}
      {successParam && (
        <div className="glass border border-[rgba(78,203,160,0.3)] p-4 rounded-[var(--radius-md)]">
          <p className="text-sm font-medium" style={{ color: '#4ECBA0' }}>
            You're now a Pro member — thank you for supporting Card Safe HQ!
          </p>
        </div>
      )}
      {canceledParam && (
        <div className="glass border border-[rgba(240,96,96,0.2)] p-4 rounded-[var(--radius-md)]">
          <p className="text-sm text-cv-muted">Checkout was canceled. No charge was made.</p>
        </div>
      )}

      {/* Current status */}
      {!isLoading && billing && (
        <div className="glass p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-cv-muted">Current plan</span>
            <span className={`text-sm font-bold ${isPro ? '' : 'text-cv-muted'}`}
              style={isPro ? { color: '#C9A84C' } : {}}>
              {isPro ? 'Pro' : 'Free'}
            </span>
          </div>
          {isPro && billing.status && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-cv-muted">Status</span>
              <span className="text-sm capitalize">{billing.status.replace('_', ' ')}</span>
            </div>
          )}
          {isPro && billing.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-cv-muted">
                {billing.cancel_at_period_end ? 'Access until' : 'Renews on'}
              </span>
              <span className="text-sm">{formatDate(billing.current_period_end)}</span>
            </div>
          )}
          {isPro && billing.cancel_at_period_end && (
            <p className="text-xs text-cv-muted pt-1">
              Your subscription will not renew. You'll keep Pro access until the date above.
            </p>
          )}
        </div>
      )}

      {/* Plan cards */}
      {!isPro && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Monthly */}
          <div className="glass p-5 space-y-3 flex flex-col">
            <div>
              <h2 className="text-lg font-bold">Pro Monthly</h2>
              <p className="text-sm text-cv-muted">Billed every month. Cancel anytime.</p>
            </div>
            <div className="flex-1">
              <ul className="space-y-1.5 text-sm text-cv-muted">
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00E5FF' }}>✓</span> Unlimited card scans
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00E5FF' }}>✓</span> AI grading estimates
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00E5FF' }}>✓</span> Live eBay price comps
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00E5FF' }}>✓</span> Full deck builder
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00E5FF' }}>✓</span> Trades marketplace
                </li>
              </ul>
            </div>
            <button
              className="btn-primary w-full mt-2"
              onClick={() => void handleSubscribe('monthly')}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === 'monthly' ? 'Redirecting...' : 'Subscribe Monthly'}
            </button>
          </div>

          {/* Yearly */}
          <div className="flex flex-col space-y-3 p-5 rounded-[var(--radius-lg)] relative"
            style={{ background: 'linear-gradient(145deg,rgba(0,229,255,0.06),rgba(201,168,76,0.06))', border: '1px solid rgba(201,168,76,0.3)' }}>
            <div className="absolute -top-3 left-4">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg,#C9A84C,#E8C76A)', color: '#080C10' }}>
                BEST VALUE
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Pro Yearly</h2>
              <p className="text-sm text-cv-muted">Billed once per year. Best value.</p>
            </div>
            <div className="flex-1">
              <ul className="space-y-1.5 text-sm text-cv-muted">
                <li className="flex items-center gap-2">
                  <span style={{ color: '#C9A84C' }}>✓</span> Everything in Monthly
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#C9A84C' }}>✓</span> ~2 months free vs monthly
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#C9A84C' }}>✓</span> Priority support
                </li>
              </ul>
            </div>
            <button
              className="w-full mt-2 py-2.5 px-4 rounded-full text-sm font-bold transition-opacity"
              style={{ background: 'linear-gradient(90deg,#C9A84C,#E8C76A)', color: '#080C10' }}
              onClick={() => void handleSubscribe('yearly')}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === 'yearly' ? 'Redirecting...' : 'Subscribe Yearly'}
            </button>
          </div>
        </div>
      )}

      {/* Manage subscription */}
      {isPro && (
        <div className="glass p-4 space-y-3">
          <h2 className="text-base font-semibold">Manage subscription</h2>
          <p className="text-sm text-cv-muted">
            Update your payment method, download invoices, or cancel your subscription through the Stripe billing portal.
          </p>
          <button
            className="btn-secondary"
            onClick={() => void handleManage()}
            disabled={loadingPortal}
          >
            {loadingPortal ? 'Opening portal...' : 'Open billing portal'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-cv-danger">{error}</p>}

      {/* Free tier info */}
      <div className="glass p-4">
        <h2 className="text-base font-semibold mb-2">Free tier</h2>
        <p className="text-sm text-cv-muted leading-relaxed">
          Card Safe HQ offers a free tier so every collector can get started. Free accounts include basic collection tracking, manual card entry, and limited scans per month. A Pro subscription helps cover Cloudflare and AI costs that power the platform for everyone.
        </p>
      </div>
    </div>
  )
}
