import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass w-full max-w-md p-6 text-center space-y-4">
          <h1 className="text-2xl font-bold">Invalid link</h1>
          <p className="text-sm text-cv-muted">This password reset link is missing or invalid.</p>
          <Link className="btn-primary inline-block" to="/forgot-password">Request a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md space-y-4 p-6">
        {/* Logo mark */}
        <div className="flex justify-center mb-2">
          <div className="relative h-12 w-12 overflow-hidden rounded-[var(--radius-md)]"
            style={{ background: 'linear-gradient(145deg,#1A0D08,#261308)', border: '1px solid rgba(249,115,22,0.35)', boxShadow: '0 0 14px rgba(249,115,22,0.20)' }}>
            <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full" fill="none">
              <path d="M22 5L8 11v10c0 9.2 5.8 17.8 14 20.6C30.2 38.8 36 30.2 36 21V11L22 5z" stroke="#f97316" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(249,115,22,0.08)"/>
              <rect x="15" y="16" width="14" height="11" rx="2.5" stroke="#f59e0b" strokeWidth="1.4" fill="rgba(245,158,11,0.10)"/>
              <circle cx="22" cy="21.5" r="2" fill="#f59e0b"/>
            </svg>
            <span className="absolute bottom-1 inset-x-0 text-center text-[7px] font-black tracking-widest" style={{ color: '#F0F6FF' }}>CS</span>
          </div>
        </div>

        {success ? (
          <>
            <h1 className="text-2xl font-bold text-center">Password updated!</h1>
            <p className="text-sm text-cv-muted text-center">
              Your password has been reset successfully. Redirecting you to login...
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-2xl font-bold">Set new password</h1>
            <p className="text-sm text-cv-muted">Choose a strong password for your account.</p>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              required
            />
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              required
            />
            {error && <p className="text-sm text-cv-danger">{error}</p>}
            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? 'Updating...' : 'Reset password'}
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
