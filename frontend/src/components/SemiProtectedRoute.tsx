import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../lib/hooks'

/**
 * SemiProtectedRoute — allows both authenticated and guest users.
 * Unlike ProtectedRoute, it does NOT redirect to /login.
 * Components using this should handle the guest state themselves.
 */
type Props = { children: ReactNode }

export default function SemiProtectedRoute({ children }: Props) {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cv-secondary" />
      </div>
    )
  }

  return <>{children}</>
}
