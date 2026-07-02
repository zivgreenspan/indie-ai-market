import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const becomeCreatorSchema = z.object({
  tagline: z.string().min(4).max(140),
  long_bio: z.string().max(2000).optional().nullable(),
  website: z.string().url().optional().or(z.literal("")).nullable(),
  x_handle: z.string().max(60).optional().nullable(),
  github_handle: z.string().max(60).optional().nullable(),
  payout_method: z.enum(["paypal", "bank"]).optional().nullable(),
  payout_email: z.string().email().optional().or(z.literal("")).nullable(),
  payout_details: z.string().max(2000).optional().nullable(),
  stripe_webhook_secret: z.string().max(500).optional().nullable(),
});

export const becomeCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => becomeCreatorSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only stamp subscription_started_at/trial_ends_at the first time this
    // creator ever submits this form - re-submitting to edit a tagline
    // shouldn't reset their trial clock, and an admin may have already
    // moved them off the free tier.
    const { data: existing } = await supabaseAdmin
      .from("creator_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    const now = new Date();
    const trialEnds = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const { error: upsertErr } = await supabaseAdmin.from("creator_profiles").upsert(
      {
        user_id: userId,
        tagline: data.tagline,
        long_bio: data.long_bio || null,
        website: data.website || null,
        x_handle: data.x_handle || null,
        github_handle: data.github_handle || null,
        ...(existing
          ? {}
          : {
              creator_subscription_tier: "free" as const,
              subscription_started_at: now.toISOString(),
              trial_ends_at: trialEnds.toISOString(),
            }),
      },
      { onConflict: "user_id" },
    );
    if (upsertErr) throw new Error(upsertErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "creator" });
    // Ignore unique-violation: user is already a creator.
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }

    // Payout destination and the Stripe webhook secret are both optional
    // and independent of each other - a creator might come back later just
    // to paste a webhook secret without re-entering payout details. Merge
    // with whatever's already on file instead of blindly overwriting, so
    // resubmitting this form can't silently wipe an earlier setting.
    const hasNewPayoutInput = !!(data.payout_method || data.payout_email || data.payout_details);
    const hasNewWebhookSecret = !!data.stripe_webhook_secret;
    if (hasNewPayoutInput || hasNewWebhookSecret) {
      const { data: existingPayout } = await supabaseAdmin
        .from("creator_payout_details")
        .select("payout_method, payout_email, payout_details, stripe_webhook_secret")
        .eq("user_id", userId)
        .maybeSingle();

      const { error: payoutErr } = await supabaseAdmin.from("creator_payout_details").upsert(
        {
          user_id: userId,
          payout_method: hasNewPayoutInput
            ? data.payout_method || null
            : (existingPayout?.payout_method ?? null),
          payout_email: hasNewPayoutInput
            ? data.payout_method === "paypal"
              ? data.payout_email || null
              : null
            : (existingPayout?.payout_email ?? null),
          payout_details: hasNewPayoutInput
            ? data.payout_details
              ? { notes: data.payout_details }
              : null
            : (existingPayout?.payout_details ?? null),
          stripe_webhook_secret: hasNewWebhookSecret
            ? data.stripe_webhook_secret
            : (existingPayout?.stripe_webhook_secret ?? null),
        },
        { onConflict: "user_id" },
      );
      if (payoutErr) throw new Error(payoutErr.message);
    }

    return { ok: true };
  });
