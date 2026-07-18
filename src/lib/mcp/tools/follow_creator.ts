import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "follow_creator",
  title: "Follow creator",
  description: "Follow a River creator on behalf of the signed-in user. Idempotent.",
  inputSchema: { username: z.string().describe("Username of the creator to follow.") },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ username }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,username,display_name")
      .eq("username", username)
      .maybeSingle();
    if (!profile) return { content: [{ type: "text", text: "Creator not found." }], isError: true };
    if (profile.id === ctx.getUserId()) {
      return { content: [{ type: "text", text: "You cannot follow yourself." }], isError: true };
    }
    const { error } = await supabase
      .from("follows")
      .upsert(
        { follower_id: ctx.getUserId(), creator_id: profile.id },
        { onConflict: "follower_id,creator_id" },
      );
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Now following ${profile.display_name} (@${profile.username}).` }],
    };
  },
});
