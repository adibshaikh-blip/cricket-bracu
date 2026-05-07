export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
  databaseURL: string
}

function requiredEnv(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to your .env file.`,
    )
  }
  return String(value)
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    ? String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)
    : undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    ? String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)
    : undefined,
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
  databaseURL: requiredEnv('VITE_FIREBASE_DATABASE_URL'),
}

