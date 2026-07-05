import { createFileRoute } from "@tanstack/react-router";

// River's own Paddle account bills creators directly for platform access
// tiers (separate from the per-creator Stripe Payment Links used for
// individual product sales). There's a single global webhook signing
// secret for this endpoint (PADDLE_WEBHOOK_SECRET), unlike the Stripe
// webhook where each creator brings their own secret - so we can verify
// the signature up front before looking at anything in the payload.

type PaddleTier = "creator" | "builder" | "studio";

function priceIdToTier(priceId: string | null | undefined): PaddleTier | null {
  if (!priceId) return null;
  if (priceId === process.env.PADDLE_PRICE_CREATOR) return "creator";
  if (priceId === process.env.PADDLE_PRICE_BUILDER) return "builder";
  if (priceId === process.env.PADDLE_PRICE_STUDIO) return "studio";
  return null;
}

async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Paddle-Signature header looks like: "ts=1671552777;h1=<hex hmac>"
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(";")) {
    const [key, value] = part.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`));
  const computedHex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHex.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ h1.charCodeAt(i);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/webhooks/paddle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        async function logFailure(
          errorMessage: string,
          eventType: string | null,
          payload: unknown = null,
        ) {
          await supabaseAdmin.from("webhook_failures").insert({
            provider: "paddle",
            event_type: eventType,
            error_message: errorMessage,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: payload as any,
          });
        }

        const signature = request.headers.get("paddle-signature");
        const rawBody = await request.text();

        if (!signature) {
          await logFailure("missing_paddle_signature_header", null);
          return new Response("Missing signature", { status: 400 });
        }

        const secret = process.env.PADDLE_WEBHOOK_SECRET;
        if (!secret) {
          await logFailure("paddle_webhook_secret_not_configured", null);
          return new Response("Webhook secret not configured", { status: 500 });
        }

        const verified = await verifyPaddleSignature(rawBody, signature, secret);
        if (!verified) {
          await logFailure("signature_verification_failed", null);
          return new Response("Signature verification failed", { status: 400 });
        }

        let event: {
          event_type?: string;
          data?: {
            id?: string;
            status?: string;
            custom_data?: Record<string, unknown> | null;
            items?: { price?: { id?: string } }[];
          };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          await logFailure("invalid_json_body", null);
          return new Response("Invalid payload", { status: 400 });
        }

        const eventType = event.event_type ?? null;
        const data = event.data ?? {};
        const subscriptionId = data.id ?? null;
        const userId = (data.custom_data?.user_id as string | undefined) ?? null;

        if (eventType === "subscription.created" || eventType === "subscription.activated") {
          if (!userId || !subscriptionId) {
            await logFailure("missing_user_id_or_subscription_id", eventType, event);
            return new Response("Missing custom_data.user_id or subscription id", { status: 400 });
          }

          const priceId = data.items?.[0]?.price?.id ?? null;
          const tier = priceIdToTier(priceId);
          if (!tier) {
            await logFailure(`unrecognized_price_id: ${priceId ?? "none"}`, eventType, event);
            return new Response("Unrecognized price id", { status: 400 });
          }

          const { error } = await supabaseAdmin
            .from("creator_profiles")
            .update({
              creator_subscription_tier: tier,
              subscription_started_at: new Date().toISOString(),
              paddle_subscription_id: subscriptionId,
            })
            .eq("user_id", userId);

          if (error) {
            await logFailure(`creator_profiles_update_failed: ${error.message}`, eventType, event);
            return new Response("Failed to update creator subscription", { status: 500 });
          }

          return new Response("ok", { status: 200 });
        }

        if (eventType === "subscription.canceled" || eventType === "subscription.past_due") {
          // Prefer custom_data.user_id (present on the subscription object for
          // every event Paddle sends), falling back to matching on the
          // Paddle subscription id we stored at activation time in case
          // custom_data is ever missing from a particular event payload.
          let targetUserId = userId;
          if (!targetUserId && subscriptionId) {
            const { data: match } = await supabaseAdmin
              .from("creator_profiles")
              .select("user_id")
              .eq("paddle_subscription_id", subscriptionId)
              .maybeSingle();
            targetUserId = match?.user_id ?? null;
          }

          if (!targetUserId) {
            await logFailure("missing_user_id_for_cancellation", eventType, event);
            return new Response("Missing custom_data.user_id and no matching subscription", {
              status: 400,
            });
          }

          // Existing free-tier gating (product caps, trial expiry) already
          // handles what a "free" creator can/can't do elsewhere in the app -
          // their existing published products stay live, they just can't
          // publish new ones until they resubscribe.
          const { error } = await supabaseAdmin
            .from("creator_profiles")
            .update({ creator_subscription_tier: "free" })
            .eq("user_id", targetUserId);

          if (error) {
            await logFailure(
              `creator_profiles_downgrade_failed: ${error.message}`,
              eventType,
              event,
            );
            return new Response("Failed to downgrade creator subscription", { status: 500 });
          }

          return new Response("ok", { status: 200 });
        }

        return new Response("ignored", { status: 200 });
      },
    },
  },
});
