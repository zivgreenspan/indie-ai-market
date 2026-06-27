# Scope Confirmation

A creator marketplace for AI-built web apps. Key decisions locked in from your answers:

- **Single account model.** Everyone signs up as a user; "becoming a creator" is an opt-in flow (complete creator profile + Stripe Connect onboarding).
- **Product = gated hosted web app.** Purchase grants persistent authenticated access to a creator's hosted app URL. No downloads, no external redirects. Same delivery for one-time and subscription.
- **Stripe Connect from day one.** Creators onboard Express accounts. All charges go through the platform with a 10% application fee; funds settle directly to the creator. Platform never holds funds.
- **Railway auto-deploy is V2.** MVP stores a GitHub URL + hosted app URL on the product; we do not build the deploy pipeline yet.
- **Design:** dark-mode-friendly, minimal, trust-forward, strong creator identity.

# Architectural Risks to Flag Before Building

1. **Stripe Connect requires BYOK Stripe, not Lovable's built-in payments.** Lovable's seamless payments make the platform the merchant of record, which is the opposite of what Connect does. We need the BYOK Stripe path plus your Stripe secret key stored as a secret. This is a hard fork in the road — confirm before we wire it.
2. **Gating hosted apps you don't control is hard.** A creator's app lives on their own infrastructure (until V2 Railway). To gate it behind a platform login, the creator's app has to verify entitlements with us. Realistic MVP options: (a) a short-lived signed access token in the URL that the creator's app validates against our `/api/public/verify-entitlement` endpoint, or (b) a platform-rendered iframe wrapper that checks entitlement then loads the creator URL. Option (a) is cleaner; option (b) is faster but iframe-hostile apps will break. **Pick one before building.**
3. **Subscriptions + Connect + 10% fee = `application_fee_percent` on a Connect subscription.** Straightforward but requires webhook handling for `invoice.paid`, `customer.subscription.deleted`, `charge.refunded` to keep entitlements in sync. Non-trivial; budget for it.
4. **Creator can't sell until Stripe onboarding is `charges_enabled`.** Need a clear "pending verification" state on creator profile + product listing.
5. **Refunds and chargebacks revoke access.** Webhook-driven entitlement revocation must exist day one or you'll have angry creators.
6. **Ratings/reviews need moderation hooks even in MVP** (report button + admin role) — a marketplace without this gets gamed fast.
7. `**profiles` vs `creator_profiles` split** — keep them separate so a regular user joining doesn't carry empty creator fields, and so Stripe Connect data is isolated.
8. **Roles in a separate table.** Per platform security rules, `admin` / `creator` / `user` go in `user_roles`, never on profiles. Checked via a `has_role` security-definer function in RLS.

# Proposed Database Schema (MVP)

```text
profiles                        — 1:1 with auth.users; everyone has one
  id (uuid, FK auth.users)      display_name, username (unique), avatar_url,
                                  bio, created_at

user_roles                      — separate roles table (security requirement)
  user_id, role (enum: user|creator|admin), unique(user_id, role)

creator_profiles                — only present once a user opts in
  user_id (PK, FK profiles)     tagline, long_bio, website, x_handle,
                                  github_handle, stripe_account_id,
                                  stripe_charges_enabled (bool),
                                  stripe_payouts_enabled (bool),
                                  onboarded_at

products
  id, creator_id (FK profiles)  slug (unique per creator), title, tagline,
                                  description (md), cover_image_url, gallery[],
                                  category, tags[],
                                  pricing_model (one_time | subscription),
                                  price_cents, currency,
                                  stripe_product_id, stripe_price_id,
                                  hosted_app_url,           — where the app lives
                                  github_repo_url (nullable),
                                  status (draft|published|unlisted|removed),
                                  published_at, created_at, updated_at

purchases                       — one row per successful checkout / sub start
  id, user_id, product_id,      stripe_checkout_session_id,
                                  stripe_payment_intent_id (one-time) or
                                  stripe_subscription_id (sub),
                                  amount_cents, platform_fee_cents,
                                  status (active|canceled|refunded|past_due),
                                  current_period_end (sub only),
                                  created_at

entitlements                    — derived "can this user access this product right now"
  user_id, product_id,          source_purchase_id, active (bool),
                                  expires_at (nullable, for subs),
                                  unique(user_id, product_id)

follows
  follower_id, creator_id,      created_at, unique(follower_id, creator_id)

ratings
  id, user_id, product_id,      stars (1-5), title, body,
                                  unique(user_id, product_id),  — one per buyer
                                  created_at, updated_at
                                — INSERT policy requires active entitlement

comments                        — threaded discussion on a product page
  id, user_id, product_id,      parent_id (nullable), body, created_at

reports                         — moderation hook for ratings/comments/products
  id, reporter_id, target_type, target_id, reason, status, created_at
```

RLS posture:

- `profiles`, `creator_profiles`, `products` (published), `ratings`, `comments`, `follows` → public SELECT for published rows.
- Writes scoped to `auth.uid()` ownership.
- `purchases` and `entitlements` → only the owning user can SELECT; writes happen only via Stripe webhook with service role.
- `user_roles` → SELECT for self; writes admin-only via `has_role`.

# Proposed MVP Build Order

1. **Foundation** — Enable Lovable Cloud, run schema migration (tables, enums, GRANTs, RLS, `has_role` function), set up auth (email + Google), build `/auth` page, ship the `_authenticated` layout.
2. **Profiles + role opt-in** — Profile page, "Become a creator" flow that creates `creator_profiles` row and grants the `creator` role.
3. **Discovery surface (public)** — Home (curated/featured), `/c/:username` creator page, `/p/:creator/:slug` product page. SSR-friendly with public `TO anon` policies. SEO metadata per route.
4. **Creator dashboard** — `/dashboard` (sales, followers), `/dashboard/products` CRUD.
5. **Stripe Connect** — Enable BYOK Stripe, add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. Server functions: create Connect Express account, generate onboarding link, sync `charges_enabled`. Create product → mirror to Stripe Product+Price on creator's connected account.
6. **Checkout + webhooks** — Server fn to create Checkout Session with `application_fee_percent: 10` (one-time) or subscription equivalent. Public webhook route at `/api/public/webhooks/stripe` with signature verification; writes `purchases` and `entitlements`; handles refund/cancel revocation.
7. **Access gating** — `/access/:productId` route checks entitlement, mints a short-lived signed token, redirects to `hosted_app_url?lt_token=...`. Document the verification endpoint creators call to validate the token.
8. **Social layer** — Follows, ratings (gated by entitlement), comments, basic report button.
9. **Polish** — Empty states, loading, error/not-found boundaries, OG images on product/creator pages.

V2 (not built now): Railway deploy pipeline, payouts dashboard, refunds UI, search, notifications, PWA wrapper.

# Questions Before I Write Code

1. **Access gating mechanism — signed token handoff or iframe wrap?** This is the single biggest UX decision; I recommend signed token.
2. **Subscriptions in MVP, or one-time only for v1?** Subs roughly double the webhook + entitlement-lifecycle work. Shipping one-time first is much faster; subs can land a week later.
3. **Categories — fixed list (we curate) or creator free-text + tags?** Curated lists feel more "trust-forward marketplace"; free-text is faster but messier.
4. **Confirm BYOK Stripe is acceptable.** You'll need to paste a `STRIPE_SECRET_KEY` from your platform Stripe account (the one that owns the Connect application). I'll prompt for it when we get to step 5.

Answer these four and I'll start building from step 1.  
  
  
Here's the full answer block to paste into Lovable:

---

**1. Access gating — signed token or iframe?** Neither. We're changing the philosophy here. Hosting is now mandatory, not optional. The creator submits their app and we host it on our infrastructure. We control the front door entirely — no token handoff, no verification step the creator has to implement, no documentation burden. When a user purchases, we flip an entitlement flag and they get access. Clean and seamless. Drop the hosted_app_url external URL approach entirely.

**2. Subscriptions in MVP or one-time only?** One-time purchases only for MVP. Design the schema to support subscriptions later but don't build the webhook lifecycle or UI for it now.

**3. Categories — fixed list or free-text?** Fixed curated category list. Initial categories: productivity, creative tools, developer tools, finance, education, other. Creator picks one primary category plus optional free-text tags.

**4. BYOK Stripe confirmed?** Confirmed, BYOK Stripe is acceptable. The secret key will be provided when we reach step 5.

**5. Hosting costs?** Hosting is free for creators in the MVP. No billing infrastructure needed for it. The only money flowing through the platform is the 10% transaction fee via Stripe Connect. Hosting is a customer acquisition cost at this stage, not a revenue line. We will introduce hosting tiers in V2 once there is meaningful traffic to justify it.