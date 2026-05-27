-- Index for dashboard date-range queries.
-- The existing composite indexes (userId+createdAt, country+mode+createdAt)
-- don't cover standalone WHERE created_at BETWEEN queries.

CREATE INDEX CONCURRENTLY IF NOT EXISTS scores_created_at_idx ON scores (created_at DESC);
