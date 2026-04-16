/**
 * ProGate.tsx
 *
 * A reusable upgrade prompt shown when a free user hits a Pro-gated limit.
 * Renders a gold-bordered card with a crown icon, the limit message, and
 * buttons to subscribe monthly or yearly.
 *
 * Usage:
 *   const [proError, setProError] = useState<string | null>(null)
 *   // In your catch block:
 *   if ((err as any).code === 'pro_required') setProError((err as Error).message)
 *   // In JSX:
 *   {proError && <ProGate message={proError} onDismiss={() => setProError(null)} />}
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

interface ProGateProps {
  /** The limit message from the API, e.g. "Free accounts are limited to 1,000 items." */
  message?: string
  /** Called when the user dismisses the prompt */
  onDismiss?: () => void
  /** Optional custom title */
  title?: string
}

export default function ProGate({ message, onDismiss, title }: ProGateProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null)
  const [err, setErr] = useState('')

  async function handleSubscribe(plan: 'monthly' | 'yearly') {
    setErr('')
    setLoading(plan)
    try {
      const { url } = await api.createCheckoutSession(plan)
      window.location.href = url
    } catch (e) {
      setErr((e as Error).message)
      setLoading(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onDismiss}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{
          background: 'linear-gradient(145deg,rgba(10,10,12,0.98),rgba(20,18,14,0.98))',
          border: '1px solid rgba(212,175,55,0.45)',
          boxShadow: '0 0 40px rgba(212,175,55,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Crown icon */}
        <div className="flex justify-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 17h20l-2-9-5 5-3-7-3 7-5-5-2 9z"
                fill="rgba(212,175,55,0.9)"
                stroke="rgba(212,175,55,0.6)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <rect x="2" y="17" width="20" height="2" rx="1" fill="rgba(212,175,55,0.7)" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-lg font-bold" style={{ color: '#D4AF37' }}>
            {title ?? 'Upgrade to Pro'}
          </h2>
          <p className="text-sm text-cv-muted mt-1 leading-relaxed">
            {message ?? 'This feature requires a Card Safe HQ Pro subscription.'}
          </p>
        </div>

        {/* Feature highlights */}
        <div className="space-y-2 py-1">
          {[
            'Unlimited collection storage',
            'Unlimited active trades',
            'Live eBay sold price comps',
            'AI card scanning & grading',
            'Full deck builder',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-cv-muted">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <circle cx="7" cy="7" r="7" fill="rgba(212,175,55,0.15)" />
                <path d="M4 7l2 2 4-4" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* Pricing buttons */}
        <div className="space-y-2 pt-1">
          <button
            className="w-full py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(90deg,#D4AF37,#C9A84C)', color: '#0A0A0C' }}
            onClick={() => void handleSubscribe('monthly')}
            disabled={loading !== null}
          >
            {loading === 'monthly' ? 'Redirecting...' : 'Subscribe Monthly — $5/mo'}
          </button>
          <button
            className="w-full py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
            onClick={() => void handleSubscribe('yearly')}
            disabled={loading !== null}
          >
            {loading === 'yearly' ? 'Redirecting...' : 'Subscribe Yearly — $45/yr (save 25%)'}
          </button>
          <button
            className="w-full py-2 text-sm text-cv-muted hover:text-white transition-colors"
            onClick={() => { navigate('/billing'); onDismiss?.() }}
          >
            View full plan comparison
          </button>
        </div>

        {err && <p className="text-xs text-cv-danger text-center">{err}</p>}

        {/* Dismiss */}
        {onDismiss && (
          <button
            className="absolute top-3 right-3 text-cv-muted hover:text-white transition-colors"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
