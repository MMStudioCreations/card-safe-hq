import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/hooks'

function ShieldLogo() {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-md)]"
      style={{
        width: 52,
        height: 52,
        background: 'linear-gradient(145deg, #0D0D0A 0%, #1A1A10 100%)',
        border: '1px solid rgba(212,175,55,0.40)',
        boxShadow: '0 0 18px rgba(212,175,55,0.20)',
      }}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full" fill="none">
        <path
          d="M22 4L7 10.5v10.8c0 9.6 6.1 18.6 15 21.7 8.9-3.1 15-12.1 15-21.7V10.5L22 4z"
          stroke="#D4AF37"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="rgba(212,175,55,0.07)"
        />
        <path
          d="M22 8L10 13.5v8.8c0 7.6 4.8 14.7 12 17.2 7.2-2.5 12-9.6 12-17.2V13.5L22 8z"
          stroke="rgba(212,175,55,0.30)"
          strokeWidth="0.8"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="15" y="16" width="14" height="11" rx="2" stroke="#D4AF37" strokeWidth="1.3" fill="rgba(212,175,55,0.10)"/>
        <path
          d="M21.5 18.5 C18.5 18.5 16.5 19.8 16.5 21.5 C16.5 23.2 18.5 24.5 21.5 24.5"
          stroke="#D4AF37"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span
        className="absolute bottom-0.5 inset-x-0 text-center font-black tracking-widest"
        style={{ color: '#D4AF37', fontSize: '6px' }}
      >
        CS
      </span>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.login({ email, password })
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth })
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form className="glass w-full max-w-md space-y-4 p-6" onSubmit={handleSubmit}>
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <ShieldLogo />
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#D4AF37', letterSpacing: '0.14em' }}>
              Card Safe HQ
            </p>
            <p className="text-[10px] text-cv-muted tracking-widest uppercase mt-0.5" style={{ letterSpacing: '0.10em' }}>
              Protect. Display. Collect.
            </p>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-cv-muted">Sign in to access your private vault.</p>
        </div>

        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <p className="text-sm text-cv-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? 'Signing in...' : 'Login'}
        </button>
        <p className="text-center text-sm text-cv-muted">
          <Link className="text-cv-primary hover:underline" to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="text-center text-sm text-cv-muted">
          Need an account?{' '}
          <Link className="text-cv-primary hover:underline" to="/register">Register</Link>
        </p>
        <div className="border-t border-cv-border pt-3 space-y-2">
          <p className="text-center text-xs text-cv-muted">
            <Link className="hover:underline font-medium" style={{ color: '#D4AF37' }} to="/membership">View membership plans &amp; pricing</Link>
          </p>
          <p className="text-center text-xs text-cv-muted">
            <Link className="hover:underline" to="/search">Browse without signing in →</Link>
          </p>
        </div>
      </form>
    </div>
  )
}
