import { useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/access/$productId")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { productId } = params;

    // Public read: enough to know where to send people back to, regardless
    // of whether they're signed in or entitled.
    const { data: product } = await supabase
      .from("products")
      .select("id, slug, hosted_app_url, creator:profiles!products_creator_id_fkey(username)")
      .eq("id", productId)
      .maybeSingle();

    if (!product || !product.creator) {
      throw redirect({ to: "/explore" });
    }

    const productPage = {
      to: "/p/$username/$slug" as const,
      params: { username: product.creator.username, slug: product.slug },
    };

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "signin" as const,
          redirect: `/p/${product.creator.username}/${product.slug}`,
        },
      });
    }

    const { data: isEntitled } = await supabase.rpc("has_entitlement", {
      _user_id: user.id,
      _product_id: product.id,
    });

    if (!isEntitled) {
      throw redirect({ ...productPage, search: { access: "denied" as const } });
    }

    if (!product.hosted_app_url) {
      throw redirect({ ...productPage, search: { access: "not-ready" as const } });
    }

    return { hostedUrl: product.hosted_app_url };
  },
  component: AccessRedirect,
});

function AccessRedirect() {
  const { hostedUrl } = Route.useRouteContext();

  useEffect(() => {
    window.location.replace(hostedUrl);
  }, [hostedUrl]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container-page flex flex-col items-center justify-center gap-3 py-32 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">One sec</p>
        <p className="text-lg text-foreground">Opening the app…</p>
      </div>
    </div>
  );
}
