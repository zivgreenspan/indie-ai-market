import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_product",
  title: "Get product",
  description:
    "Fetch a single published product by creator username and product slug. Returns full details including description, pricing, category, tags, and creator profile.",
  inputSchema: {
    creator_username: z.string().describe("The creator's River username."),
    slug: z.string().describe("The product slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ creator_username, slug }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url")
      .eq("username", creator_username)
      .maybeSingle();
    if (!profile) return { content: [{ type: "text", text: "Creator not found." }], isError: true };

    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("creator_id", profile.id)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!product) return { content: [{ type: "text", text: "Product not found." }], isError: true };

    const result = { ...product, creator: profile };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
