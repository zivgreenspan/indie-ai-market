import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "River — the marketplace for AI-built software" },
      {
        name: "description",
        content:
          "Discover apps and tools built by independent creators with AI. Follow makers, buy directly, and keep 90% with creators.",
      },
    ],
  }),
  component: Home,
});

async function fetchFeatured(): Promise<ProductCardData[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, tagline, cover_image_url, category, price_cents, currency, pricing_model, creator:profiles!products_creator_id_fkey(username, display_name, avatar_url)",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(12);

  if (error) throw error;
  return (data ?? [])
    .filter((p) => !!p.creator)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      tagline: p.tagline,
      cover_image_url: p.cover_image_url,
      category: p.category as string,
      price_cents: p.price_cents,
      currency: p.currency,
      pricing_model: p.pricing_model as "one_time" | "subscription",
      creator: p.creator as ProductCardData["creator"],
    }));
}

function Home() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: fetchFeatured,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-50">
          <div className="absolute -top-32 left-1/4 size-[480px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute right-0 top-32 size-[360px] rounded-full bg-accent/10 blur-[120px]" />
        </div>
        <div className="container-page py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3 text-primary" /> The marketplace for AI-built software
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              Apps from creators
              <br />
              you actually <span className="text-primary">trust</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              River is where indie builders ship the software they made with AI — and where you find the
              good stuff, follow the makers behind it, and pay them directly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-medium">
                <Link to="/explore">
                  Start exploring <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/become-creator">Sell on River</Link>
              </Button>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:grid-cols-3">
              <Feature icon={<Zap className="size-4 text-primary" />} label="90% to creators" />
              <Feature icon={<ShieldCheck className="size-4 text-primary" />} label="Tax & VAT handled globally" />
              <Feature icon={<Sparkles className="size-4 text-primary" />} label="Curated, not algorithmic" />
            </dl>
          </div>
        </div>
      </section>

      <section className="container-page py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Fresh on River</h2>
            <p className="mt-1 text-sm text-muted-foreground">The latest software shipped by creators.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <span
                key={c.value}
                className="rounded-full border border-border px-3 py-1 font-mono text-xs uppercase tracking-wide text-muted-foreground"
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl bg-surface" />
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyDiscover />
        )}
      </section>

      <footer className="mt-12 border-t border-border">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-8 text-xs text-muted-foreground">
          <div className="font-mono uppercase tracking-wider">river · {new Date().getFullYear()}</div>
          <div>Built for creators. Powered by Stripe Connect.</div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function EmptyDiscover() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface/30 px-6 py-20 text-center">
      <h3 className="font-display text-2xl font-semibold">Nothing here yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        River is brand new. The first products are landing soon — or you could be one of them.
      </p>
      <Button asChild className="mt-6">
        <Link to="/become-creator">Be one of the first creators</Link>
      </Button>
    </div>
  );
}
