import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/hooks'

function CheckIcon({ color = '#00E5FF' }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7.5" cy="7.5" r="7.5" fill={color} fillOpacity="0.15" />
      <path d="M4.5 7.5l2 2 4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 mt-0.5">
      <rect x="2.5" y="6.5" width="10" height="7" rx="1.5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <path d="M5 6.5V5a2.5 2.5 0 015 0v1.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

type BillingStatus = {
  tier: 'free' | 'pro'
  plan: 'free' | 'monthly' | 'yearly'
  billing_configured?: boolean
}

export default function MembershipPage() {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'yearly' | null>(null)
  const [error, setError] = useState('')

  const { data: billing } = useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn: () => api.getBillingStatus(),
    staleTime: 30_000,
    enabled: !!user,
  })

  const isPro = billing?.tier === 'pro'
  const isYearly = billing?.plan === 'yearly'
  const isMonthly = billing?.plan === 'monthly'
  const billingConfigured = billing?.billing_configured !== false

  async function handleSubscribe(plan: 'monthly' | 'yearly') {
    if (!user) {
      navigate('/register')
      return
    }
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

  const features = [
    { label: 'Search all Pokémon TCG products (cards, ETBs, tins, promos, bundles, etc.)', free: true, monthly: true, yearly: true },
    { label: 'Deck Builder (limited to 20 cards)', free: true, monthly: false, yearly: false },
    { label: 'Full Deck Builder (60-card decks, all formats)', free: false, monthly: true, yearly: true },
    { label: 'Manual card upload & collection tracking', free: true, monthly: true, yearly: true },
    { label: 'Unlimited collection size', free: false, monthly: true, yearly: true },
    { label: 'AI-powered binder sheet scan (9 cards at once)', free: false, monthly: true, yearly: true },
    { label: 'AI card identification & grading estimates', free: false, monthly: true, yearly: true },
    { label: 'Live eBay sold price comparisons', free: false, monthly: true, yearly: true },
    { label: 'AI deck generator from your collection', free: false, monthly: true, yearly: true },
    { label: 'Trades marketplace', free: false, monthly: true, yearly: true },
    { label: 'Set completion checklists', free: false, monthly: true, yearly: true },
    { label: 'Wishlist & want list', free: false, monthly: true, yearly: true },
    { label: 'Monthly product giveaway entry', free: false, monthly: true, yearly: true },
    { label: 'Early access to new features', free: false, monthly: false, yearly: true },
    { label: 'Priority support', free: false, monthly: false, yearly: true },
  ]

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center pt-4">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-cv-muted text-sm max-w-lg mx-auto">
          Card Safe HQ is free to start. Upgrade to Pro for AI-powered scanning, unlimited collection tracking, live price data, and more.
        </p>
        {!user && (
          <p className="text-xs text-cv-muted mt-2">
            Already have an account?{' '}
            <Link to="/login" className="text-[#00E5FF] hover:underline">Sign in</Link>
          </p>
        )}
      </div>

      {/* Current plan badge */}
      {user && billing && (
        <div className="glass p-3 rounded-[var(--radius-md)] text-center">
          <span className="text-sm text-cv-muted">Your current plan: </span>
          <span
            className="text-sm font-bold px-2 py-0.5 rounded-full ml-1"
            style={
              isYearly
                ? { background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }
                : isMonthly
                ? { background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }
                : { color: 'var(--cv-muted)' }
            }
          >
            {isYearly ? 'Pro Yearly' : isMonthly ? 'Pro Monthly' : 'Free'}
          </span>
          {isPro && (
            <Link to="/billing" className="ml-3 text-xs text-cv-muted hover:underline">
              Manage subscription →
            </Link>
          )}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Free */}
        <div className="glass p-5 rounded-[var(--radius-lg)] flex flex-col space-y-4"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-xl font-bold">Free</h2>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-3xl font-black">$0</span>
              <span className="text-cv-muted text-sm mb-0.5">/ forever</span>
            </div>
            <p className="text-xs text-cv-muted mt-1">No credit card required</p>
          </div>
          <div className="flex-1 space-y-2">
            {[
              'Search all TCG products',
              'Deck Builder (20 cards)',
              'Manual card upload',
              'Basic collection tracking',
            ].map(f => (
              <div key={f} className="flex items-start gap-2 text-sm text-cv-muted">
                <CheckIcon color="rgba(255,255,255,0.35)" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {!user ? (
            <Link to="/register" className="btn-secondary w-full text-center text-sm py-2.5">
              Get Started Free
            </Link>
          ) : !isPro ? (
            <div className="rounded-full border border-white/10 text-center py-2.5 text-sm text-cv-muted">
              Current Plan
            </div>
          ) : null}
        </div>

        {/* Monthly */}
        <div className="glass p-5 rounded-[var(--radius-lg)] flex flex-col space-y-4"
          style={{ border: '1px solid rgba(0,229,255,0.25)' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#00E5FF' }}>Pro Monthly</h2>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-3xl font-black">$10</span>
              <span className="text-cv-muted text-sm mb-0.5">/ month</span>
            </div>
            <p className="text-xs text-cv-muted mt-1">Cancel anytime</p>
          </div>
          <div className="flex-1 space-y-2">
            {[
              'Everything in Free',
              'Unlimited AI card scans',
              'AI grading estimates',
              'Live eBay price comps',
              'Full 60-card deck builder',
              'Trades marketplace',
              'Monthly product giveaway',
            ].map(f => (
              <div key={f} className="flex items-start gap-2 text-sm text-cv-muted">
                <CheckIcon color="#00E5FF" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {(!user || !isPro) && billingConfigured && (
            <button
              className="btn-primary w-full text-sm py-2.5"
              onClick={() => void handleSubscribe('monthly')}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === 'monthly' ? 'Redirecting...' : user ? 'Subscribe Monthly' : 'Sign Up & Subscribe'}
            </button>
          )}
          {isPro && isMonthly && (
            <div className="rounded-full text-center py-2.5 text-sm font-medium" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
              Current Plan ✓
            </div>
          )}
          {isPro && isYearly && (
            <div className="rounded-full border border-white/10 text-center py-2.5 text-sm text-cv-muted">
              Included in Yearly
            </div>
          )}
        </div>

        {/* Yearly */}
        <div className="flex flex-col space-y-4 p-5 rounded-[var(--radius-lg)] relative"
          style={{
            background: 'linear-gradient(145deg,rgba(0,229,255,0.03),rgba(201,168,76,0.07))',
            border: '1px solid rgba(201,168,76,0.4)',
          }}>
          <div className="absolute -top-3 left-4">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg,#C9A84C,#E8C76A)', color: '#080C10' }}>
              BEST VALUE — SAVE $20/YR
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#C9A84C' }}>Pro Yearly</h2>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-3xl font-black">$100</span>
              <span className="text-cv-muted text-sm mb-0.5">/ year</span>
            </div>
            <p className="text-xs text-cv-muted mt-1">~$8.33/mo · 2 months free vs monthly</p>
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
                <CheckIcon color="#C9A84C" />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {(!user || !isPro) && billingConfigured && (
            <button
              className="w-full py-2.5 px-4 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(90deg,#C9A84C,#E8C76A)', color: '#080C10' }}
              onClick={() => void handleSubscribe('yearly')}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === 'yearly' ? 'Redirecting...' : user ? 'Subscribe Yearly' : 'Sign Up & Subscribe'}
            </button>
          )}
          {isPro && isYearly && (
            <div className="rounded-full text-center py-2.5 text-sm font-bold" style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>
              Current Plan ✓
            </div>
          )}
          {isPro && isMonthly && billingConfigured && (
            <button
              className="w-full py-2.5 px-4 rounded-full text-sm font-bold"
              style={{ background: 'linear-gradient(90deg,#C9A84C,#E8C76A)', color: '#080C10' }}
              onClick={() => void handleSubscribe('yearly')}
              disabled={loadingPlan !== null}
            >
              Upgrade to Yearly
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-cv-danger text-center">{error}</p>}

      {!billingConfigured && user && (
        <div className="glass p-4 rounded-[var(--radius-md)] text-center">
          <p className="text-sm text-cv-muted">Paid upgrades are coming soon. Free plan features are fully available now.</p>
        </div>
      )}

      {/* Feature comparison table */}
      <div>
        <h2 className="text-lg font-bold mb-3 text-center">Full Feature Comparison</h2>
        <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
          <div className="grid text-xs font-semibold text-cv-muted border-b border-white/5"
            style={{ gridTemplateColumns: '1fr 80px 90px 90px' }}>
            <div className="p-3">Feature</div>
            <div className="p-3 text-center">Free</div>
            <div className="p-3 text-center" style={{ color: '#00E5FF' }}>Monthly</div>
            <div className="p-3 text-center" style={{ color: '#C9A84C' }}>Yearly</div>
          </div>
          {features.map(({ label, free, monthly, yearly }, i) => (
            <div
              key={label}
              className={`grid text-xs ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
              style={{ gridTemplateColumns: '1fr 80px 90px 90px' }}
            >
              <div className="p-3 text-cv-muted">{label}</div>
              <div className="p-3 flex justify-center">
                {free ? <CheckIcon color="rgba(255,255,255,0.4)" /> : <LockIcon />}
              </div>
              <div className="p-3 flex justify-center">
                {monthly ? <CheckIcon color="#00E5FF" /> : <LockIcon />}
              </div>
              <div className="p-3 flex justify-center">
                {yearly ? <CheckIcon color="#C9A84C" /> : <LockIcon />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ / trust */}
      <div className="glass p-5 rounded-[var(--radius-lg)] space-y-4">
        <h2 className="text-base font-semibold">Frequently Asked Questions</h2>
        {[
          {
            q: 'Do I need to sign up to use Card Safe HQ?',
            a: 'No! Search and the basic Deck Builder are available without an account. Sign up for free to start tracking your collection.',
          },
          {
            q: 'What payment methods do you accept?',
            a: 'We accept all major credit and debit cards through Stripe — Visa, Mastercard, American Express, and more.',
          },
          {
            q: 'Can I cancel anytime?',
            a: 'Yes. Cancel your subscription at any time from the billing portal. You keep Pro access until the end of your billing period.',
          },
          {
            q: 'How does the monthly giveaway work?',
            a: 'Every month, one Pro subscriber (monthly or yearly) wins a Pokémon TCG product. Winners are announced via email.',
          },
          {
            q: 'What does "early access" mean for yearly subscribers?',
            a: 'Yearly members get access to new features before they roll out to monthly subscribers — typically 2–4 weeks early.',
          },
        ].map(({ q, a }) => (
          <div key={q}>
            <p className="text-sm font-medium mb-1">{q}</p>
            <p className="text-sm text-cv-muted">{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
