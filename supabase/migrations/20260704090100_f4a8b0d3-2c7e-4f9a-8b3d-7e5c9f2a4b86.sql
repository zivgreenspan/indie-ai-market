-- Second half of the 'rejected' product status migration (must run as a
-- separate execution from the ALTER TYPE ADD VALUE above, since Postgres
-- won't allow a brand-new enum value to be used in the same transaction
-- it was added in).

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DROP POLICY IF EXISTS "Creators can update their own products" ON public.products;
CREATE POLICY "Creators can update their own products" ON public.products
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id AND status <> 'rejected'::product_status);
