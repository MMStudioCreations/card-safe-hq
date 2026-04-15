import { useState, useRef, useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom'
import {
  Home, Search, ShoppingBag, Layers, ArrowLeftRight,
  UserCircle, LogOut, Bell, BarChart2
} from 'lucide-react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth, useCollection } from '../lib/hooks'
import type { Notification } from '../lib/api'

type Props = { children: ReactNode }

// ── Card Safe HQ Shield Logo ──────────────────────────────────────────────────
function ShieldLogo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: size, height: size,
        background: 'linear-gradient(145deg, #0D0D0A 0%, #1A1A10 100%)',
        border: '1px solid rgba(212,175,55,0.40)',
        borderRadius: Math.round(size * 0.27),
        boxShadow: '0 0 10px rgba(212,175,55,0.15)',
      }}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full" fill="none">
        <path d="M22 4L7 10.5v10.8c0 9.6 6.1 18.6 15 21.7 8.9-3.1 15-12.1 15-21.7V10.5L22 4z"
          stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(212,175,55,0.07)" />
        <rect x="15" y="16" width="14" height="11" rx="2" stroke="#D4AF37" strokeWidth="1.3" fill="rgba(212,175,55,0.10)" />
        <path d="M21.5 18.5 C18.5 18.5 16.5 19.8 16.5 21.5 C16.5 23.2 18.5 24.5 21.5 24.5"
          stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
      <span className="absolute bottom-0.5 inset-x-0 text-center font-black tracking-widest" style={{ color: '#D4AF37', fontSize: Math.round(size * 0.14) + 'px' }}>CS</span>
    </div>
  )
}

// ── Bottom tab config ─────────────────────────────────────────────────────────
const BOTTOM_TABS_AUTH = [
  { to: '/',        label: 'Home',      Icon: Home },
  { to: '/search',  label: 'Search',    Icon: Search },
  { to: '/shop',    label: 'Shop',      Icon: ShoppingBag },
  { to: '/portfolio', label: 'Portfolio', Icon: BarChart2 },
  { to: '/account', label: 'Profile',   Icon: UserCircle },
]
const BOTTOM_TABS_GUEST = [
  { to: '/search',  label: 'Search',    Icon: Search },
  { to: '/shop',    label: 'Shop',      Icon: ShoppingBag },
  { to: '/deck',    label: 'Deck',      Icon: Layers },
  { to: '/login',   label: 'Sign In',   Icon: UserCircle },
]

// ── Desktop nav links ─────────────────────────────────────────────────────────
const DESKTOP_AUTH = [
  { to: '/',          label: 'Home' },
  { to: '/search',    label: 'Search' },
  { to: '/shop',      label: 'Shop' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/deck',      label: 'Deck Builder' },
  { to: '/trades',    label: 'Trades' },
]
const DESKTOP_GUEST = [
  { to: '/search',  label: 'Search' },
  { to: '/shop',    label: 'Shop' },
  { to: '/deck',    label: 'Deck Builder' },
]

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout({ children }: Props) {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: collection = [] } = useCollection(user ? true : undefined)

  const [notifOpen, setNotifOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleLogout() {
    await api.logout()
    await queryClient.invalidateQueries()
    navigate('/login')
  }

  const isGuest = !user
  const bottomTabs = isGuest ? BOTTOM_TABS_GUEST : BOTTOM_TABS_AUTH
  const desktopLinks = isGuest ? DESKTOP_GUEST : DESKTOP_AUTH

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Slim top header ── */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: 'rgba(10,10,12,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(212,175,55,0.10)',
        }}
      >
        <div className="mx-auto flex items-center justify-between px-4 py-3" style={{ maxWidth: 1240 }}>
          {/* Logo */}
          <Link to={isGuest ? '/search' : '/'} className="flex items-center gap-2.5">
            <ShieldLogo size={34} />
            <div>
              <p className="text-sm font-bold tracking-wide leading-tight">Card Safe HQ</p>
              <p style={{ fontSize: 8, color: '#D4AF37', letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1 }}>
                Protect. Display. Collect.
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-0.5">
            {desktopLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `relative px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isActive ? 'text-white font-semibold' : 'text-cv-muted hover:text-white'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'rgba(212,175,55,0.12)',
                  color: '#D4AF37',
                } : {}}
              >
                {link.label}
                {link.to === '/shop' && (
                  <span className="ml-1 text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>NEW</span>
                )}
                {!isGuest && link.to === '/' && collection.length > 0 && (
                  <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                    {collection.length}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            {!isGuest && (
              <div ref={bellRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(o => !o)
                    if (!notifOpen && unreadCount > 0) markAllRead.mutate()
                  }}
                  className="relative p-2 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <Bell className="h-4 w-4 text-cv-muted" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-black" style={{ background: '#D4AF37' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-[var(--radius-lg)]" style={{ background: '#111114', border: '1px solid rgba(212,175,55,0.15)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                      <span className="text-sm font-semibold">Notifications</span>
                      {notifications.some(n => n.read === 0) && (
                        <button type="button" onClick={() => markAllRead.mutate()} className="text-xs hover:underline" style={{ color: '#D4AF37' }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-xs text-cv-muted">No notifications</p>
                      ) : notifications.map(n => (
                        <div key={n.id} className="border-b px-4 py-3 last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)', background: n.read === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{n.title}</p>
                              {n.body && <p className="text-xs text-cv-muted mt-0.5 truncate">{n.body}</p>}
                              <p className="text-xs text-cv-muted mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {n.trade_id && (
                                <Link to={`/trades/${n.trade_id}`} onClick={() => setNotifOpen(false)} className="text-xs hover:underline" style={{ color: '#D4AF37' }}>View</Link>
                              )}
                              {n.read === 0 && (
                                <button type="button" onClick={() => markOneRead.mutate(n.id)} className="h-2 w-2 rounded-full" style={{ background: '#D4AF37' }} title="Mark as read" />
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

            {/* Auth controls — desktop only */}
            {!isGuest ? (
              <button
                className="hidden sm:flex items-center gap-1.5 text-xs text-cv-muted hover:text-white transition-colors"
                onClick={handleLogout}
                type="button"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login" className="text-sm text-cv-muted hover:text-white transition-colors">Sign In</Link>
                <Link
                  to="/register"
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-black"
                  style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main
        className="flex-1"
        style={{
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
          paddingTop: 16,
        }}
      >
        <div className="mx-auto w-full px-4 sm:px-6" style={{ maxWidth: 1240 }}>
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </div>
      </main>

      {/* ── Collectr-style bottom tab bar ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 sm:hidden"
        style={{
          background: 'rgba(10,10,12,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(212,175,55,0.12)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${bottomTabs.length}, 1fr)` }}>
          {bottomTabs.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors"
              style={({ isActive }) => ({
                color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.35)',
              })}
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon
                      style={{
                        width: 22, height: 22,
                        strokeWidth: isActive ? 2.2 : 1.6,
                      }}
                    />
                    {/* Trades badge */}
                    {to === '/trades' && unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-black" style={{ background: '#D4AF37' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: '0.02em' }}>{label}</span>
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="rounded-full" style={{ width: 4, height: 4, background: '#D4AF37', marginTop: -1 }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
