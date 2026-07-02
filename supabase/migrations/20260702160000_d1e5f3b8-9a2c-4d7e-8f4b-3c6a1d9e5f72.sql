-- Drop dead Lemon Squeezy columns left over from the abandoned LS
-- integration attempt (ruled out: its terms prohibit third-party
-- marketplace models like River's). Nothing in the app references any of
-- these - confirmed via a full search of src/. Payment is now per-creator
-- Stripe Payment Links (products.stripe_payment_link_url,
-- purchases.stripe_checkout_session_id/stripe_payment_intent_id).
--
-- Dependent indexes (products_ls_variant_idx,
-- purchases_ls_order_item_unique) are dropped automatically by Postgres
-- along with their columns.
ALTER TABLE public.products
  DROP COLUMN IF EXISTS lemon_squeezy_product_id,
  DROP COLUMN IF EXISTS lemon_squeezy_variant_id;

ALTER TABLE public.purchases
  DROP COLUMN IF EXISTS lemon_squeezy_order_id,
  DROP COLUMN IF EXISTS lemon_squeezy_order_item_id,
  DROP COLUMN IF EXISTS lemon_squeezy_customer_id;
