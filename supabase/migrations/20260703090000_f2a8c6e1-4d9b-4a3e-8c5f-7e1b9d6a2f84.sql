-- Security fix: public.has_entitlement(uuid, uuid) is SECURITY DEFINER and
-- was exposed to PostgREST as an RPC callable by any authenticated user with
-- an arbitrary _user_id argument, letting anyone check anyone else's
-- entitlement to any product (a real cross-user data leak, independent of
-- the entitlements table's own RLS, since SECURITY DEFINER functions bypass
-- RLS by design).
--
-- Confirmed via a full search of src/ that nothing in the app actually calls
-- this RPC - access.$productId.tsx checks entitlements by querying the table
-- directly under the caller's own RLS ("Users can view their own
-- entitlements", USING auth.uid() = user_id), not via this function. The
-- wrapper was added in 20260701120000 for a "future access-gating route"
-- that was never built this way. It is dead surface area - drop it.
--
-- private.has_entitlement(uuid, uuid) is untouched: it is not exposed to
-- PostgREST (private schema isn't in the API schema list) and is only
-- invoked internally by RLS policies (products, purchases, ratings, etc.),
-- which is safe and is how entitlement checks should keep happening.
DROP FUNCTION IF EXISTS public.has_entitlement(uuid, uuid);

-- Defense-in-depth re-assertion: confirm payout fields are not on
-- creator_profiles. This was already done by 20260701103836 and re-asserted
-- by 20260702150000; a fresh Lovable security scan flagged it again, so
-- re-running this idempotent drop costs nothing and rules out any drift
-- between the migration history and the live schema.
ALTER TABLE public.creator_profiles
  DROP COLUMN IF EXISTS payout_method,
  DROP COLUMN IF EXISTS payout_email,
  DROP COLUMN IF EXISTS payout_details;
