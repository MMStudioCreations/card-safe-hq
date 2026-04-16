-- 0014_pro_limits.sql
-- Adds a helper view to check Pro status and enforces free-tier limits.
-- Pro status is derived from the subscriptions table: plan = 'monthly' | 'yearly'
-- and status = 'active' | 'trialing'.

-- ── Helper view: user_is_pro ──────────────────────────────────────────────────
-- Returns one row per user with a boolean is_pro flag.
-- Used by collection and trades routes to gate Pro-only features.
CREATE VIEW IF NOT EXISTS user_is_pro AS
SELECT
  u.id AS user_id,
  CASE
    WHEN s.plan IN ('monthly', 'yearly')
     AND s.status IN ('active', 'trialing')
    THEN 1
    ELSE 0
  END AS is_pro
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id;
