import { useEffect } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Check, Github, Lock, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";

const TRAFFIC_LIMIT = 150;

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

const searchSchema = z.object({
  access: z.enum(["denied", "not-ready", "capped"]).optional(),
});

export const Route = createFileRoute("/p/$username/$slug")({
  validateSearch: (s) => searchSchema.parse(s),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} by @${params.username} · River` },
      { name: "description", content: `A product by @${params.username} on River.` },
      { property: "og:title", content: `${params.slug} by @${params.username}` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProductPage,
  notFoundComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-4xl font-semibold">Product not found</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-primary">
          Back to discover
        </Link>
      </div>
    </div>
  ),
});

function ProductPage() {
  const { username, slug } = Route.useParams();
  const { access } = Route.useSearch();
  const navigate = useNavigate();
  const scopedNavigate = Route.useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!access) return;
    if (access === "denied") {
      toast.error("You don't have access to that yet", {
        description: "Purchase or request access before opening the app.",
      });
    } else if (access === "not-ready") {
      toast.info("This app is being set up, check back soon");
    } else if (access === "capped") {
      toast.error("This app has reached its visitor limit for this month");
    }
    scopedNavigate({ search: () => ({}), replace: true });
  }, [access, scopedNavigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["product", username, slug, user?.id],
    queryFn: async () => {
      const { data: creator } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("username", username)
        .maybeSingle();
      if (!creator) throw notFound();

      const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("creator_id", creator.id)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      if (!product) throw notFound();

      const { data: creatorProfile } = await supabase
        .from("creator_profiles")
        .select("creator_subscription_tier")
        .eq("user_id", creator.id)
        .maybeSingle();
      const tier = creatorProfile?.creator_subscription_tier ?? "free";

      const { data: ratings } = await supabase
        .from("ratings")
        .select(
          "stars, title, body, created_at, user:profiles!ratings_user_id_fkey(username, display_name)",
        )
        .eq("product_id", product.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const avg =
        ratings && ratings.length > 0
          ? ratings.reduce((s, r) => s + (r.stars ?? 0), 0) / ratings.length
          : null;

      let entitled = false;
      let onWaitlist = false;
      if (user) {
        const { data: ent } = await supabase
          .from("entitlements")
          .select("active, expires_at")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();
        entitled = !!ent?.active && (!ent.expires_at || new Date(ent.expires_at) > new Date());

        const { data: wl } = await supabase
          .from("waitlist_signups")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();
        onWaitlist = !!wl;
      }

      const trafficCapped =
        tier === "free" &&
        product.visit_count_month === currentMonthKey() &&
        product.monthly_visit_count >= TRAFFIC_LIMIT;

      return {
        product,
        creator,
        tier,
        ratings: ratings ?? [],
        avg,
        entitled,
        onWaitlist,
        trafficCapped,
      };
    },
  });

  const waitlistMutation = useMutation({
    mutationFn: async ({ productId, join }: { productId: string; join: boolean }) => {
      if (!user) throw new Error("Not signed in");
      if (join) {
        const { error } = await supabase
          .from("waitlist_signups")
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("waitlist_signups")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.join ? "You're on the list" : "Removed from waitlist");
      queryClient.invalidateQueries({ queryKey: ["product", username, slug] });
      queryClient.invalidateQueries({ queryKey: ["waitlist", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getAccessMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("entitlements")
        .upsert(
          { user_id: user.id, product_id: productId, active: true, expires_at: null },
          { onConflict: "user_id,product_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You're in");
      queryClient.invalidateQueries({ queryKey: ["product", username, slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleGetAccess(productId: string) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: window.location.pathname } });
      return;
    }
    getAccessMutation.mutate(productId);
  }

  function handleWaitlist(productId: string, currentlyOn: boolean) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: window.location.pathname } });
      return;
    }
    waitlistMutation.mutate({ productId, join: !currentlyOn });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="container-page py-10">
          <Skeleton className="h-96 rounded-2xl bg-surface" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { product, creator, ratings, avg, entitled, onWaitlist, trafficCapped } = data;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <article className="container-page py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface-2">
              {product.cover_image_url ? (
                <img
                  src={product.cover_image_url}
                  alt={product.title}
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center font-display text-6xl text-muted-foreground/40">
                  {product.title.slice(0, 1)}
                </div>
              )}
            </div>

            <div className="mt-6">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {categoryLabel(product.category)}
              </span>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
                {product.title}
              </h1>
              {product.tagline && (
                <p className="mt-2 text-lg text-muted-foreground">{product.tagline}</p>
              )}
            </div>

            {product.description && (
              <div className="prose prose-invert mt-8 max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {product.description}
              </div>
            )}

            <section className="mt-10 border-t border-border pt-8">
              <h2 className="font-display text-xl font-semibold">Reviews</h2>
              {ratings.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {ratings.map((r, i) => (
                    <li key={i} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">@{r.user?.username ?? "anon"}</span>
                          <span className="inline-flex items-center gap-0.5 text-primary">
                            {Array.from({ length: r.stars }).map((_, i) => (
                              <Star key={i} className="size-3 fill-current" />
                            ))}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                      {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-3xl font-semibold text-accent">
                {formatPrice(product.price_cents, product.currency, product.pricing_model)}
              </p>
              <p className="text-xs text-muted-foreground">
                {product.pricing_model === "subscription"
                  ? "Recurring access"
                  : "One-time purchase, lifetime access"}
              </p>

              {entitled ? (
                trafficCapped ? (
                  <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
                    <Lock className="size-4 shrink-0" />
                    This app has reached its visitor limit for this month.
                  </div>
                ) : (
                  <Button asChild className="mt-5 w-full font-medium">
                    <Link to="/access/$productId" params={{ productId: product.id }}>
                      Open App
                    </Link>
                  </Button>
                )
              ) : product.price_cents === 0 ? (
                <Button
                  className="mt-5 w-full font-medium"
                  onClick={() => handleGetAccess(product.id)}
                  disabled={getAccessMutation.isPending}
                >
                  {user ? "Get Access" : "Sign in to get access"}
                </Button>
              ) : product.stripe_payment_link_url ? (
                <Button asChild className="mt-5 w-full font-medium">
                  <a href={product.stripe_payment_link_url} target="_blank" rel="noreferrer">
                    Buy
                  </a>
                </Button>
              ) : (
                <div className="mt-5 space-y-2">
                  <Button className="w-full font-medium" variant="outline" disabled>
                    Coming soon
                  </Button>
                  <Button
                    className="w-full font-medium"
                    variant={onWaitlist ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleWaitlist(product.id, onWaitlist)}
                    disabled={waitlistMutation.isPending}
                  >
                    {!user ? (
                      "Sign in to join waitlist"
                    ) : onWaitlist ? (
                      <>
                        <Check className="mr-2 size-4" /> On waitlist — click to leave
                      </>
                    ) : (
                      "Join waitlist"
                    )}
                  </Button>
                </div>
              )}

              {product.price_cents > 0 && (
                <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  Payment and refunds are handled directly by the creator via Stripe.
                </div>
              )}
            </div>

            <Link
              to="/c/$username"
              params={{ username: creator.username }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-surface-2 font-display">
                {creator.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{creator.display_name}</p>
                <p className="font-mono text-xs text-muted-foreground">@{creator.username}</p>
              </div>
              <span className="text-xs text-primary">View →</span>
            </Link>

            {avg !== null && (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="font-mono text-2xl font-semibold">{avg.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">
                  Average over {ratings.length} review{ratings.length === 1 ? "" : "s"}
                </p>
              </div>
            )}

            {product.github_repo_url && (
              <a
                href={product.github_repo_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm transition-colors hover:border-primary/30"
              >
                <Github className="size-4" /> View source on GitHub
              </a>
            )}
          </aside>
        </div>
      </article>
    </div>
  );
}
