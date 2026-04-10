import type { ReactNode } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { Layers, LogOut, Search, UserCircle, LogIn } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/hooks'

type Props = { children: ReactNode }

/**
 * GuestLayout — wraps pages that are accessible to both guests and authenticated users.
 * Shows a simplified nav: Search and Deck Builder are always visible.
 * Guests see "Sign In" and "Sign Up" CTAs. Authenticated users see their full nav.
 */
export default function GuestLayout({ children }: Props) {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function handleLogout() {
    await api.logout()
    await queryClient.invalidateQueries()
    navigate('/login')
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6">
      <header className="glass sticky top-3 z-20 mb-6 p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to={user ? '/' : '/search'} className="flex items-center gap-3">
            <div
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-md)]"
              style={{
                background: 'linear-gradient(145deg, #0D1A24 0%, #131C26 100%)',
                border: '1px solid rgba(0,229,255,0.28)',
                boxShadow: '0 0 14px rgba(0,229,255,0.18)',
              }}
            >
              <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full" fill="none">
                <path
                  d="M22 5L8 11v10c0 9.2 5.8 17.8 14 20.6C30.2 38.8 36 30.2 36 21V11L22 5z"
                  stroke="#00E5FF"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  fill="rgba(0,229,255,0.06)"
                />
                <rect x="15" y="16" width="14" height="11" rx="2.5" stroke="#C9A84C" strokeWidth="1.4" fill="rgba(201,168,76,0.09)" />
                <circle cx="22" cy="21.5" r="2" fill="#C9A84C" />
              </svg>
              <span className="absolute bottom-1 inset-x-0 text-center text-[7px] font-black tracking-widest" style={{ color: '#F0F6FF' }}>CS</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">Card Safe HQ</h1>
              <p className="text-xs text-cv-muted">The command center for card collectors</p>
            </div>
          </Link>

          {/* Nav */}
          <div className="hidden items-center gap-2 sm:flex">
            <NavLink
              to="/search"
              className={({ isActive }) =>
                `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
              }
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </NavLink>
            <NavLink
              to="/deck"
              className={({ isActive }) =>
                `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
              }
            >
              <Layers className="h-3.5 w-3.5" />
              Deck Builder
            </NavLink>

            {user ? (
              <>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `relative rounded-full px-3 py-2 text-sm ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
                  }
                >
                  My Collection
                </NavLink>
                <NavLink
                  to="/account"
                  className={({ isActive }) =>
                    `relative rounded-full px-3 py-2 text-sm flex items-center gap-1.5 ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
                  }
                >
                  <UserCircle className="h-3.5 w-3.5" />
                  {user.username || user.email}
                </NavLink>
                <button className="btn-ghost text-sm" onClick={handleLogout} type="button">
                  <LogOut className="mr-1.5 h-3.5 w-3.5" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/membership"
                  className="rounded-full px-3 py-2 text-sm text-cv-muted hover:text-cv-text"
                >
                  Pricing
                </Link>
                <Link
                  to="/login"
                  className="btn-ghost flex items-center gap-1.5 text-sm"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm px-4 py-2"
                >
                  Sign Up Free
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
        className="glass fixed inset-x-2 bottom-2 z-30 mx-auto flex max-w-[1240px] items-center justify-around px-2 py-2 sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] font-medium ${isActive ? 'text-[#00E5FF]' : 'text-cv-muted'}`
          }
        >
          <Search className="h-[18px] w-[18px]" />
          <span>Search</span>
        </NavLink>
        <NavLink
          to="/deck"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] font-medium ${isActive ? 'text-[#00E5FF]' : 'text-cv-muted'}`
          }
        >
          <Layers className="h-[18px] w-[18px]" />
          <span>Deck Builder</span>
        </NavLink>
        {user ? (
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] font-medium ${isActive ? 'text-[#00E5FF]' : 'text-cv-muted'}`
            }
          >
            <UserCircle className="h-[18px] w-[18px]" />
            <span>My Vault</span>
          </NavLink>
        ) : (
          <Link
            to="/login"
            className="flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[10px] font-medium text-cv-muted"
          >
            <LogIn className="h-[18px] w-[18px]" />
            <span>Sign In</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
