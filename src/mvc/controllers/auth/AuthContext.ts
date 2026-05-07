import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { ReactNode } from 'react'
import type { UserRole } from '../../models/UserRole'

export type AuthContextValue = {
  user: User | null
  role: UserRole | null
  authReady: boolean
  signIn: (params: { email: string; password: string }) => Promise<User>
  registerPlayer: (params: {
    name: string
    email: string
    password: string
  }) => Promise<User>
  refreshRole: () => Promise<UserRole | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export type AuthProviderProps = {
  children: ReactNode
}

