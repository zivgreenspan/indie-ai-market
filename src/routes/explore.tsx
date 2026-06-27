import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { CATEGORIES } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore · Stak" },
      { name: "description", content: "Browse every app and tool published by creators on Stak." },
    ],
  }),
  component: Explore,
});

async function fetchAll(): Promise<ProductCardData[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, tagline, cover_image_url, category, price_cents, currency, pricing_model, creator:profiles!products_creator_id_fkey(username, display_name, avatar_url)",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((p) => !!p.creator)
    .map((p) => ({ ...p, creator: p.creator })) as unknown as ProductCardData[];
}

function Explore() {
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["products", "all"], queryFn: fetchAll });

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        (p.tagline?.toLowerCase().includes(needle) ?? false) ||
        p.creator.username.toLowerCase().includes(needle)
      );
    });
  }, [data, category, q]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-page py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">Explore</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every product live on Stak right now.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products or creators"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl bg-surface" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/30 p-12 text-center text-sm text-muted-foreground">
            Nothing matches that filter.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
