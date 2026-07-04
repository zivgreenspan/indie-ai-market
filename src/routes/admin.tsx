import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth", search: { mode: "signin" as const, redirect: "/admin" } });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw redirect({ to: "/" });

  },
  head: () => ({ meta: [{ title: "Admin · River" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <>
      <SiteHeader />
      <main className="container-page py-10">
        <h1 className="font-display text-3xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">Operations console. Visible only to admins.</p>
        <Tabs defaultValue="payouts" className="mt-6">
          <TabsList className="bg-surface">
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="creators">Creators</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="webhooks">Webhook failures</TabsTrigger>
          </TabsList>
          <TabsContent value="payouts" className="mt-6"><PayoutsSection /></TabsContent>
          <TabsContent value="deployments" className="mt-6"><DeploymentsSection /></TabsContent>
          <TabsContent value="reports" className="mt-6"><ReportsSection /></TabsContent>
          <TabsContent value="creators" className="mt-6"><CreatorsSection /></TabsContent>
          <TabsContent value="products" className="mt-6"><ProductsSection /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersSection /></TabsContent>
          <TabsContent value="webhooks" className="mt-6"><WebhookFailuresSection /></TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface/40">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-muted-foreground">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

/* ============== PAYOUTS ============== */
function PayoutsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_earnings")
        .select(
          "id, status, gross_cents, platform_fee_cents, net_cents, currency, available_at, created_at, creator:profiles!creator_earnings_creator_id_fkey(username, display_name), product:products(title)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markPaid = useMutation({
    mutationFn: async ({ id, reference, date }: { id: string; reference: string; date: string }) => {
      const { error } = await supabase
        .from("creator_earnings")
        .update({
          status: "paid",
          notes: `Paid ${date}${reference ? ` · ref ${reference}` : ""}`,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["admin", "earnings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <TableShell>
      <thead className="border-b border-border bg-surface">
        <tr><Th>Creator</Th><Th>Product</Th><Th>Gross</Th><Th>Fee</Th><Th>Net</Th><Th>Status</Th><Th>Available</Th><Th>Mark paid</Th></tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(data ?? []).map((r) => (
          <PayoutRow key={r.id} row={r} onPay={(v) => markPaid.mutate({ id: r.id, ...v })} />
        ))}
        {(!data || data.length === 0) && <tr><Td className="text-muted-foreground"><span>No earnings yet.</span></Td></tr>}
      </tbody>
    </TableShell>
  );
}

function PayoutRow({ row, onPay }: { row: any; onPay: (v: { reference: string; date: string }) => void }) {
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <tr>
      <Td>@{row.creator?.username ?? "—"}</Td>
      <Td>{row.product?.title ?? "—"}</Td>
      <Td className="font-mono text-accent">{formatPrice(row.gross_cents, row.currency, "one_time")}</Td>
      <Td className="font-mono">{formatPrice(row.platform_fee_cents, row.currency, "one_time")}</Td>
      <Td className="font-mono text-accent">{formatPrice(row.net_cents, row.currency, "one_time")}</Td>
      <Td><StatusPill value={row.status} /></Td>
      <Td className="text-muted-foreground text-xs">{row.available_at ? new Date(row.available_at).toLocaleDateString() : "—"}</Td>
      <Td>
        {row.status === "paid" ? (
          <span className="text-muted-foreground text-xs">Paid</span>
        ) : (
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36" />
            <Input placeholder="Reference" value={ref} onChange={(e) => setRef(e.target.value)} className="h-8 w-32" />
            <Button size="sm" onClick={() => onPay({ reference: ref, date })}>Mark paid</Button>
          </div>
        )}
      </Td>
    </tr>
  );
}

function StatusPill({ value }: { value: string }) {
  const cls =
    value === "paid"
      ? "bg-primary/15 text-primary"
      : value === "available"
        ? "bg-accent/15 text-accent"
        : value === "published" || value === "active" || value === "resolved" || value === "live"
          ? "bg-success/15 text-success"
          : value === "unlisted"
            ? "bg-warning/15 text-warning"
            : value === "removed" || value === "rejected" || value === "suspended"
              ? "bg-destructive/15 text-destructive"
              : value === "open" || value === "pending"
                ? "bg-surface-2 text-muted-foreground"
                : "bg-surface-2 text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-xs uppercase ${cls}`}>{value}</span>;
}

/* ============== DEPLOYMENTS ============== */
function DeploymentsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "deployments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, github_repo_url, hosted_app_url, deployment_status, deployment_provider, creator:profiles!products_creator_id_fkey(username)",
        )
        .in("deployment_status", ["pending", "failed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markLive = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const { error } = await supabase
        .from("products")
        .update({ hosted_app_url: url, deployment_status: "live" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked live");
      qc.invalidateQueries({ queryKey: ["admin", "deployments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        GitHub-repo deployments go through River's single Vercel account via the Vercel API. This
        flow is still manual: deploy the repo yourself, paste the resulting Vercel URL below, and
        mark it live.
      </p>
      <TableShell>
        <thead className="border-b border-border bg-surface">
          <tr><Th>Creator</Th><Th>Product</Th><Th>Repo</Th><Th>Provider</Th><Th>Status</Th><Th>Vercel URL → mark live</Th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(data ?? []).map((r) => (
            <DeploymentRow key={r.id} row={r} onLive={(url) => markLive.mutate({ id: r.id, url })} />
          ))}
          {(!data || data.length === 0) && <tr><Td className="text-muted-foreground"><span>No pending deployments.</span></Td></tr>}
        </tbody>
      </TableShell>
    </div>
  );
}

function DeploymentRow({ row, onLive }: { row: any; onLive: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <tr>
      <Td>@{row.creator?.username ?? "—"}</Td>
      <Td>{row.title}</Td>
      <Td>{row.github_repo_url ? <a className="text-primary hover:underline" href={row.github_repo_url} target="_blank" rel="noreferrer">repo</a> : "—"}</Td>
      <Td className="font-mono text-xs uppercase text-muted-foreground">{row.deployment_provider ?? "vercel"}</Td>
      <Td><StatusPill value={row.deployment_status} /></Td>
      <Td>
        <div className="flex items-center gap-2">
          <Input placeholder="https://your-app.vercel.app" value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 w-64" />
          <Button size="sm" onClick={() => url && onLive(url)}>Mark live</Button>
        </div>
      </Td>
    </tr>
  );
}

/* ============== REPORTS ============== */
type ReportTarget = { type: "product" | "rating" | "comment" | "creator"; id: string };

type ReportContentResult =
  | null
  | ({ kind: "product" } & {
      id: string;
      title: string;
      tagline: string | null;
      description: string | null;
      status: string;
      creator: { username: string } | null;
    })
  | ({ kind: "rating" } & {
      id: string;
      stars: number;
      title: string | null;
      body: string | null;
      product: { title: string } | null;
      user: { username: string } | null;
    })
  | ({ kind: "comment" } & {
      id: string;
      body: string;
      product: { title: string } | null;
      user: { username: string } | null;
    })
  | ({ kind: "creator" } & {
      user_id: string;
      tagline: string | null;
      long_bio: string | null;
      is_suspended: boolean;
      profile: { username: string; display_name: string } | null;
    });

function ReportsSection() {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<ReportTarget | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, target_type, target_id, reason, status, created_at, reporter:profiles!reports_reporter_id_fkey(username)")
        .in("status", ["open", "reviewing"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "dismissed" }) => {
      const { error } = await supabase.from("reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report updated");
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <>
      <TableShell>
        <thead className="border-b border-border bg-surface">
          <tr><Th>Target</Th><Th>Reporter</Th><Th>Reason</Th><Th>Content</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(data ?? []).map((r) => (
            <tr key={r.id}>
              <Td><span className="font-mono text-xs uppercase">{r.target_type}</span></Td>
              <Td>@{r.reporter?.username ?? "—"}</Td>
              <Td className="max-w-md truncate">{r.reason}</Td>
              <Td>
                <button
                  className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => setViewing({ type: r.target_type, id: r.target_id })}
                >
                  View content
                </button>
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => update.mutate({ id: r.id, status: "resolved" })}>Resolve</Button>
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: "dismissed" })}>Dismiss</Button>
                </div>
              </Td>
            </tr>
          ))}
          {(!data || data.length === 0) && <tr><Td className="text-muted-foreground"><span>No open reports.</span></Td></tr>}
        </tbody>
      </TableShell>
      <ReportContentDialog target={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function ReportContentDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "report-content", target?.type, target?.id],
    enabled: !!target,
    queryFn: async (): Promise<ReportContentResult> => {
      if (!target) return null;
      switch (target.type) {
        case "product": {
          const { data, error } = await supabase
            .from("products")
            .select(
              "id, title, tagline, description, status, creator:profiles!products_creator_id_fkey(username)",
            )
            .eq("id", target.id)
            .maybeSingle();
          if (error) throw error;
          return data && { kind: "product", ...data };
        }
        case "rating": {
          const { data, error } = await supabase
            .from("ratings")
            .select(
              "id, stars, title, body, created_at, product:products(title), user:profiles!ratings_user_id_fkey(username)",
            )
            .eq("id", target.id)
            .maybeSingle();
          if (error) throw error;
          return data && { kind: "rating", ...data };
        }
        case "comment": {
          const { data, error } = await supabase
            .from("comments")
            .select(
              "id, body, created_at, product:products(title), user:profiles!comments_user_id_fkey(username)",
            )
            .eq("id", target.id)
            .maybeSingle();
          if (error) throw error;
          return data && { kind: "comment", ...data };
        }
        case "creator": {
          const { data, error } = await supabase
            .from("creator_profiles")
            .select(
              "user_id, tagline, long_bio, is_suspended, profile:profiles!creator_profiles_user_id_fkey(username, display_name)",
            )
            .eq("user_id", target.id)
            .maybeSingle();
          if (error) throw error;
          return data && { kind: "creator", ...data };
        }
        default:
          return null;
      }
    },
  });

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Reported {target?.type}
          </DialogTitle>
          <DialogDescription>The underlying content that was reported.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">
            This content no longer exists — it may have already been removed.
          </p>
        ) : data.kind === "product" ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">{data.title}</p>
            <p className="text-muted-foreground">by @{data.creator?.username ?? "—"}</p>
            <p className="text-muted-foreground">{data.tagline}</p>
            <p>{data.description}</p>
            <p>
              <StatusPill value={data.status} />
            </p>
          </div>
        ) : data.kind === "rating" ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              @{data.user?.username ?? "—"} rated{" "}
              <span className="font-medium">{data.product?.title ?? "—"}</span> {data.stars}/5
            </p>
            {data.title && <p className="font-medium">{data.title}</p>}
            <p>{data.body}</p>
          </div>
        ) : data.kind === "comment" ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              @{data.user?.username ?? "—"} on <span className="font-medium">{data.product?.title ?? "—"}</span>
            </p>
            <p>{data.body}</p>
          </div>
        ) : data.kind === "creator" ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">@{data.profile?.username ?? "—"}</p>
            <p className="text-muted-foreground">{data.profile?.display_name}</p>
            <p>{data.tagline}</p>
            <p className="whitespace-pre-wrap">{data.long_bio}</p>
            <p>
              <StatusPill value={data.is_suspended ? "suspended" : "active"} />
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ============== CREATORS ============== */
const TIER_OPTIONS = ["free", "creator", "builder", "studio"] as const;

function CreatorsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "creators"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("creator_profiles")
        .select(
          "user_id, is_suspended, onboarded_at, creator_subscription_tier, trial_ends_at, profile:profiles!creator_profiles_user_id_fkey(username, display_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (profiles ?? []).map((p) => p.user_id);
      const [{ data: products }, { data: earnings }] = await Promise.all([
        supabase.from("products").select("creator_id").in("creator_id", ids),
        supabase.from("creator_earnings").select("creator_id, net_cents").in("creator_id", ids),
      ]);
      const counts = new Map<string, number>();
      (products ?? []).forEach((p) => counts.set(p.creator_id, (counts.get(p.creator_id) ?? 0) + 1));
      const totals = new Map<string, number>();
      (earnings ?? []).forEach((e) => totals.set(e.creator_id, (totals.get(e.creator_id) ?? 0) + e.net_cents));
      return (profiles ?? []).map((p) => ({
        ...p,
        product_count: counts.get(p.user_id) ?? 0,
        total_earnings_cents: totals.get(p.user_id) ?? 0,
      }));
    },
  });

  const suspend = useMutation({
    mutationFn: async ({ user_id, is_suspended }: { user_id: string; is_suspended: boolean }) => {
      const { error } = await supabase.from("creator_profiles").update({ is_suspended }).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "creators"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setTier = useMutation({
    mutationFn: async ({
      user_id,
      tier,
    }: {
      user_id: string;
      tier: (typeof TIER_OPTIONS)[number];
    }) => {
      const { error } = await supabase
        .from("creator_profiles")
        .update({ creator_subscription_tier: tier })
        .eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["admin", "creators"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (user_id: string) => {
      const { error: rErr } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", "creator");
      if (rErr) throw rErr;
      const { error } = await supabase.from("creator_profiles").delete().eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Creator removed");
      qc.invalidateQueries({ queryKey: ["admin", "creators"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <TableShell>
      <thead className="border-b border-border bg-surface">
        <tr><Th>Creator</Th><Th>Plan</Th><Th>Products</Th><Th>Total earnings</Th><Th>Status</Th><Th>Actions</Th></tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(data ?? []).map((c) => (
          <tr key={c.user_id}>
            <Td>@{c.profile?.username ?? "—"}</Td>
            <Td>
              <div className="flex items-center gap-2">
                <Select
                  value={c.creator_subscription_tier}
                  onValueChange={(v) =>
                    setTier.mutate({ user_id: c.user_id, tier: v as (typeof TIER_OPTIONS)[number] })
                  }
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t[0].toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {c.creator_subscription_tier === "free" && c.trial_ends_at && (
                  <span className="text-xs text-muted-foreground">
                    trial ends {new Date(c.trial_ends_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Td>
            <Td className="font-mono">{c.product_count}</Td>
            <Td className="font-mono text-accent">{formatPrice(c.total_earnings_cents, "USD", "one_time")}</Td>
            <Td>{c.is_suspended ? <StatusPill value="suspended" /> : <StatusPill value="active" />}</Td>
            <Td>
              <div className="flex gap-2">
                {c.is_suspended ? (
                  <Button size="sm" onClick={() => suspend.mutate({ user_id: c.user_id, is_suspended: false })}>Approve</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => suspend.mutate({ user_id: c.user_id, is_suspended: true })}>Suspend</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { if (confirm("Remove creator?")) remove.mutate(c.user_id); }}>Remove</Button>
              </div>
            </Td>
          </tr>
        ))}
        {(!data || data.length === 0) && <tr><Td className="text-muted-foreground"><span>No creators yet.</span></Td></tr>}
      </tbody>
    </TableShell>
  );
}

/* ============== PRODUCTS ============== */
type ProductStatusPatch = "draft" | "published" | "unlisted" | "removed" | "rejected";

function ProductsSection() {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, slug, status, rejection_reason, featured, price_cents, currency, pricing_model, creator:profiles!products_creator_id_fkey(username)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { featured?: boolean; status?: ProductStatusPatch; rejection_reason?: string | null };
    }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setRejecting(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitReject() {
    if (!rejecting) return;
    update.mutate({
      id: rejecting.id,
      patch: { status: "rejected", rejection_reason: reason.trim() || null },
    });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <>
      <TableShell>
        <thead className="border-b border-border bg-surface">
          <tr><Th>Creator</Th><Th>Product</Th><Th>Price</Th><Th>Status</Th><Th>Featured</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(data ?? []).map((p) => (
            <tr key={p.id}>
              <Td>@{p.creator?.username ?? "—"}</Td>
              <Td>{p.title}</Td>
              <Td className="font-mono text-accent">{formatPrice(p.price_cents, p.currency, p.pricing_model)}</Td>
              <Td>
                <StatusPill value={p.status} />
                {p.status === "rejected" && p.rejection_reason && (
                  <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">{p.rejection_reason}</p>
                )}
              </Td>
              <Td>{p.featured ? <span className="font-mono text-xs text-accent">★ FEATURED</span> : <span className="text-muted-foreground text-xs">—</span>}</Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={p.featured ? "outline" : "default"} onClick={() => update.mutate({ id: p.id, patch: { featured: !p.featured } })}>
                    {p.featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, patch: { status: "unlisted" } })}>Unlist</Button>
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, patch: { status: "removed" } })}>Remove</Button>
                  {p.status === "rejected" ? (
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, patch: { status: "draft", rejection_reason: null } })}>
                      Clear rejection
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => { setReason(""); setRejecting({ id: p.id, title: p.title }); }}>
                      Reject
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
          {(!data || data.length === 0) && <tr><Td className="text-muted-foreground"><span>No products.</span></Td></tr>}
        </tbody>
      </TableShell>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject "{rejecting?.title}"</DialogTitle>
            <DialogDescription>
              The creator will see this product marked as rejected, along with your note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason (optional)</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Screenshots don't match the live product"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={update.isPending} onClick={submitReject}>
              Reject product
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============== USERS ============== */
function UsersSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }));
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin", "products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, status")
        .order("title", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ user_id, role, grant }: { user_id: string; role: "user" | "creator" | "admin"; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase.from("user_roles").insert({ user_id, role });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Roles updated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grantEntitlement = useMutation({
    mutationFn: async ({ user_id, product_id }: { user_id: string; product_id: string }) => {
      const { error } = await supabase
        .from("entitlements")
        .upsert(
          { user_id, product_id, active: true, expires_at: null },
          { onConflict: "user_id,product_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => toast.success("Entitlement granted"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <TableShell>
      <thead className="border-b border-border bg-surface">
        <tr><Th>User</Th><Th>Roles</Th><Th>Toggle</Th><Th>Grant access</Th></tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(data ?? []).map((u) => (
          <tr key={u.id}>
            <Td>
              <div>{u.display_name ?? u.username}</div>
              <div className="text-xs text-muted-foreground">@{u.username}</div>
            </Td>
            <Td>
              <div className="flex gap-1">
                {u.roles.length === 0 ? <span className="text-muted-foreground text-xs">none</span> :
                  u.roles.map((r) => <StatusPill key={r} value={r} />)}
              </div>
            </Td>
            <Td>
              <div className="flex flex-wrap gap-2">
                {(["user", "creator", "admin"] as const).map((role) => {
                  const has = u.roles.includes(role);
                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant={has ? "outline" : "default"}
                      onClick={() => toggle.mutate({ user_id: u.id, role, grant: !has })}
                    >
                      {has ? `Revoke ${role}` : `Grant ${role}`}
                    </Button>
                  );
                })}
              </div>
            </Td>
            <Td>
              <GrantEntitlementCell
                products={products ?? []}
                onGrant={(product_id) => grantEntitlement.mutate({ user_id: u.id, product_id })}
              />
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function GrantEntitlementCell({
  products,
  onGrant,
}: {
  products: { id: string; title: string; status: string }[];
  onGrant: (productId: string) => void;
}) {
  const [productId, setProductId] = useState<string>("");
  return (
    <div className="flex items-center gap-2">
      <Select value={productId} onValueChange={setProductId}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Select product" />
        </SelectTrigger>
        <SelectContent>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.title} {p.status !== "published" && `(${p.status})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={!productId}
        onClick={() => {
          onGrant(productId);
          setProductId("");
        }}
      >
        Grant
      </Button>
    </div>
  );
}

/* ============== WEBHOOK FAILURES ============== */
function WebhookFailuresSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "webhook-failures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_failures")
        .select(
          "id, received_at, reason, resolved, raw_payload, product:products(title), creator:profiles!webhook_failures_creator_id_fkey(username)",
        )
        .order("received_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_failures").update({ resolved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked resolved");
      qc.invalidateQueries({ queryKey: ["admin", "webhook-failures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Stripe webhook payloads we couldn't process automatically - missing/malformed metadata,
        signature verification failure, or an unrecognized product. Review and grant access
        manually via Users → Grant access if a real purchase was missed.
      </p>
      <TableShell>
        <thead className="border-b border-border bg-surface">
          <tr><Th>Received</Th><Th>Reason</Th><Th>Creator</Th><Th>Product</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(data ?? []).map((f: any) => (
            <tr key={f.id}>
              <Td className="whitespace-nowrap font-mono text-xs">
                {new Date(f.received_at).toLocaleString()}
              </Td>
              <Td className="max-w-xs text-xs">{f.reason}</Td>
              <Td>{f.creator?.username ? `@${f.creator.username}` : "—"}</Td>
              <Td>{f.product?.title ?? "—"}</Td>
              <Td>{f.resolved ? <StatusPill value="resolved" /> : <StatusPill value="open" />}</Td>
              <Td>
                {!f.resolved && (
                  <Button size="sm" variant="outline" onClick={() => resolve.mutate(f.id)}>
                    Mark resolved
                  </Button>
                )}
              </Td>
            </tr>
          ))}
          {(!data || data.length === 0) && (
            <tr><Td className="text-muted-foreground"><span>No webhook failures logged.</span></Td></tr>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
