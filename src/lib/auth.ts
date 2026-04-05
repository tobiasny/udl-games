import { supabase } from './supabase'

const SESSION_KEY = 'udl_admin_session'

export async function login(password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('authenticate_admin', {
    password_input: password,
  })
  if (error || !data) return false
  sessionStorage.setItem(SESSION_KEY, data)
  return true
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY)
}

export async function isAuthenticated(): Promise<boolean> {
  const token = getSessionToken()
  if (!token) return false
  const { data, error } = await supabase.rpc('is_valid_session', {
    token_input: token,
  })
  if (error) return false
  return !!data
}
