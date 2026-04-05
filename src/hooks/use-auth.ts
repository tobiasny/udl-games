import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { login as authLogin, logout as authLogout, isAuthenticated, getSessionToken } from '@/lib/auth'

interface AuthContextType {
  isAdmin: boolean
  loading: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
  sessionToken: string | null
}

export const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  loading: true,
  login: async () => false,
  logout: () => {},
  sessionToken: null,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthProvider() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const valid = await isAuthenticated()
    setIsAdmin(valid)
    setLoading(false)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(async (password: string) => {
    const success = await authLogin(password)
    if (success) setIsAdmin(true)
    return success
  }, [])

  const logout = useCallback(() => {
    authLogout()
    setIsAdmin(false)
  }, [])

  return {
    isAdmin,
    loading,
    login,
    logout,
    sessionToken: getSessionToken(),
  }
}
