import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Lock, BarChart2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/hooks'

type Props = { children: ReactNode }

export default function ProtectedRoute({ children }: Props) {
  const { data: user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#D4AF37', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        {/* Lock icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(212,175,55,0.12)',
          border: '1.5px solid rgba(212,175,55,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Lock size={30} color="#D4AF37" />
        </div>

        {/* Headline */}
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          Sign in to view your Portfolio
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--text-secondary)', maxWidth: 300, lineHeight: 1.5 }}>
          Track your collection's value, monitor gains and losses, and manage your cards — all in one place.
        </p>

        {/* Feature highlights */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 32,
          width: '100%',
          maxWidth: 300,
        }}>
          {[
            { icon: BarChart2, text: 'Real-time market value tracking' },
            { icon: ShieldCheck, text: 'Unrealized & realized gain/loss' },
            { icon: BarChart2, text: 'TCG + Sports cards in one vault' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--glass-border)',
              textAlign: 'left',
            }}>
              <Icon size={16} color="#D4AF37" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{text}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
          <Link
            to="/login"
            style={{
              display: 'block',
              padding: '13px 0',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #D4AF37, #B8960C)',
              color: '#000',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            style={{
              display: 'block',
              padding: '13px 0',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 15,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Create Free Account
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
