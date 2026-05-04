import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Layers, Shield, UserCircle } from 'lucide-react'
import Navbar from './Navbar'
import { useAuth } from '../lib/hooks'

type Props = { children: ReactNode }

type Tab = { to: string; label: string; Icon: React.ComponentType<{ style?: React.CSSProperties }> }

export default function Layout({ children }: Props) {
  const { data: user } = useAuth()
  const location = useLocation()

  const BOTTOM_TABS: Tab[] = [
    { to: '/builder',    label: 'Builder',    Icon: Layers },
    { to: '/protection', label: 'Protection', Icon: Shield },
    ...(user ? [{ to: '/account', label: 'Account', Icon: UserCircle }] as Tab[] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main
        className="flex-1"
        style={{
          paddingTop: 72,
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto w-full px-4 sm:px-6" style={{ maxWidth: 1240 }}>
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 sm:hidden"
        style={{
          background: 'rgba(6,6,10,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${BOTTOM_TABS.length}, 1fr)` }}>
          {BOTTOM_TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors"
              style={({ isActive }) => ({ color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.35)' })}
            >
              {({ isActive }) => (
                <>
                  <Icon style={{ width: 22, height: 22, strokeWidth: isActive ? 2.2 : 1.6 } as React.CSSProperties} />
                  <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: '0.02em' }}>{label}</span>
                  {isActive && <span className="rounded-full" style={{ width: 4, height: 4, background: 'var(--gold)', marginTop: -1 }} />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
