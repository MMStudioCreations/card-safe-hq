import type { ReactNode } from 'react'

/**
 * SemiProtectedRoute — renders immediately for both guests and authenticated users.
 * Does NOT block on the auth check — child components handle guest state themselves.
 * Removing the isLoading spinner prevents the black-screen for unauthenticated users.
 */
type Props = { children: ReactNode }

export default function SemiProtectedRoute({ children }: Props) {
  return <>{children}</>
}
