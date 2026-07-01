-- Creator subscription tiers: free (1 product) vs pro (unlimited, $9/mo).
-- No payment logic here (PAYMENTS_LIVE is still false) - tier is set
-- manually via admin for now. stripe_subscription_id/current_period_end
-- are reserved for the future Stripe Billing integration so this table
-- doesn't need to change shape when that lands.

CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro');

CREATE TABLE public.creator_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier public.subscription_tier NOT NULL DEFAULT 'free',
  source text NOT NULL DEFAULT 'manual',
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.creator_subscriptions TO authenticated;
GRANT ALL ON public.creator_subscriptions TO service_role;

ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view their subscription" ON public.creator_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions" ON public.creator_subscriptions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_creator_subscriptions_updated_at
  BEFORE UPDATE ON public.creator_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Free tier is capped at 1 product (draft or published, doesn't matter).
-- Pro is unlimited. Missing row = free (COALESCE), so existing creators
-- don't need a backfill for this to take effect.
CREATE OR REPLACE FUNCTION private.can_create_product(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT tier FROM public.creator_subscriptions WHERE user_id = _user_id),
      'free'
    ) = 'pro'
    OR (SELECT count(*) FROM public.products WHERE creator_id = _user_id) < 1;
$$;

REVOKE ALL ON FUNCTION private.can_create_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_create_product(uuid) TO authenticated;

DROP POLICY IF EXISTS "Creators can insert their own products" ON public.products;
CREATE POLICY "Creators can insert their own products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = creator_id
    AND private.has_role(auth.uid(), 'creator')
    AND private.can_create_product(auth.uid())
  );
