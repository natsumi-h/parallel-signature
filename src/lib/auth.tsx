import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { users } from './data'
import type { AppUser } from './types'

// Simple demo login: checks credentials against the usernames and passwords in src/data/users.json.
// Uses sessionStorage so that each tab can be logged in as a different user.
const STORAGE_KEY = 'parallel-signature:user-id'

interface AuthContextValue {
  user: AppUser | null
  login: (username: string, password: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(
    () => users.find((u) => u.id === sessionStorage.getItem(STORAGE_KEY)) ?? null,
  )

  const login = useCallback((username: string, password: string) => {
    const found = users.find((u) => u.username === username.trim() && u.password === password)
    if (!found) throw new Error('Invalid username or password')
    sessionStorage.setItem(STORAGE_KEY, found.id)
    setUser(found)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
