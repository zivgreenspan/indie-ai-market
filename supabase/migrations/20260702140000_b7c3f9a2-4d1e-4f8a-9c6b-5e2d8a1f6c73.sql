-- Purchases needs a Stripe identifier again now that payment is via
-- per-creator Stripe Payment Links (the earlier Lemon Squeezy migration
-- dropped the original stripe_* columns and swapped in lemon_squeezy_*
-- ones, which are now dead - left in place as harmless legacy columns).
-- The checkout session id doubles as an idempotency key so Stripe's
-- webhook retries don't create duplicate purchase rows.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_stripe_checkout_session_unique
  ON public.purchases (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
