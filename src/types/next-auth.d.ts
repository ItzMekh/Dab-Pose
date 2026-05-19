import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      needsUsernameSetup?: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    username?: string
    needsUsernameSetup?: boolean
    /**
     * Mirror of the Redis key `u:renametag:<userId>`. The JWT callback
     * re-pulls the username from the DB only when the stored value
     * diverges from this token field, replacing the previous 5s polling
     * loop. Set by the username PATCH handler.
     */
    renameTag?: string
    /** Legacy throttle timestamp, kept for backward-compat with old tokens. */
    dbCheckedAt?: number
  }
}
