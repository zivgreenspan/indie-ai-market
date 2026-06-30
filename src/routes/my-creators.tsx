import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/my-creators")({
  head: () => ({ meta: [{ title: "My creators · River" }] }),
  component: MyCreatorsPage,
});

type CreatorWithProducts = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  products: ProductCardData[];
};

function MyCreatorsPage() {
  const { user, loading: sessionLoading } = useSession();

  const { data: creators, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-creators", user?.id],
    queryFn: async (): Promise<CreatorWithProducts[]> => {
      const { data: follows, error } = await supabase
        .from("follows")
        .select("creator:profiles!follows_creator_id_fkey(id, username, display_name, avatar_url, bio)")
        .eq("follower_id", user!.id);
      if (error) throw error;

      const creatorList = (follows ?? [])
        .map((row) => row.creator)
        .filter((c): c is NonNullable<typeof c> => !!c);

      if (creatorList.length === 0) return [];

      const ids = creatorList.map((c) => c.id);
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select(
          "id, slug, title, tagline, cover_image_url, category, price_cents, currency, pricing_model, created_at, creator_id, creator:profiles!products_creator_id_fkey(username, display_name, avatar_url)",
        )
        .eq("status", "published")
        .in("creator_id", ids)
        .order("created_at", { ascending: false });
      if (prodErr) throw prodErr;

      return creatorList.map((c) => ({
        ...c,
        products: ((products ?? []).filter((p) => p.creator_id === c.id).slice(0, 3) as unknown) as ProductCardData[],
      }));
    },
  });

  return (
    <>
    <SiteHeader />
    <main className="container-page py-10">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-surface p-2 text-muted-foreground">
          <Users className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold">My creators</h1>
          <p className="text-sm text-muted-foreground">Latest from the creators you follow.</p>
        </div>
      </div>

      {!user && !sessionLoading ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/30 p-12 text-center">
          <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground">
            <Lock className="size-5" />
          </div>
          <p className="mt-4 font-display text-2xl">Sign in to see your creators</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow creators to get their latest products here.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create account
              </Link>
            </Button>
          </div>
        </div>
      ) : isLoading || sessionLoading ? (
        <div className="mt-8 space-y-8">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl bg-surface" />
          ))}
        </div>
      ) : !creators || creators.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/30 p-12 text-center">
          <p className="font-display text-2xl">You're not following anyone yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover creators and follow the ones you trust.
          </p>
          <Button asChild className="mt-6">
            <Link to="/explore">Explore creators</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {creators.map((c) => (
            <section key={c.id}>
              <div className="flex items-center justify-between gap-4">
                <Link
                  to="/c/$username"
                  params={{ username: c.username }}
                  className="flex items-center gap-3 group"
                >
                  <span className="inline-flex size-10 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-mono text-sm">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="size-full object-cover" />
                    ) : (
                      (c.display_name ?? c.username).slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div>
                    <p className="font-display text-lg font-medium group-hover:text-primary">
                      {c.display_name ?? c.username}
                    </p>
                    <p className="text-xs text-muted-foreground">@{c.username}</p>
                  </div>
                </Link>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/c/$username" params={{ username: c.username }}>
                    View profile
                  </Link>
                </Button>
              </div>
              {c.products.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No published products yet.</p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {c.products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
