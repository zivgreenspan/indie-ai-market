import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search River's public catalog of published products. Filter by free-text query, category, or a specific creator's username. Returns up to 20 published products with title, tagline, price, category, and creator.",
  inputSchema: {
    query: z.string().optional().describe("Free-text search across title, tagline, and description."),
    category: z.string().optional().describe("Product category slug (e.g. developer_tools, design)."),
    creator_username: z.string().optional().describe("Restrict to a single creator by username."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results, default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, creator_username, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let creatorId: string | undefined;
    if (creator_username) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", creator_username)
        .maybeSingle();
      if (!profile) {
        return { content: [{ type: "text", text: `No creator with username "${creator_username}".` }] };
      }
      creatorId = profile.id;
    }

    let q = supabase
      .from("products")
      .select("id,title,slug,tagline,description,price_cents,currency,category,pricing_model,creator:profiles!products_creator_id_fkey(username,display_name)")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit ?? 20);

    if (category) q = q.eq("category", category);
    if (creatorId) q = q.eq("creator_id", creatorId);
    if (query && query.trim()) {
      const term = `%${query.trim()}%`;
      q = q.or(`title.ilike.${term},tagline.ilike.${term},description.ilike.${term}`);
    }

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Search failed: ${error.message}` }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
