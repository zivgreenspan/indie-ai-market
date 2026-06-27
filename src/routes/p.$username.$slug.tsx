import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Github, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/p/$username/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} by @${params.username} · Stak` },
      { name: "description", content: `A product by @${params.username} on Stak.` },
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
  const navigate = useNavigate();
  const { user } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["product", username, slug],
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

      const { data: ratings } = await supabase
        .from("ratings")
        .select("stars, title, body, created_at, user:profiles!ratings_user_id_fkey(username, display_name)")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const avg =
        ratings && ratings.length > 0
          ? ratings.reduce((s, r) => s + (r.stars ?? 0), 0) / ratings.length
          : null;

      let entitled = false;
      if (user) {
        const { data: ent } = await supabase
          .from("entitlements")
          .select("active")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();
        entitled = !!ent?.active;
      }

      return { product, creator, ratings: ratings ?? [], avg, entitled };
    },
  });

  function handleBuy() {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: window.location.pathname } });
      return;
    }
    toast.info("Checkout opens once Stripe Connect is wired up", {
      description: "We're connecting Stripe in the next step of the build.",
    });
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

  const { product, creator, ratings, avg, entitled } = data;

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
              <p className="font-mono text-3xl font-semibold">
                {formatPrice(product.price_cents, product.currency, product.pricing_model)}
              </p>
              <p className="text-xs text-muted-foreground">
                {product.pricing_model === "subscription" ? "Recurring access" : "One-time purchase, lifetime access"}
              </p>

              {entitled ? (
                <Button className="mt-5 w-full" disabled>
                  You own this
                </Button>
              ) : (
                <Button className="mt-5 w-full font-medium" onClick={handleBuy}>
                  {user ? "Buy now" : "Sign in to buy"}
                </Button>
              )}

              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Payment processed by Stripe. Refunds within 7 days.
              </div>
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
