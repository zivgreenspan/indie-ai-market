import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search_products";
import getProduct from "./tools/get_product";
import getCreator from "./tools/get_creator";
import myLibrary from "./tools/my_library";
import myFollows from "./tools/my_follows";
import myWaitlists from "./tools/my_waitlists";
import followCreator from "./tools/follow_creator";
import unfollowCreator from "./tools/unfollow_creator";

// OAuth issuer must be the direct Supabase host (not the .lovable.cloud proxy)
// or mcp-js rejects tokens with an issuer mismatch. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time; the fallback keeps the URL well-formed during
// the manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "river-mcp",
  title: "River",
  version: "0.1.0",
  instructions:
    "Tools for River, a marketplace of AI-built software. Browse the public catalog with search_products / get_product / get_creator. When signed in, use my_library, my_follows, and my_waitlists to see the user's own activity, and follow_creator / unfollow_creator to manage who they follow.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchProducts,
    getProduct,
    getCreator,
    myLibrary,
    myFollows,
    myWaitlists,
    followCreator,
    unfollowCreator,
  ],
});
