import { pgTable, uuid, text, char, timestamp, integer, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').unique().notNull(),
  username:     text('username').unique().notNull(),
  passwordHash: text('password_hash'),
  googleId:     text('google_id').unique(),
  avatarUrl:    text('avatar_url'),
  country:      char('country', { length: 2 }).notNull().default('XX'),
  createdAt:    timestamp('created_at').defaultNow(),
})

export const scores = pgTable('scores', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  username:    text('username').notNull(),
  mode:        text('mode').notNull(),
  timeMs:      integer('time_ms'),
  count:       integer('count'),
  country:     char('country', { length: 2 }).notNull().default('XX'),
  rankGlobal:  integer('rank_global'),
  rankCountry: integer('rank_country'),
  createdAt:   timestamp('created_at').defaultNow(),
}, (t) => [
  index('scores_user_created_idx').on(t.userId, t.createdAt.desc()),
  index('scores_country_mode_idx').on(t.country, t.mode, t.createdAt.desc()),
])

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Score = typeof scores.$inferSelect
export type NewScore = typeof scores.$inferInsert
