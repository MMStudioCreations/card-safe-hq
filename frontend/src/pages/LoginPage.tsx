import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/hooks'

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
        <div className="flex justify-center mb-1">
          <div className="relative h-12 w-12 overflow-hidden rounded-[var(--radius-md)]"
            style={{ background: 'linear-gradient(145deg,#0D1A24,#131C26)', border: '1px solid rgba(0,229,255,0.28)', boxShadow: '0 0 14px rgba(0,229,255,0.18)' }}>
            <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full" fill="none">
              <path d="M22 5L8 11v10c0 9.2 5.8 17.8 14 20.6C30.2 38.8 36 30.2 36 21V11L22 5z" stroke="#00E5FF" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(0,229,255,0.06)"/>
              <rect x="15" y="16" width="14" height="11" rx="2.5" stroke="#C9A84C" strokeWidth="1.4" fill="rgba(201,168,76,0.09)"/>
              <circle cx="22" cy="21.5" r="2" fill="#C9A84C"/>
            </svg>
            <span className="absolute bottom-1 inset-x-0 text-center text-[7px] font-black tracking-widest" style={{ color: '#F0F6FF' }}>CS</span>
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
            <Link className="text-cv-secondary hover:underline font-medium" to="/membership">View membership plans &amp; pricing</Link>
          </p>
          <p className="text-center text-xs text-cv-muted">
            <Link className="hover:underline" to="/search">Browse without signing in →</Link>
          </p>
        </div>
      </form>
    </div>
  )
}
