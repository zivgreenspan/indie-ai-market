import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
export const recordProductVisit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
