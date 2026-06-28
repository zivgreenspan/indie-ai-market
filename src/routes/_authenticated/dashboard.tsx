import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CreditCard, Package, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Creator dashboard · River" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();

  const { data: overview, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const uid = user!.id;
      const [creator, products, follows] = await Promise.all([
        supabase.from("creator_profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("products").select("id, title, status, price_cents, currency, pricing_model, slug").eq("creator_id", uid),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("creator_id", uid),
      ]);
      return {
        creator: creator.data,
        products: products.data ?? [],
        followers: follows.count ?? 0,
      };
    },
  });

  const payoutsReady = false;
  const products = overview?.products ?? [];
  const published = products.filter((p) => p.status === "published").length;

  return (
    <main className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your creator command center.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/products">Manage products</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/products/new">New product</Link>
          </Button>
        </div>
      </div>

      {!stripeReady && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="font-medium">Connect Stripe to start selling</p>
              <p className="text-sm text-muted-foreground">
                Payouts land directly in your bank. River takes a 10% platform fee. Nothing else.
              </p>
            </div>
          </div>
          <Button disabled variant="outline" className="font-mono text-xs uppercase">
            Coming up next
          </Button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label="Published products"
          value={isLoading ? null : `${published}`}
          sub={`${products.length} total`}
          icon={<Package className="size-4" />}
        />
        <Stat
          label="Followers"
          value={isLoading ? null : `${overview?.followers ?? 0}`}
          sub="People watching your work"
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Revenue (MTD)"
          value="$0"
          sub="Live once Stripe is connected"
          icon={<ArrowUpRight className="size-4" />}
        />
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Your products</h2>
          <Link to="/dashboard/products" className="text-xs text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>

        {isLoading ? (
          <Skeleton className="mt-4 h-40 rounded-2xl bg-surface" />
        ) : products.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
            <p className="font-display text-xl">Nothing shipped yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your first product is the hardest. Let's get it up.
            </p>
            <Button asChild className="mt-5">
              <Link to="/dashboard/products/new">Create your first product</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
            {products.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono uppercase tracking-wide">{p.status}</span> ·{" "}
                    {formatPrice(p.price_cents, p.currency, p.pricing_model)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | null;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold">
        {value === null ? <Skeleton className="h-9 w-16" /> : value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
