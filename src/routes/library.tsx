import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Library as LibraryIcon, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Your library · River" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const { user, isLoading: sessionLoading } = useSession();

  const { data: items, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["library", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entitlements")
        .select(
          "product:products(id, slug, title, tagline, cover_image_url, category, price_cents, currency, pricing_model, creator:profiles!products_creator_id_fkey(username, display_name, avatar_url))",
        )
        .eq("user_id", user!.id)
        .eq("active", true);
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.product)
        .filter((p): p is NonNullable<typeof p> => !!p && !!p.creator) as unknown as ProductCardData[];
    },
  });

  return (
    <main className="container-page py-10">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-surface p-2 text-muted-foreground">
          <LibraryIcon className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold">Your library</h1>
          <p className="text-sm text-muted-foreground">Every product you have access to.</p>
        </div>
      </div>

      {!user && !sessionLoading ? (
        <SignInPrompt
          title="Sign in to view your library"
          description="Your purchases and active entitlements live here."
        />
      ) : isLoading || sessionLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl bg-surface" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/30 p-12 text-center">
          <p className="font-display text-2xl">Your shelf is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse what creators are shipping right now.
          </p>
          <Button asChild className="mt-6">
            <Link to="/explore">Discover products</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

function SignInPrompt({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/30 p-12 text-center">
      <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground">
        <Lock className="size-5" />
      </div>
      <p className="mt-4 font-display text-2xl">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
  );
}
