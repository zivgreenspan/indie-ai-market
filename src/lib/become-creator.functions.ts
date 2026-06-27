import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const becomeCreatorSchema = z.object({
  tagline: z.string().min(4).max(140),
  long_bio: z.string().max(2000).optional().nullable(),
  website: z.string().url().optional().or(z.literal("")).nullable(),
  x_handle: z.string().max(60).optional().nullable(),
  github_handle: z.string().max(60).optional().nullable(),
});

export const becomeCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => becomeCreatorSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: upsertErr } = await supabaseAdmin.from("creator_profiles").upsert(
      {
        user_id: userId,
        tagline: data.tagline,
        long_bio: data.long_bio || null,
        website: data.website || null,
        x_handle: data.x_handle || null,
        github_handle: data.github_handle || null,
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

    return { ok: true };
  });
