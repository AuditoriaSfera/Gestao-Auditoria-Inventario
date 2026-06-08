import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthState = {
  token: string | null
  setToken: (token: string) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clearSession: () => {
        set({ token: null })
        document.cookie = 'session-token=; Max-Age=0; path=/'
      },
    }),
    { name: 'sfera-auth' }
  )
)
