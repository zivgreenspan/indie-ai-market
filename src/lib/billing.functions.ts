import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Exposes only what Paddle.js needs to run in the browser: the
// client-side token (safe to expose - that's its purpose, distinct from
// PADDLE_API_KEY which never leaves the server) and the three price ids.
// PADDLE_API_KEY and PADDLE_WEBHOOK_SECRET are never touched here.
export const getPaddleConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      clientToken: process.env.PADDLE_CLIENT_TOKEN ?? null,
      environment: process.env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox",
      prices: {
        creator: process.env.PADDLE_PRICE_CREATOR ?? null,
        builder: process.env.PADDLE_PRICE_BUILDER ?? null,
        studio: process.env.PADDLE_PRICE_STUDIO ?? null,
      },
    };
  });
