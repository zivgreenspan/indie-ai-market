-- Re-assert that payout fields are gone from the publicly-readable
-- creator_profiles table. These were already split out to
-- creator_payout_details (owner/admin-only RLS) by migration
-- 20260701103836, which also dropped them from creator_profiles - this is
-- an idempotent no-op if that already landed, and a real fix if the live
-- database ever drifted from migration history for any reason.
--
-- creator_profiles keeps a public SELECT policy (USING (true)) because
-- it backs public creator profile pages - that's fine as long as nothing
-- sensitive lives in the table. Payout method/email/details do not
-- belong here; they stay exclusively on creator_payout_details.
ALTER TABLE public.creator_profiles
  DROP COLUMN IF EXISTS payout_method,
  DROP COLUMN IF EXISTS payout_email,
  DROP COLUMN IF EXISTS payout_details;
