import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Github, Globe, Twitter } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} · River` },
      { name: "description", content: `Products and updates from @${params.username} on River.` },
      { property: "og:title", content: `@${params.username} on River` },
    ],
  }),
  component: CreatorPage,
  errorComponent: () => <NotFound />,
  notFoundComponent: () => <NotFound />,
});

function NotFound() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-4xl font-semibold">Creator not found</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Back to discover
        </Link>
      </div>
    </div>
  );
}

function CreatorPage() {
  const { username } = Route.useParams();
  const { user } = useSession();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["creator", username],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, bio, creator_profiles(tagline, long_bio, website, x_handle, github_handle)",
        )
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!profile) throw notFound();

      const [{ data: products }, { count: followers }] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, slug, title, tagline, cover_image_url, category, price_cents, currency, pricing_model",
          )
          .eq("creator_id", profile.id)
          .eq("status", "published")
          .order("published_at", { ascending: false }),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("creator_id", profile.id),
      ]);

      const enriched: ProductCardData[] = (products ?? []).map((p) => ({
        ...p,
        creator: {
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        },
      }));

      return { profile, products: enriched, followers: followers ?? 0 };
    },
  });

  useEffect(() => {
    if (!user || !data?.profile.id) return;
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("creator_id", data.profile.id)
      .maybeSingle()
      .then(({ data: row }) => setIsFollowing(!!row));
  }, [user, data?.profile.id]);

  async function handleFollow() {
    if (!user || !data) {
      toast("Sign in to follow", { description: "Create an account in a few seconds." });
      return;
    }
    if (user.id === data.profile.id) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().match({ follower_id: user.id, creator_id: data.profile.id });
        setIsFollowing(false);
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, creator_id: data.profile.id });
        setIsFollowing(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="border-b border-border bg-surface/40">
        <div className="container-page py-12">
          {isLoading || !data ? (
            <Skeleton className="h-32 w-full max-w-xl rounded-2xl bg-surface" />
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-2 font-display text-2xl">
                  {data.profile.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h1 className="font-display text-3xl font-semibold tracking-tight">
                    {data.profile.display_name}
                  </h1>
                  <p className="font-mono text-sm text-muted-foreground">@{data.profile.username}</p>
                  {data.profile.creator_profiles?.tagline && (
                    <p className="mt-3 max-w-xl text-sm">{data.profile.creator_profiles.tagline}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <span className="font-mono text-foreground">{data.followers}</span> followers
                    </span>
                    {data.profile.creator_profiles?.website && (
                      <a
                        href={data.profile.creator_profiles.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Globe className="size-3" /> Website
                      </a>
                    )}
                    {data.profile.creator_profiles?.x_handle && (
                      <span className="inline-flex items-center gap-1">
                        <Twitter className="size-3" /> {data.profile.creator_profiles.x_handle}
                      </span>
                    )}
                    {data.profile.creator_profiles?.github_handle && (
                      <span className="inline-flex items-center gap-1">
                        <Github className="size-3" /> {data.profile.creator_profiles.github_handle}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {user?.id !== data.profile.id && (
                <Button
                  onClick={handleFollow}
                  disabled={followBusy}
                  variant={isFollowing ? "outline" : "default"}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="container-page py-10">
        <h2 className="font-display text-xl font-semibold">Products</h2>
        {isLoading ? (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl bg-surface" />
            ))}
          </div>
        ) : data && data.products.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No published products yet.</p>
        )}
      </section>
    </div>
  );
}
