import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

// Creators bring their own Stripe account (no Connect), so each one adds
// this same URL as a webhook endpoint in their own Stripe dashboard - which
// means each creator's endpoint has its own signing secret. We can't know
// which secret to verify against until we know which creator/product this
// event is about, so we peek at the (unverified) metadata first purely to
// look up the right secret, then verify the signature before trusting
// anything else in the payload.
export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        async function logFailure(errorMessage: string, extra: Record<string, unknown> = {}) {
          const payload = extra.payload as { type?: string } | undefined;
          await supabaseAdmin.from("webhook_failures").insert({
            provider: "stripe",
            event_type: payload?.type ?? null,
            error_message: errorMessage,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: (extra.payload ?? null) as any,
          });
        }

        const signature = request.headers.get("stripe-signature");
        const rawBody = await request.text();

        if (!signature) {
          await logFailure("missing_stripe_signature_header");
          return new Response("Missing signature", { status: 400 });
        }

        let unverified: { data?: { object?: Record<string, unknown> } } & Record<string, unknown>;
        try {
          unverified = JSON.parse(rawBody);
        } catch {
          await logFailure("invalid_json_body");
          return new Response("Invalid payload", { status: 400 });
        }

        const sessionObj = (unverified?.data?.object ?? {}) as Record<string, unknown>;
        const metadata = (sessionObj.metadata ?? {}) as Record<string, string>;
        const productId: string | null = metadata.product_id ?? null;
        // River sets client_reference_id automatically on every Buy click
        // (see the p/$username/$slug Buy button), so it's the reliable
        // primary source for the buyer's id. metadata.user_id is kept only
        // as a fallback for links set up before that existed.
        const buyerUserId: string | null =
          (sessionObj.client_reference_id as string | undefined) ?? metadata.user_id ?? null;

        if (!productId || !buyerUserId) {
          await logFailure(`missing_metadata (productId=${productId ?? "none"})`, {
            payload: unverified,
          });
          return new Response("Missing product_id/user_id metadata", { status: 400 });
        }

        const { data: product } = await supabaseAdmin
          .from("products")
          .select("id, creator_id")
          .eq("id", productId)
          .maybeSingle();

        if (!product) {
          await logFailure(`product_not_found (productId=${productId})`, { payload: unverified });
          return new Response("Unknown product", { status: 400 });
        }

        const { data: payoutDetails } = await supabaseAdmin
          .from("creator_payout_details")
          .select("stripe_webhook_secret")
          .eq("user_id", product.creator_id)
          .maybeSingle();

        const secret = payoutDetails?.stripe_webhook_secret;
        if (!secret) {
          await logFailure(
            `creator_missing_webhook_secret (productId=${productId}, creatorId=${product.creator_id})`,
            { payload: unverified },
          );
          return new Response("Creator has not configured a webhook secret", { status: 400 });
        }

        const stripe = new Stripe("sk_not_used_for_webhook_verification", {
          httpClient: Stripe.createFetchHttpClient(),
        });

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
        } catch (err) {
          await logFailure(
            `signature_verification_failed: ${err instanceof Error ? err.message : "unknown"} (productId=${productId}, creatorId=${product.creator_id})`,
            { payload: unverified },
          );
          return new Response("Signature verification failed", { status: 400 });
        }

        if (event.type !== "checkout.session.completed") {
          return new Response("ignored", { status: 200 });
        }

        const session = event.data.object as Stripe.Checkout.Session;
        const verifiedMetadata = session.metadata ?? {};
        const verifiedProductId = verifiedMetadata.product_id ?? productId;
        const verifiedUserId =
          session.client_reference_id ?? verifiedMetadata.user_id ?? buyerUserId;

        if (!verifiedProductId || !verifiedUserId) {
          await logFailure(
            `missing_metadata_in_verified_event (productId=${verifiedProductId}, creatorId=${product.creator_id})`,
            { payload: event },
          );
          return new Response("Missing metadata", { status: 400 });
        }

        const { error: purchaseErr } = await supabaseAdmin.from("purchases").insert({
          user_id: verifiedUserId,
          product_id: verifiedProductId,
          amount_cents: session.amount_total ?? 0,
          currency: (session.currency ?? "usd").toLowerCase(),
          status: "active",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
        // Ignore unique-violation on the checkout session id - Stripe retries
        // webhook delivery, and we don't want duplicate purchase rows.
        if (purchaseErr && !purchaseErr.message.toLowerCase().includes("duplicate")) {
          await logFailure(
            `purchase_insert_failed: ${purchaseErr.message} (productId=${verifiedProductId}, creatorId=${product.creator_id})`,
            { payload: event },
          );
          return new Response("Failed to record purchase", { status: 500 });
        }

        const { error: entErr } = await supabaseAdmin.from("entitlements").upsert(
          {
            user_id: verifiedUserId,
            product_id: verifiedProductId,
            active: true,
            expires_at: null,
          },
          { onConflict: "user_id,product_id" },
        );
        if (entErr) {
          await logFailure(
            `entitlement_upsert_failed: ${entErr.message} (productId=${verifiedProductId}, creatorId=${product.creator_id})`,
            { payload: event },
          );
          return new Response("Failed to grant entitlement", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
