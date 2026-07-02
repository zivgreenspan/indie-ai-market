-- Supersedes the free/pro creator_subscriptions experiments (both mine from
-- 20260701130000 and a colliding one Lovable added independently on
-- 20260702123857 - same table name, different enum). Cleaning up both
-- possible states defensively before moving to the real 4-tier model,
-- which per spec lives directly on creator_profiles.

DROP POLICY IF EXISTS "Owner can view their subscription" ON public.creator_subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.creator_subscriptions;
DROP POLICY IF EXISTS "Users view own subscription" ON public.creator_subscriptions;
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.creator_subscriptions;
DROP TRIGGER IF EXISTS set_creator_subscriptions_updated_at ON public.creator_subscriptions;
DROP TRIGGER IF EXISTS creator_subscriptions_set_updated_at ON public.creator_subscriptions;
DROP FUNCTION IF EXISTS private.can_create_product(uuid);
DROP POLICY IF EXISTS "Creators can insert their own products" ON public.products;

-- 1. Subscription tiers live on creator_profiles.
CREATE TYPE public.creator_subscription_tier AS ENUM ('free', 'creator', 'builder', 'studio');

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS creator_subscription_tier public.creator_subscription_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_subdomain TEXT;

-- Preserve anyone already manually bumped to "pro" under either prior
-- experiment - map to studio (unlimited), the closest equivalent, so
-- nobody's existing access regresses.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'creator_subscriptions') THEN
    UPDATE public.creator_profiles cp
    SET creator_subscription_tier = 'studio'
    FROM public.creator_subscriptions cs
    WHERE cs.user_id = cp.user_id AND cs.tier::text = 'pro';
  END IF;
END
$mig$;

-- Backfill trial fields for existing creators so the 60-day free trial
-- logic has something sane to compare against retroactively.
UPDATE public.creator_profiles
SET subscription_started_at = COALESCE(subscription_started_at, onboarded_at, created_at, now())
WHERE subscription_started_at IS NULL;

UPDATE public.creator_profiles
SET trial_ends_at = subscription_started_at + interval '60 days'
WHERE trial_ends_at IS NULL AND creator_subscription_tier = 'free';

-- Now safe to drop both prior experiments' table/type.
DROP TABLE IF EXISTS public.creator_subscriptions;
DROP TYPE IF EXISTS public.subscription_tier;
DROP TYPE IF EXISTS public.creator_tier;

-- 2. Per-tier product caps + free-tier price=0 + trial expiry, enforced at
-- the RLS layer (in addition to the app-layer UI checks) on product INSERT.
CREATE OR REPLACE FUNCTION private.can_create_product(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tier public.creator_subscription_tier;
  _trial_ends_at timestamptz;
  _count integer;
BEGIN
  SELECT creator_subscription_tier, trial_ends_at
    INTO _tier, _trial_ends_at
    FROM public.creator_profiles
    WHERE user_id = _user_id;

  IF _tier IS NULL THEN
    _tier := 'free';
  END IF;

  SELECT count(*) INTO _count FROM public.products WHERE creator_id = _user_id;

  CASE _tier
    WHEN 'studio' THEN RETURN true;
    WHEN 'builder' THEN RETURN _count < 8;
    WHEN 'creator' THEN RETURN _count < 3;
    ELSE RETURN _count < 1 AND (_trial_ends_at IS NULL OR _trial_ends_at > now());
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION private.can_create_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_create_product(uuid) TO authenticated;

CREATE POLICY "Creators can insert their own products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = creator_id
    AND private.has_role(auth.uid(), 'creator')
    AND private.can_create_product(auth.uid())
    AND (
      COALESCE(
        (SELECT creator_subscription_tier FROM public.creator_profiles WHERE user_id = auth.uid()),
        'free'
      ) <> 'free'
      OR price_cents = 0
    )
  );

-- 3. Stripe Payment Links (creator's own account, not River's) + traffic
-- tracking + provider-agnostic hosting field.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS monthly_visit_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visit_count_month TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  ADD COLUMN IF NOT EXISTS deployment_provider TEXT NOT NULL DEFAULT 'vercel';

-- Webhook signing secret is sensitive - it does NOT go on creator_profiles
-- (that table is publicly readable, row-level, for the public creator
-- page). It goes on creator_payout_details, which is already owner+admin
-- only, same treatment as other creator-private data.
ALTER TABLE public.creator_payout_details
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;

-- 4. Webhook failure log for manual review in admin.
CREATE TABLE public.webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  raw_payload JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false
);

GRANT ALL ON public.webhook_failures TO service_role;
GRANT SELECT, UPDATE ON public.webhook_failures TO authenticated;

ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook failures" ON public.webhook_failures
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update webhook failures" ON public.webhook_failures
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 5. Free products can be self-granted (no payment involved at all).
CREATE POLICY "Users can claim free products" ON public.entitlements
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.products
      WHERE id = product_id AND price_cents = 0 AND status = 'published'
    )
  );
