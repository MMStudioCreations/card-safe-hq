import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import CardDetailPage from './pages/CardDetailPage'
import CollectionPage from './pages/CollectionPage'
import DashboardPage from './pages/DashboardPage'
import DeckBuilderPage from './pages/DeckBuilderPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import ScanPage from './pages/ScanPage'
import UploadPage from './pages/UploadPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <CollectionPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <Layout>
              <ScanPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <Layout>
              <UploadPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/review"
        element={
          <ProtectedRoute>
            <Layout>
              <ReviewQueuePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deck"
        element={
          <ProtectedRoute>
            <Layout>
              <DeckBuilderPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/card/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <CardDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
