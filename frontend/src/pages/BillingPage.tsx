import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

type BillingStatus = {
  tier: 'free' | 'pro'
  plan: 'free' | 'monthly' | 'yearly'
  status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  billing_configured?: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function CheckIcon({ color = '#D4AF37' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7" cy="7" r="7" fill={color} fillOpacity="0.15" />
      <path d="M4 7l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <rect x="2" y="6" width="10" height="7" rx="1.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
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
  const isYearly = billing?.plan === 'yearly'
  const isMonthly = billing?.plan === 'monthly'
  const billingConfigured = billing?.billing_configured !== false

  return (
    <div className="space-y-6 pb-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-sm text-cv-muted mt-1">
          Choose the plan that fits your collection. Upgrade anytime.
        </p>
      </div>

      {/* Success / canceled banners */}
      {successParam && (
        <div className="glass border border-[rgba(78,203,160,0.3)] p-4 rounded-[var(--radius-md)]">
          <p className="text-sm font-medium" style={{ color: '#4ECBA0' }}>
            🎉 You're now a Pro member — thank you for supporting Card Safe HQ!
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
        <div className="glass p-4 space-y-2 rounded-[var(--radius-md)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-cv-muted">Current plan</span>
            <span
              className="text-sm font-bold px-2 py-0.5 rounded-full"
              style={
                isYearly
                  ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }
                  : isMonthly
                  ? { background: 'rgba(212,175,55,0.10)', color: '#D4AF37' }
                  : { color: 'var(--cv-muted)' }
              }
            >
              {isYearly ? 'Pro Yearly' : isMonthly ? 'Pro Monthly' : 'Free'}
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

      {/* Plan comparison table */}
      <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
        <div className="grid text-xs font-semibold text-cv-muted border-b border-white/5" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
          <div className="p-3">Feature</div>
          <div className="p-3 text-center w-16">Free</div>
          <div className="p-3 text-center w-20" style={{ color: '#D4AF37' }}>Monthly</div>
          <div className="p-3 text-center w-20" style={{ color: '#D4AF37' }}>Yearly</div>
        </div>
        {[
          { feature: 'Search — cards, ETBs, tins, promos, all TCG products', free: true, monthly: true, yearly: true },
          { feature: 'Single card scan (manual identification)', free: true, monthly: true, yearly: true },
          { feature: 'Basic collection tracking', free: true, monthly: true, yearly: true },
          { feature: 'Limited deck builder (up to 20 cards)', free: true, monthly: true, yearly: true },
          { feature: 'Unlimited collection', free: false, monthly: true, yearly: true },
          { feature: 'AI-powered binder sheet scan (9 cards at once)', free: false, monthly: true, yearly: true },
          { feature: 'AI card identification & grading estimates', free: false, monthly: true, yearly: true },
          { feature: 'Live eBay sold price comparisons', free: false, monthly: true, yearly: true },
          { feature: 'Full deck builder (60-card decks)', free: false, monthly: true, yearly: true },
          { feature: 'AI deck generator from your collection', free: false, monthly: true, yearly: true },
          { feature: 'Trades marketplace', free: false, monthly: true, yearly: true },
          { feature: 'Set completion checklists', free: false, monthly: true, yearly: true },
          { feature: 'Wishlist & want list', free: false, monthly: true, yearly: true },
          { feature: 'Monthly product giveaway entry', free: false, monthly: true, yearly: true },
          { feature: 'Early access to new features', free: false, monthly: false, yearly: true },
          { feature: 'Priority support', free: false, monthly: false, yearly: true },
        ].map(({ feature, free, monthly, yearly }, i) => (
          <div
            key={feature}
            className={`grid text-sm ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
            style={{ gridTemplateColumns: '1fr auto auto auto' }}
          >
            <div className="p-3 text-cv-muted text-xs">{feature}</div>
            <div className="p-3 flex justify-center w-16">
              {free ? <CheckIcon color="rgba(255,255,255,0.4)" /> : <LockIcon />}
            </div>
            <div className="p-3 flex justify-center w-20">
              {monthly ? <CheckIcon color="#D4AF37" /> : <LockIcon />}
            </div>
            <div className="p-3 flex justify-center w-20">
              {yearly ? <CheckIcon color="#D4AF37" /> : <LockIcon />}
            </div>
          </div>
        ))}
      </div>

      {/* Plan cards */}
      {!isPro && billingConfigured && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Monthly */}
          <div className="glass p-5 space-y-4 flex flex-col rounded-[var(--radius-lg)]"
            style={{ border: '1px solid rgba(0,229,255,0.2)' }}>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#D4AF37' }}>Pro Monthly</h2>
              <p className="text-sm text-cv-muted mt-0.5">Billed every month. Cancel anytime.</p>
            </div>
            <div className="flex-1 space-y-2">
              {[
                'Unlimited AI card scans',
                'AI grading estimates',
                'Live eBay price comps',
                'Full deck builder',
                'Trades marketplace',
                'Monthly product giveaway',
              ].map(f => (
                <div key={f} className="flex items-start gap-2 text-sm text-cv-muted">
                  <CheckIcon color="#D4AF37" />
                  <span>{f}</span>
                </div>
              ))}
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
          <div className="flex flex-col space-y-4 p-5 rounded-[var(--radius-lg)] relative"
            style={{ background: 'linear-gradient(145deg,rgba(0,229,255,0.04),rgba(201,168,76,0.08))', border: '1px solid rgba(201,168,76,0.35)' }}>
            <div className="absolute -top-3 left-4">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg,#D4AF37,#D4AF37)', color: '#0A0A0C' }}>
                BEST VALUE
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#D4AF37' }}>Pro Yearly</h2>
              <p className="text-sm text-cv-muted mt-0.5">Billed once per year — ~2 months free.</p>
            </div>
            <div className="flex-1 space-y-2">
              {[
                'Everything in Monthly',
                '~2 months free vs monthly',
                'Early access to new features',
                'Priority support',
                'Monthly product giveaway',
              ].map(f => (
                <div key={f} className="flex items-start gap-2 text-sm text-cv-muted">
                  <CheckIcon color="#D4AF37" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <button
              className="w-full mt-2 py-2.5 px-4 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(90deg,#D4AF37,#D4AF37)', color: '#0A0A0C' }}
              onClick={() => void handleSubscribe('yearly')}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === 'yearly' ? 'Redirecting...' : 'Subscribe Yearly'}
            </button>
          </div>
        </div>
      )}

      {/* Already Pro — upgrade to yearly if on monthly */}
      {isPro && isMonthly && billingConfigured && (
        <div className="glass p-5 rounded-[var(--radius-lg)]"
          style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
          <h2 className="text-base font-semibold mb-1" style={{ color: '#D4AF37' }}>Upgrade to Yearly</h2>
          <p className="text-sm text-cv-muted mb-3">
            Switch to yearly and get early access to new features, priority support, and save ~2 months.
          </p>
          <button
            className="py-2 px-5 rounded-full text-sm font-bold"
            style={{ background: 'linear-gradient(90deg,#D4AF37,#D4AF37)', color: '#0A0A0C' }}
            onClick={() => void handleSubscribe('yearly')}
            disabled={loadingPlan !== null}
          >
            {loadingPlan === 'yearly' ? 'Redirecting...' : 'Upgrade to Yearly'}
          </button>
        </div>
      )}

      {/* Yearly perks banner */}
      {isPro && isYearly && (
        <div className="glass p-4 rounded-[var(--radius-md)]"
          style={{ border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#D4AF37' }}>Yearly Member Perks</p>
          <div className="space-y-1.5 text-sm text-cv-muted">
            <div className="flex items-center gap-2"><CheckIcon color="#D4AF37" /><span>Early access to new features before monthly members</span></div>
            <div className="flex items-center gap-2"><CheckIcon color="#D4AF37" /><span>Monthly product giveaway — check your email each month</span></div>
            <div className="flex items-center gap-2"><CheckIcon color="#D4AF37" /><span>Priority support response</span></div>
          </div>
        </div>
      )}

      {/* Monthly perks banner */}
      {isPro && isMonthly && (
        <div className="glass p-4 rounded-[var(--radius-md)]"
          style={{ border: '1px solid rgba(0,229,255,0.15)', background: 'rgba(0,229,255,0.03)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#D4AF37' }}>Monthly Member Perks</p>
          <div className="space-y-1.5 text-sm text-cv-muted">
            <div className="flex items-center gap-2"><CheckIcon color="#D4AF37" /><span>Monthly product giveaway — check your email each month</span></div>
            <div className="flex items-center gap-2"><CheckIcon color="#D4AF37" /><span>All Pro features unlocked</span></div>
          </div>
        </div>
      )}

      {/* Manage subscription */}
      {isPro && (
        <div className="glass p-4 space-y-3 rounded-[var(--radius-md)]">
          <h2 className="text-base font-semibold">Manage subscription</h2>
          <p className="text-sm text-cv-muted">
            Update your payment method, download invoices, or cancel through the Stripe billing portal.
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

      {!billingConfigured && (
        <div className="glass p-4 rounded-[var(--radius-md)]">
          <p className="text-sm text-cv-muted">Paid upgrades are not available yet. Free plan features remain fully available.</p>
        </div>
      )}

      {error && <p className="text-sm text-cv-danger">{error}</p>}

      {/* Free tier info */}
      <div className="glass p-4 rounded-[var(--radius-md)]">
        <h2 className="text-base font-semibold mb-2">Free Tier</h2>
        <p className="text-sm text-cv-muted leading-relaxed">
          Card Safe HQ offers a free tier so every collector can get started. Free accounts include search across all Pokémon TCG products, single card scanning (no AI), basic collection tracking, and a limited deck builder. Upgrade to Pro to unlock AI-powered scanning, grading, live price data, and more.
        </p>
      </div>
    </div>
  )
}
