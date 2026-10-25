import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { authService, type Session } from './authService'

interface AuthValue {
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  startDemo: (name: string) => void
  signOut: () => void
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => authService.getSession())
  const signIn = useCallback(async (e: string, p: string) => setSession(await authService.signIn(e, p)), [])
  const signUp = useCallback(async (e: string, p: string, n: string) => setSession(await authService.signUp(e, p, n)), [])
  const startDemo = useCallback((name: string) => setSession(authService.startDemo(name)), [])
  const signOut = useCallback(() => {
    authService.signOut()
    setSession(null)
  }, [])
  const value = useMemo(() => ({ session, signIn, signUp, startDemo, signOut }), [session, signIn, signUp, startDemo, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
