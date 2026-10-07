import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthProvider, useAuth } from './lib/auth'
import { AgreementsPage } from './pages/AgreementsPage'
import { AgreementViewPage } from './pages/AgreementViewPage'
import { LoginPage } from './pages/LoginPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/agreements" element={<AgreementsPage />} />
            <Route path="/agreements/:id" element={<AgreementViewPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/agreements" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
