import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/use-auth";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/products/")({
  head: () => ({ meta: [{ title: "Products · River" }] }),
  component: ProductsList,
});

function ProductsList() {
  const { user } = useSession();
  const { profile } = useProfile(user?.id);

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("creator_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you've shipped on River.</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/products/new">
            <Plus className="mr-1 size-4" /> New product
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-64 rounded-2xl bg-surface" />
      ) : !data || data.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/30 p-12 text-center">
          <p className="font-display text-2xl">No products yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ship your first one in under five minutes.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard/products/new">Create a product</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Price</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Deployment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-surface/40">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{categoryLabel(p.category)}</td>
                  <td className="px-4 py-3 font-mono text-accent">
                    {formatPrice(p.price_cents, p.currency, p.pricing_model)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <DeploymentPill status={p.deployment_status} />
                  </td>

                  <td className="px-4 py-3 text-right">
                    {p.status === "published" && profile && (
                      <Link
                        to="/p/$username/$slug"
                        params={{ username: profile.username, slug: p.slug }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        View <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-success/15 text-success",
    draft: "bg-surface-2 text-muted-foreground",
    unlisted: "bg-warning/15 text-warning",
    removed: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
        map[status] ?? "bg-surface-2 text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

function DeploymentPill({ status }: { status: string }) {
  if (!status || status === "none") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const map: Record<string, string> = {
    pending: "bg-accent/15 text-accent",
    deploying: "bg-primary/15 text-primary",
    live: "bg-success/15 text-success",
    failed: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
        map[status] ?? "bg-surface-2 text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
