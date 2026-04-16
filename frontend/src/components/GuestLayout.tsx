import type { ReactNode } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { Layers, LogOut, Search, UserCircle, LogIn, ShoppingBag, LayoutDashboard } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/hooks'

type Props = { children: ReactNode }

export default function GuestLayout({ children }: Props) {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function handleLogout() {
    await api.logout()
    await queryClient.invalidateQueries()
    navigate('/login')
  }

  const mobileLinks = [
    { to: '/search', label: 'Search', icon: Search },
    { to: '/shop', label: 'Shop', icon: ShoppingBag },
    { to: '/deck', label: 'Deck Builder', icon: Layers },
    { to: '/', label: 'Portfolio', icon: LayoutDashboard },
  ]

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6">
      <header className="glass sticky top-3 z-20 mb-6 p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to={user ? '/' : '/search'} className="flex items-center gap-3">
            <img src="/logo.png" alt="Card Safe HQ" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <h1 className="text-lg font-bold tracking-wide">Card Safe HQ</h1>
              <p className="text-cv-muted tracking-widest uppercase" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>
                Protect. Display. Collect.
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-2 sm:flex">
            <NavLink to="/search" className={({ isActive }) => `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`}>
              <Search className="h-3.5 w-3.5" /> Search
            </NavLink>
            <NavLink to="/shop" className={({ isActive }) => `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`}>
              <ShoppingBag className="h-3.5 w-3.5" /> Shop
              <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>NEW</span>
            </NavLink>
            <NavLink to="/deck" className={({ isActive }) => `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`}>
              <Layers className="h-3.5 w-3.5" /> Deck Builder
            </NavLink>

            {user ? (
              <>
                <NavLink to="/" end className={({ isActive }) => `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`}>
                  <LayoutDashboard className="h-3.5 w-3.5" /> My Portfolio
                </NavLink>
                <NavLink to="/account" className={({ isActive }) => `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`}>
                  <UserCircle className="h-3.5 w-3.5" /> {user.username || user.email}
                </NavLink>
                <button className="btn-ghost text-sm" onClick={handleLogout} type="button">
                  <LogOut className="mr-1.5 h-3.5 w-3.5" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost flex items-center gap-1.5 text-sm"><LogIn className="h-3.5 w-3.5" /> Sign In</Link>
                <Link to="/register" className="btn-primary text-sm px-4 py-2">Sign Up Free</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      {/* Mobile nav */}
      <nav
        className="glass fixed inset-x-2 bottom-2 z-30 mx-auto flex max-w-[1240px] items-center justify-around px-2 py-2 sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {mobileLinks.map(link => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] font-medium ${isActive ? 'text-[var(--primary)]' : 'text-cv-muted'}`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
        {!user && (
          <Link to="/login" className="flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] font-medium text-cv-muted">
            <LogIn className="h-[18px] w-[18px]" />
            <span>Sign In</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
