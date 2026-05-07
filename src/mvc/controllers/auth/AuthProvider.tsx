import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../../models/firebase/firebase'
import { getUserRoleFromDb, setUserRoleInDb } from '../../models/firebase/roleRepository'
import { setPlayerProfileInDb } from '../../models/firebase/playerRepository'
import { ensureDefaultPlayerData, setPlayerDataInDb } from '../../models/firebase/playerDataRepository'
import { AuthContext } from './AuthContext'
import type { AuthContextValue, AuthProviderProps } from './AuthContext'
import type { UserRole } from '../../models/UserRole'
import type { PlayerProfile } from '../../models/firebase/playerRepository'
import { defaultPlayerData } from '../../models/playerData/PlayerData'

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const refreshRole = async (): Promise<UserRole | null> => {
    if (!auth.currentUser) return null
    const freshRole = await getUserRoleFromDb(auth.currentUser.uid)
    setRole(freshRole)
    return freshRole
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setRole(null)
        setAuthReady(true)
        return
      }

      try {
        const r = await getUserRoleFromDb(u.uid)
        setRole(r)
        if (r === 'player') {
          await ensureDefaultPlayerData(u.uid)
        }
      } catch {
        setRole(null)
      } finally {
        setAuthReady(true)
      }
    })

    return () => unsub()
  }, [])

  const signIn: AuthContextValue['signIn'] = async ({ email, password }) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    setUser(cred.user)
    await refreshRole()
    return cred.user
  }

  const registerPlayer: AuthContextValue['registerPlayer'] = async ({
    name,
    email,
    password,
  }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)

    const uid = cred.user.uid
    const profile: PlayerProfile = {
      name,
      email,
      createdAt: Date.now(),
    }

    await Promise.all([
      setUserRoleInDb(uid, 'player'),
      setPlayerProfileInDb(uid, profile),
      setPlayerDataInDb(uid, defaultPlayerData),
    ])

    setUser(cred.user)
    await refreshRole()
    return cred.user
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      authReady,
      signIn,
      registerPlayer,
      refreshRole,
      signOut: async () => {
        await firebaseSignOut(auth)
      },
    }),
    [authReady, registerPlayer, refreshRole, role, signIn, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

