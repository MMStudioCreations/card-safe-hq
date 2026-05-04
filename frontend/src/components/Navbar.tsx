import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/hooks'
import type { Notification } from '../lib/api'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 80) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.listNotifications(),
    refetchInterval: 60_000,
    enabled: !!user,
  })
  const notifications: Notification[] = (notifData as any)?.notifications ?? []
  const unreadCount: number = (notifData as any)?.unread_count ?? 0

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markOneRead = useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  async function handleLogout() {
    await api.logout()
    await queryClient.invalidateQueries()
    navigate('/login')
  }

  const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    color: isActive ? 'var(--text)' : 'var(--text-dim)',
    textDecoration: 'none',
  })

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        height: 72,
        background: scrolled ? 'rgba(6,6,10,0.92)' : 'rgba(6,6,10,0.7)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.3s ease',
      }}
    >
      <div className="mx-auto h-full flex items-center justify-between px-6" style={{ maxWidth: 1280 }}>

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-3 hoverable">
          <div
            className="flex items-center justify-center rounded font-bold"
            style={{
              width: 34, height: 34,
              background: 'var(--gold)', color: '#06060A',
              fontSize: 13, letterSpacing: '-0.02em',
              fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
            }}
          >
            CS
          </div>
          <span
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 22, fontWeight: 600,
              color: 'var(--text)', letterSpacing: '0.01em',
            }}
          >
            CardSafe HQ
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex items-center gap-8">
          <NavLink to="/builder" className="nav-link hoverable" style={navLinkStyle}>
            Deck Builder
          </NavLink>
          <NavLink to="/protection" className="nav-link hoverable" style={navLinkStyle}>
            Protection
          </NavLink>
          <a
            href="/#about"
            className="nav-link hoverable"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'var(--text-dim)', textDecoration: 'none' }}
          >
            About
          </a>
        </nav>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-3">

          {/* Notification bell */}
          {user && (
            <div ref={bellRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(o => !o)
                  if (!notifOpen && unreadCount > 0) markAllRead.mutate()
                }}
                className="relative p-2 rounded-full hoverable"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <Bell className="h-4 w-4" style={{ color: 'var(--text-dim)' }} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: 'var(--gold)', color: '#06060A' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-80"
                  style={{
                    background: '#111114',
                    border: '1px solid var(--border-glow)',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                  }}
                >
                  <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-sm font-semibold">Notifications</span>
                    {notifications.some(n => n.read === 0) && (
                      <button type="button" onClick={() => markAllRead.mutate()} className="text-xs hover:underline" style={{ color: 'var(--gold)' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs" style={{ color: 'var(--text-dim)' }}>No notifications</p>
                    ) : notifications.map(n => (
                      <div
                        key={n.id}
                        className="border-b px-4 py-3 last:border-0"
                        style={{ borderColor: 'var(--border)', background: n.read === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">{n.title}</p>
                            {n.body && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>{n.body}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {n.trade_id && (
                              <Link to={`/trades/${n.trade_id}`} onClick={() => setNotifOpen(false)} className="text-xs hover:underline" style={{ color: 'var(--gold)' }}>
                                View
                              </Link>
                            )}
                            {n.read === 0 && (
                              <button
                                type="button"
                                onClick={() => markOneRead.mutate(n.id)}
                                className="h-2 w-2 rounded-full"
                                style={{ background: 'var(--gold)' }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auth CTA */}
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 text-xs hoverable transition-colors"
              style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm hoverable transition-colors"
                style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
              >
                Sign In
              </Link>
              <Link
                to="/builder"
                className="hoverable text-sm font-medium"
                style={{
                  padding: '8px 20px',
                  border: '1px solid var(--gold)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--gold)',
                  background: 'transparent',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'background 0.2s, color 0.2s',
                  display: 'inline-block',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--gold)'; el.style.color = '#06060A' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--gold)' }}
              >
                Launch Builder →
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
