import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'mio_voice_retry_dash_auth'

const VALID_EMAIL    = import.meta.env.VITE_AUTH_EMAIL    || 'admin@meritto.com'
const VALID_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || 'mioVoice2026'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  })

  const login = useCallback((email, password) => {
    if (email.trim().toLowerCase() === VALID_EMAIL.toLowerCase() && password === VALID_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      setAuthed(true)
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setAuthed(false)
  }, [])

  return (
    <AuthContext.Provider value={{ authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
