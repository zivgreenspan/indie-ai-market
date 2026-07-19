import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRAFFIC_LIMIT = 150;

const schema = z.object({ productId: z.string().uuid() });

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// Records a "visit" (an actual open of the hosted app via /access/$productId)
// and reports back whether this free-tier product has hit its monthly
// traffic cap. Runs with the service role since a random buyer isn't the
// product owner and has no RLS UPDATE grant on the products row - this is
// the one narrow, server-verified write we allow on their behalf.
//
// Gated by requireSupabaseAuth + an explicit entitlement check below: this
// is a directly POST-able server function, not just a client route, so
// /access/$productId's own beforeLoad checks don't protect it - anyone who
// knows a productId could otherwise call it repeatedly to inflate
// monthly_visit_count and force a competitor's free-tier app into its
// traffic cap early, locking out real paying customers. Requiring the
// caller to hold an active entitlement for this exact product means only a
// genuine access (one that already cost the caller a purchase or a
// legitimate free claim) can move the counter.
export const recordProductVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: entitlement } = await supabaseAdmin
      .from("entitlements")
      .select("active, expires_at")
      .eq("user_id", userId)
      .eq("product_id", data.productId)
      .maybeSingle();
    const isEntitled =
      !!entitlement?.active &&
      (!entitlement.expires_at || new Date(entitlement.expires_at) > new Date());
    if (!isEntitled) throw new Error("Not entitled to this product");

    const { data: product, error: productErr } = await supabaseAdmin
      .from("products")
      .select("id, creator_id, monthly_visit_count, visit_count_month")
      .eq("id", data.productId)
      .maybeSingle();
    if (productErr || !product) throw new Error("Product not found");

    const { data: creator } = await supabaseAdmin
      .from("creator_profiles")
      .select("creator_subscription_tier")
      .eq("user_id", product.creator_id)
      .maybeSingle();
    const tier = creator?.creator_subscription_tier ?? "free";

    const month = currentMonthKey();
    const sameMonth = product.visit_count_month === month;
    const nextCount = sameMonth ? product.monthly_visit_count + 1 : 1;
    const capped = tier === "free" && nextCount > TRAFFIC_LIMIT;

    // Rolling into a new month: the outgoing month's count is final and
    // about to be overwritten, so archive it before that happens. This is
    // the only place a month boundary is ever detected (there's no cron -
    // resets are lazy, triggered by the next visit after the boundary), so
    // it's also the only place a history snapshot can be recorded. One row
    // per product per month; onConflict makes this safe if a retried
    // request ever raced another visit into archiving the same month twice.
    if (!sameMonth) {
      const { error: historyErr } = await supabaseAdmin.from("product_traffic_history").upsert(
        {
          product_id: product.id,
          month: product.visit_count_month,
          visit_count: product.monthly_visit_count,
        },
        { onConflict: "product_id,month" },
      );
      // Don't let a history-logging hiccup block the actual visit/entitlement
      // check the caller is waiting on - analytics is a read-only nice-to-have,
      // the traffic cap enforcement below is not.
      if (historyErr) {
        console.error("product_traffic_history upsert failed", historyErr.message);
      }
    }

    // Keep persisting/rolling over the counter even past the cap so a new
    // month still resets correctly, but stop incrementing once we know
    // this visit is blocked so the number doesn't grow unbounded.
    if (!capped) {
      await supabaseAdmin
        .from("products")
        .update({ monthly_visit_count: nextCount, visit_count_month: month })
        .eq("id", product.id);
    }

    return { capped };
  });
