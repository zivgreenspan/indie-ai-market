-- Paddle subscription billing support for River's own creator tiers
-- (separate from the per-creator Stripe Payment Links used for individual
-- product sales). Only touches creator_profiles subscription fields and
-- the shared webhook_failures log - no new tables, no changes to
-- products/purchases/entitlements/creator_payout_details.

ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;

-- Note: webhook_failures was already generalized to a provider-agnostic
-- shape (provider, event_type, payload, error_message, created_at,
-- resolved_at) prior to this migration, replacing the old Stripe-only
-- (reason, resolved, raw_payload, product_id, creator_id) columns. This
-- statement is a no-op safety net documenting the shape both the Stripe
-- and Paddle webhook handlers now rely on.
ALTER TABLE public.webhook_failures ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.webhook_failures ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.webhook_failures ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.webhook_failures ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.webhook_failures ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
