import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { auth as authApi, setToken, getToken, type User } from "@/lib/api"

interface AppState {
  user: User | null
  token: string | null
  isAuthLoading: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isDark: boolean
  currentPage: string
  selectedUserId: string | null
  selectedHandoverId: string | null
  selectedEquipmentId: string | null
  selectedDepartmentId: string | null
  setCurrentPage: (page: string) => void
  setSelectedUserId: (id: string | null) => void
  setSelectedHandoverId: (id: string | null) => void
  setSelectedEquipmentId: (id: string | null) => void
  setSelectedDepartmentId: (id: string | null) => void
  toggleDark: () => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(getToken())
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"))
  const [currentPage, setCurrentPage] = useState("dashboard")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedHandoverId, setSelectedHandoverId] = useState<string | null>(null)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!getToken()) { setIsAuthLoading(false); return }
    authApi.me()
      .then(res => { if (res.data) setUser(res.data) })
      .catch(() => { setToken(null); setTokenState(null) })
      .finally(() => setIsAuthLoading(false))
  }, [])

  const isAdmin = !!(user?.is_admin || user?.role === "admin" || user?.role === "Administrator" || user?.role === "superadmin")

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    if (res.data) {
      setToken(res.data.token)
      setTokenState(res.data.token)
      setUser(res.data.user)
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null); setTokenState(null); setUser(null); setCurrentPage("dashboard")
  }, [])

  const toggleDark = useCallback(() => {
    setIsDark(d => { const next = !d; document.documentElement.classList.toggle("dark", next); return next })
  }, [])

  return (
    <AppContext.Provider value={{
      user, token, isAuthLoading, isAdmin, login, logout,
      isDark, currentPage,
      selectedUserId, selectedHandoverId, selectedEquipmentId, selectedDepartmentId,
      setCurrentPage, setSelectedUserId, setSelectedHandoverId,
      setSelectedEquipmentId, setSelectedDepartmentId,
      toggleDark,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
