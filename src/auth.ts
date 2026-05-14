import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
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
    async jwt({ token, user, account, profile }) {
      // Credentials sign-in: user object present
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
            .where(eq(users.email, email))
            .limit(1)
          if (existing) {
            token.id = existing.id
            token.username = existing.username
          } else {
            const base = ((profile.name as string) ?? 'user')
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '')
              .slice(0, 16) || 'user'
            const username = `${base}_${Math.random().toString(36).slice(2, 6)}`
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                username,
                googleId: profile.sub as string,
                avatarUrl: (profile.picture as string) ?? null,
                country: 'XX',
              })
              .returning({ id: users.id, username: users.username })
            token.id = newUser.id
            token.username = newUser.username
          }
        } catch (err) {
          console.error('[auth] Google JWT callback DB error:', err)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      if (token.username) session.user.name = token.username as string
      return session
    },
  },
  pages: { signIn: '/login' },
  trustHost: true,
})
