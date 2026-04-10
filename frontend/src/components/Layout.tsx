import { useState, useRef, useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import { Camera, FolderKanban, Images, Layers, LogOut, Bell, ArrowLeftRight, Search, UserCircle, Crown } from 'lucide-react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth, useCollection } from '../lib/hooks'
import type { Notification } from '../lib/api'

type Props = { children: ReactNode }

// Links visible to authenticated users
const authLinks = [
  { to: '/', label: 'Collection', icon: FolderKanban, requiresAuth: true },
  { to: '/scan', label: 'Scan', icon: Camera, requiresAuth: true },
  { to: '/upload', label: 'Upload', icon: Images, requiresAuth: true },
  { to: '/deck', label: 'Deck Builder', icon: Layers, requiresAuth: false },
  { to: '/trades', label: 'Trades', icon: ArrowLeftRight, requiresAuth: true },
  { to: '/search', label: 'Search', icon: Search, requiresAuth: false },
  { to: '/account', label: 'Account', icon: UserCircle, requiresAuth: true },
]

// Links visible to guests (not logged in)
const guestLinks = [
  { to: '/search', label: 'Search', icon: Search },
  { to: '/deck', label: 'Deck Builder', icon: Layers },
  { to: '/membership', label: 'Membership', icon: Crown },
]

export default function Layout({ children }: Props) {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: collection = [] } = useCollection(user ? true : undefined)

  const [notifOpen, setNotifOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // Only poll notifications when logged in
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

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
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
  const navLinks = isGuest ? guestLinks : authLinks
  const mobileLinks = isGuest
    ? guestLinks
    : authLinks

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6">
      <header className="glass sticky top-3 z-20 mb-6 p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to={isGuest ? '/search' : '/'} className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-md)]" style={{ background: 'linear-gradient(145deg, #0D1A24 0%, #131C26 100%)', border: '1px solid rgba(0,229,255,0.28)', boxShadow: '0 0 14px rgba(0,229,255,0.18)' }}>
              <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 5L8 11v10c0 9.2 5.8 17.8 14 20.6C30.2 38.8 36 30.2 36 21V11L22 5z" stroke="#00E5FF" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(0,229,255,0.06)"/>
                <rect x="15" y="16" width="14" height="11" rx="2.5" stroke="#C9A84C" strokeWidth="1.4" fill="rgba(201,168,76,0.09)"/>
                <circle cx="22" cy="21.5" r="2" fill="#C9A84C"/>
              </svg>
              <span className="absolute bottom-1 inset-x-0 text-center text-[7px] font-black tracking-widest" style={{ color: '#F0F6FF' }}>CS</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">Card Safe HQ</h1>
              <p className="text-xs text-cv-muted">The command center for card collectors</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-2 sm:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `relative rounded-full px-3 py-2 text-sm ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
                }
              >
                {link.label}
                {!isGuest && link.to === '/' && collection.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--primary)]/20 px-1.5 py-0.5 text-xs text-[var(--primary)]">
                    {collection.length}
                  </span>
                )}
              </NavLink>
            ))}

            {/* Auth-only: notification bell */}
            {!isGuest && (
              <div ref={bellRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((o) => !o)
                    if (!notifOpen && unreadCount > 0) markAllRead.mutate()
                  }}
                  className="relative btn-ghost p-2"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-[var(--radius-lg)] border border-cv-border bg-cv-bg shadow-xl z-50">
                    <div className="flex items-center justify-between border-b border-cv-border px-4 py-3">
                      <span className="text-sm font-semibold">Notifications</span>
                      {notifications.some((n) => n.read === 0) && (
                        <button
                          type="button"
                          onClick={() => markAllRead.mutate()}
                          className="text-xs text-[var(--primary)] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-xs text-cv-muted">No notifications</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`border-b border-cv-border px-4 py-3 last:border-0 ${n.read === 0 ? 'bg-cv-surface' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium">{n.title}</p>
                                {n.body && <p className="text-xs text-cv-muted mt-0.5 truncate">{n.body}</p>}
                                <p className="text-xs text-cv-muted mt-0.5">
                                  {new Date(n.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {n.trade_id && (
                                  <Link
                                    to={`/trades/${n.trade_id}`}
                                    onClick={() => setNotifOpen(false)}
                                    className="text-xs text-[var(--primary)] hover:underline"
                                  >
                                    View
                                  </Link>
                                )}
                                {n.read === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => markOneRead.mutate(n.id)}
                                    className="h-2 w-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary)]/60"
                                    title="Mark as read"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auth-only: user info + billing + logout */}
            {!isGuest ? (
              <>
                <span className="rounded-full bg-cv-surface px-3 py-2 text-xs text-cv-muted">
                  {user?.username || user?.email}
                </span>
                <NavLink
                  to="/billing"
                  className={({ isActive }) =>
                    `btn-ghost text-xs ${isActive ? 'text-[#C9A84C]' : ''}`
                  }
                >
                  Billing
                </NavLink>
                <button className="btn-ghost" onClick={handleLogout} type="button">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </button>
              </>
            ) : (
              /* Guest: login + register CTAs */
              <>
                <Link to="/login" className="btn-ghost text-sm">
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-black"
                  style={{ background: 'linear-gradient(90deg, #00E5FF, #C9A84C)' }}
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto w-full max-w-5xl">
          {children}
        </div>
      </main>

      {/* Mobile nav */}
      <nav
        className="glass fixed inset-x-2 bottom-2 z-30 mx-auto px-1 py-1.5 sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', maxWidth: '1240px' }}
      >
        <div className={`grid gap-0.5 ${isGuest ? 'grid-cols-5' : 'grid-cols-7'}`}>
          {mobileLinks.map((link) => {
            const Icon = link.icon
            const isTrades = link.to === '/trades'
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 text-[10px] font-medium transition-colors ${isActive ? 'text-[#00E5FF]' : 'text-cv-muted'}`
                }
              >
                <div className="relative">
                  <Icon className="h-[18px] w-[18px]" />
                  {!isGuest && isTrades && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--primary)] text-[8px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-center leading-tight">{link.label}</span>
              </NavLink>
            )
          })}

          {/* Guest mobile: Sign In + Register */}
          {isGuest && (
            <>
              <Link
                to="/login"
                className="flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 text-[10px] font-medium text-cv-muted"
              >
                <UserCircle className="h-[18px] w-[18px]" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 text-[10px] font-medium"
                style={{ color: '#00E5FF' }}
              >
                <Crown className="h-[18px] w-[18px]" />
                <span>Join Free</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  )
}
