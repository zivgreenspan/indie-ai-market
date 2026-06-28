
-- Payout method enum
CREATE TYPE public.payout_method AS ENUM ('paypal', 'wise', 'bank');
CREATE TYPE public.earning_status AS ENUM ('pending', 'available', 'paid', 'reversed');
CREATE TYPE public.payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');

-- creator_profiles: add payout fields
ALTER TABLE public.creator_profiles
  ADD COLUMN payout_method public.payout_method,
  ADD COLUMN payout_email TEXT,
  ADD COLUMN payout_details JSONB NOT NULL DEFAULT '{}'::jsonb;

-- products: swap stripe -> lemon squeezy
ALTER TABLE public.products
  DROP COLUMN IF EXISTS stripe_product_id,
  DROP COLUMN IF EXISTS stripe_price_id,
  ADD COLUMN lemon_squeezy_product_id TEXT,
  ADD COLUMN lemon_squeezy_variant_id TEXT;

CREATE INDEX products_ls_variant_idx ON public.products(lemon_squeezy_variant_id);

-- purchases: swap stripe -> lemon squeezy
ALTER TABLE public.purchases
  DROP COLUMN IF EXISTS stripe_checkout_session_id,
  DROP COLUMN IF EXISTS stripe_payment_intent_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  ADD COLUMN lemon_squeezy_order_id TEXT,
  ADD COLUMN lemon_squeezy_order_item_id TEXT,
  ADD COLUMN lemon_squeezy_customer_id TEXT,
  ADD COLUMN subtotal_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX purchases_ls_order_item_unique
  ON public.purchases(lemon_squeezy_order_item_id)
  WHERE lemon_squeezy_order_item_id IS NOT NULL;

-- creator_earnings ledger
CREATE TABLE public.creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  gross_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  processor_fee_cents INTEGER NOT NULL DEFAULT 0,
  net_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.earning_status NOT NULL DEFAULT 'pending',
  available_at TIMESTAMPTZ NOT NULL,
  payout_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (purchase_id)
);

GRANT SELECT ON public.creator_earnings TO authenticated;
GRANT ALL ON public.creator_earnings TO service_role;

ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators view own earnings"
  ON public.creator_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins view all earnings"
  ON public.creator_earnings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_creator_earnings_updated_at
  BEFORE UPDATE ON public.creator_earnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX creator_earnings_creator_status_idx
  ON public.creator_earnings(creator_id, status);

-- payouts
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method public.payout_method NOT NULL,
  destination TEXT NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'pending',
  reference TEXT,
  notes TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators view own payouts"
  ON public.payouts FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins view all payouts"
  ON public.payouts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.creator_earnings
  ADD CONSTRAINT creator_earnings_payout_fk
  FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE SET NULL;
