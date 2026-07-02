// Superseded by the per-creator "bring your own Stripe Payment Link" model:
// paid products now go live per-product as soon as a creator pastes a
// Payment Link (see products.stripe_payment_link_url), not via a single
// River-wide processor switch. Kept as a harmless export in case anything
// still imports it; no longer read anywhere in the app.
export const PAYMENTS_LIVE = false;
