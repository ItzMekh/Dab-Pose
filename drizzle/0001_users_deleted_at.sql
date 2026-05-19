-- Soft-delete column for the users table.
--
-- Added by the security audit follow-up (closes findings C-11 + C-13):
-- a DELETE on /api/profile/settings will now set this timestamp and
-- scrub the auth fields, instead of removing the row outright.
-- All read paths gate on `deleted_at IS NULL`. A future cron may
-- hard-delete rows where `deleted_at < now() - interval '30 days'` to
-- free the username for re-use.
--
-- Safe to apply on production: nullable column, non-blocking.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
