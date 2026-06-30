
-- Featured product flag
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(featured) WHERE featured = true;

-- Creator suspension flag
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- Admin write policies
DROP POLICY IF EXISTS "Admins can update earnings" ON public.creator_earnings;
CREATE POLICY "Admins can update earnings" ON public.creator_earnings
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert earnings" ON public.creator_earnings;
CREATE POLICY "Admins can insert earnings" ON public.creator_earnings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert payouts" ON public.payouts;
CREATE POLICY "Admins can insert payouts" ON public.payouts
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update payouts" ON public.payouts;
CREATE POLICY "Admins can update payouts" ON public.payouts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage creator profiles" ON public.creator_profiles;
CREATE POLICY "Admins can manage creator profiles" ON public.creator_profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles list" ON public.profiles;
-- profiles already publicly readable

DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all purchases (for earnings join)
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.purchases;
CREATE POLICY "Admins can view all purchases" ON public.purchases
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
