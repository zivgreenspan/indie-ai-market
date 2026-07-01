// Flip this once Paddle (or whatever processor we land on) is actually wired
// up and taking real charges. Until then, product pages show a waitlist CTA
// instead of a buy button, and entitlements only come from admin manual
// grants (see /admin → Users) or a future payment webhook.
export const PAYMENTS_LIVE = false;
