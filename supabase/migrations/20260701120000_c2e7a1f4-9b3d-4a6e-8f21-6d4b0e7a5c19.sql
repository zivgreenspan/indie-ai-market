-- Access gating support.
--
-- The prior "Fixed payout auth security" migration moved has_role/has_entitlement
-- into a `private` schema but never granted `authenticated` USAGE on that schema
-- or EXECUTE on the functions themselves. Every RLS policy that calls
-- private.has_role(...)/private.has_entitlement(...) directly (products, reports,
-- creator_earnings, payouts, creator_profiles, purchases, ratings, user_roles)
-- would therefore raise "permission denied for function" for any authenticated
-- caller, admin or not. Restore those grants.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_entitlement(uuid, uuid) TO authenticated;

-- private.* is intentionally not exposed to PostgREST, so the access-gating
-- route needs a public, RPC-callable wrapper around has_entitlement.
CREATE OR REPLACE FUNCTION public.has_entitlement(_user_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_entitlement(_user_id, _product_id);
$$;

REVOKE ALL ON FUNCTION public.has_entitlement(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, uuid) TO authenticated;

-- Let admins write entitlements directly (manual grants for testing ahead of
-- Paddle/webhooks). Regular users still cannot write their own.
GRANT INSERT, UPDATE ON public.entitlements TO authenticated;

DROP POLICY IF EXISTS "Admins can manage all entitlements" ON public.entitlements;
CREATE POLICY "Admins can manage all entitlements"
  ON public.entitlements FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
