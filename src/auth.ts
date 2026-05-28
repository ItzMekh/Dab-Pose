import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { compare } from 'bcryptjs'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { logError } from '@/lib/log'
import { users } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { clientCountryFromHeaders } from '@/lib/client-meta'
import { verifyTurnstile } from '@/lib/turnstile'
import { redis } from '@/lib/redis'

const COUNTRY_RE = /^[A-Z]{2}$/

async function detectCountry(): Promise<string> {
  try {
    const h = await headers()
    // Middleware strips any client-supplied x-dab-country before setting
    // its own value, so this header is authoritative when present.
    const fromMiddleware = h.get('x-dab-country')?.toUpperCase() ?? ''
    if (COUNTRY_RE.test(fromMiddleware) && fromMiddleware !== 'XX') return fromMiddleware
    return clientCountryFromHeaders(h)
  } catch {
    // headers() unavailable in this auth context — accept XX rather than
    // trust a spoofable client-readable cookie.
    return 'XX'
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: {}, turnstileToken: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        // Bot challenge — closes AU-02. Required on every credentials login
        // so credential-stuffing scripts cannot drive bcrypt CPU load.
        const tsOk = await verifyTurnstile(credentials.turnstileToken as string | undefined)
        if (!tsOk) return null
        const [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, credentials.email as string), isNull(users.deletedAt)))
          .limit(1)
        if (!user || !user.passwordHash) return null
        const valid = await compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        return { id: user.id, name: user.username, email: user.email, image: user.avatarUrl }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account, profile, trigger, session: updateData }) {
      // Credentials sign-in
      if (user && account?.provider === 'credentials') {
        token.id = user.id
        token.username = user.name
      }
      // Google sign-in (account only present on first sign-in)
      if (account?.provider === 'google' && profile) {
        try {
          const email = profile.email as string
          const [existing] = await db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(and(eq(users.email, email), isNull(users.deletedAt)))
            .limit(1)
          if (existing) {
            token.id = existing.id
            token.username = existing.username
          } else {
            const base = ((profile.name as string) ?? 'user')
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '')
              .slice(0, 16) || 'user'
            const username = `${base}_${crypto.randomUUID().slice(0, 4)}`
            const country = await detectCountry()
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                username,
                googleId: profile.sub as string,
                avatarUrl: (profile.picture as string) ?? null,
                country,
              })
              .returning({ id: users.id, username: users.username })
            token.id = newUser.id
            token.username = newUser.username
            token.needsUsernameSetup = true
          }
        } catch (err) {
          logError('auth', err, { context: 'Google JWT callback DB error' })
        }
      }
      // Session update — refresh username from DB, clear flags
      if (trigger === 'update' && token.id) {
        try {
          const [dbUser] = await db
            .select({ username: users.username })
            .from(users)
            .where(and(eq(users.id, token.id as string), isNull(users.deletedAt)))
            .limit(1)
          if (dbUser) {
            token.username = dbUser.username
            token.dbCheckedAt = Date.now()
          }
        } catch (err) {
          logError('auth', err, { context: 'session update DB error' })
        }
        if ((updateData as { needsUsernameSetup?: boolean })?.needsUsernameSetup === false) {
          token.needsUsernameSetup = false
        }
      }

      // Tag-based username refresh. The username PATCH handler bumps a
      // Redis key u:renametag:<userId> whenever the canonical name changes.
      // We hit the DB only when the tag diverges from the value last stored
      // in the JWT — replacing the previous 5s polling loop and dropping
      // ~12 unnecessary DB reads per minute per active session
      // (audit C-04). One cheap Redis GET per authenticated request remains.
      if (token.id && !user && !account && !profile && trigger !== 'update') {
        try {
          const tag = (await redis.get(`u:renametag:${token.id}`)) as string | null
          const needsRenameSync = tag && tag !== token.renameTag
          const staleCheck = !token.dbCheckedAt || Date.now() - (token.dbCheckedAt as number) > 300_000
          if (needsRenameSync || staleCheck) {
            const [dbUser] = await db
              .select({ username: users.username })
              .from(users)
              .where(and(eq(users.id, token.id as string), isNull(users.deletedAt)))
              .limit(1)
            if (!dbUser) return {} as typeof token
            token.username = dbUser.username
            token.dbCheckedAt = Date.now()
            if (needsRenameSync) token.renameTag = tag
          }
        } catch (err) {
          logError('auth', err, { context: 'tagged sync error' })
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      if (token.username) session.user.name = token.username as string
      if (token.needsUsernameSetup) session.user.needsUsernameSetup = true
      return session
    },
  },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
})
