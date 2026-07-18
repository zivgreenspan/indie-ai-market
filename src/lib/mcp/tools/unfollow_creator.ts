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
  name: "unfollow_creator",
  title: "Unfollow creator",
  description: "Stop following a River creator. Idempotent.",
  inputSchema: { username: z.string().describe("Username of the creator to unfollow.") },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: true, openWorldHint: false },
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
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", ctx.getUserId())
      .eq("creator_id", profile.id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Unfollowed @${profile.username}.` }] };
  },
});
