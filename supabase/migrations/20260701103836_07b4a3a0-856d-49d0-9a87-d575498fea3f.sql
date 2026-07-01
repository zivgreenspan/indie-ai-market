
-- 1. Private schema for internal helpers
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- 2. Recreate helper functions in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.has_entitlement(_user_id uuid, _product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements
    WHERE user_id = _user_id AND product_id = _product_id AND active = true
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_entitlement(uuid, uuid) FROM PUBLIC;

-- 3. Drop and recreate all policies that reference public.has_role/has_entitlement
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Creators can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
DROP POLICY IF EXISTS "Owners with entitlement can rate" ON public.ratings;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
DROP POLICY IF EXISTS "Admins view all earnings" ON public.creator_earnings;
DROP POLICY IF EXISTS "Admins can update earnings" ON public.creator_earnings;
DROP POLICY IF EXISTS "Admins can insert earnings" ON public.creator_earnings;
DROP POLICY IF EXISTS "Admins view all payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can insert payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can update payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can manage creator profiles" ON public.creator_profiles;
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.purchases;

CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creators can insert their own products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND private.has_role(auth.uid(), 'creator'));
CREATE POLICY "Admins can manage all products" ON public.products FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners with entitlement can rate" ON public.ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND private.has_entitlement(auth.uid(), product_id));
CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all earnings" ON public.creator_earnings FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update earnings" ON public.creator_earnings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert earnings" ON public.creator_earnings FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all payouts" ON public.payouts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert payouts" ON public.payouts FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update payouts" ON public.payouts FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage creator profiles" ON public.creator_profiles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all purchases" ON public.purchases FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- 4. Drop the public copies now that nothing references them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_entitlement(uuid, uuid);

-- 5. Split payout data into a private-access table
CREATE TABLE IF NOT EXISTS public.creator_payout_details (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method public.payout_method,
  payout_email text,
  payout_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.creator_payout_details (user_id, payout_method, payout_email, payout_details)
SELECT user_id, payout_method, payout_email, payout_details
FROM public.creator_profiles
WHERE payout_method IS NOT NULL OR payout_email IS NOT NULL OR payout_details IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.creator_profiles
  DROP COLUMN IF EXISTS payout_method,
  DROP COLUMN IF EXISTS payout_email,
  DROP COLUMN IF EXISTS payout_details;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_payout_details TO authenticated;
GRANT ALL ON public.creator_payout_details TO service_role;

ALTER TABLE public.creator_payout_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view payout details" ON public.creator_payout_details
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner can upsert payout details" ON public.creator_payout_details
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update payout details" ON public.creator_payout_details
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage payout details" ON public.creator_payout_details
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_creator_payout_details_updated_at
  BEFORE UPDATE ON public.creator_payout_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
