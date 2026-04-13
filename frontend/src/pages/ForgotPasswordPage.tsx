import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md space-y-4 p-6">
        {/* Logo mark */}
        <div className="flex justify-center mb-2">
          <div className="relative h-12 w-12 overflow-hidden rounded-[var(--radius-md)]"
            style={{ background: 'linear-gradient(145deg,#0D0D0A,#1A1A10)', border: '1px solid rgba(212,175,55,0.35)', boxShadow: '0 0 14px rgba(212,175,55,0.20)' }}>
            <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full" fill="none">
              <path d="M22 5L8 11v10c0 9.2 5.8 17.8 14 20.6C30.2 38.8 36 30.2 36 21V11L22 5z" stroke="#D4AF37" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(212,175,55,0.08)"/>
              <rect x="15" y="16" width="14" height="11" rx="2.5" stroke="#D4AF37" strokeWidth="1.4" fill="rgba(212,175,55,0.10)"/>
              <circle cx="22" cy="21.5" r="2" fill="#D4AF37"/>
            </svg>
            <span className="absolute bottom-1 inset-x-0 text-center text-[7px] font-black tracking-widest" style={{ color: '#F0F6FF' }}>CS</span>
          </div>
        </div>

        {submitted ? (
          <>
            <h1 className="text-2xl font-bold text-center">Check your inbox</h1>
            <p className="text-sm text-cv-muted text-center">
              If an account exists for <strong className="text-cv-text">{email}</strong>, we've sent a password reset link. Check your spam folder if you don't see it within a few minutes.
            </p>
            <p className="text-center text-sm text-cv-muted pt-2">
              <Link className="text-cv-primary hover:underline" to="/login">Back to login</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-2xl font-bold">Forgot password?</h1>
            <p className="text-sm text-cv-muted">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
            />
            {error && <p className="text-sm text-cv-danger">{error}</p>}
            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-cv-muted">
              <Link className="text-cv-primary hover:underline" to="/login">Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
