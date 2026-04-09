import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminPage from './pages/AdminPage'
import CardDetailPage from './pages/CardDetailPage'
import CollectionPage from './pages/CollectionPage'
import DashboardPage from './pages/DashboardPage'
import DeckBuilderPage from './pages/DeckBuilderPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import ScanPage from './pages/ScanPage'
import UploadPage from './pages/UploadPage'
import TradesPage from './pages/TradesPage'
import TradeDetailPage from './pages/TradeDetailPage'
import NewTradePage from './pages/NewTradePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import BillingPage from './pages/BillingPage'

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route path="/"         element={<Protected><CollectionPage /></Protected>} />
      <Route path="/scan"     element={<Protected><ScanPage /></Protected>} />
      <Route path="/upload"   element={<Protected><UploadPage /></Protected>} />
      <Route path="/review"   element={<Protected><ReviewQueuePage /></Protected>} />
      <Route path="/deck"     element={<Protected><DeckBuilderPage /></Protected>} />
      <Route path="/card/:id" element={<Protected><CardDetailPage /></Protected>} />
      <Route path="/admin"    element={<Protected><AdminPage /></Protected>} />

      {/* Trades */}
      <Route path="/trades"        element={<Protected><TradesPage /></Protected>} />
      <Route path="/trades/new"    element={<Protected><NewTradePage /></Protected>} />
      <Route path="/trades/:id"    element={<Protected><TradeDetailPage /></Protected>} />

      {/* Billing */}
      <Route path="/billing" element={<Protected><BillingPage /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
