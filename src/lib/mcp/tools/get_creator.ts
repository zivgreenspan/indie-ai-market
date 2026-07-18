import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_creator",
  title: "Get creator",
  description:
    "Fetch a creator's public profile by username, including their published products.",
  inputSchema: { username: z.string().describe("River username of the creator.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ username }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url")
      .eq("username", username)
      .maybeSingle();
    if (!profile) return { content: [{ type: "text", text: "Creator not found." }], isError: true };

    const { data: products } = await supabase
      .from("products")
      .select("id,title,slug,tagline,price_cents,currency,category,pricing_model")
      .eq("creator_id", profile.id)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    const result = { ...profile, products: products ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
