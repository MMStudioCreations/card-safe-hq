import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found in the link.')
      return
    }

    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setMessage((err as Error).message || 'Verification failed. The link may have expired.')
      })
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md p-8 text-center space-y-4">
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

        {status === 'loading' && (
          <>
            <h1 className="text-2xl font-bold">Verifying your email...</h1>
            <p className="text-sm text-cv-muted">Just a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(78,203,160,0.15)' }}>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="#4ECBA0" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Email verified!</h1>
            <p className="text-sm text-cv-muted">Your account is now active. You can log in and start using Card Safe HQ.</p>
            <Link className="btn-primary inline-block mt-2" to="/login">Go to login</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(240,96,96,0.15)' }}>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="#F06060" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Verification failed</h1>
            <p className="text-sm text-cv-muted">{message}</p>
            <Link className="btn-primary inline-block mt-2" to="/login">Back to login</Link>
          </>
        )}
      </div>
    </div>
  )
}
