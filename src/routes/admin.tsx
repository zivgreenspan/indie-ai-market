import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth", search: { mode: "signin" as const, redirect: "/admin" } });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
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
          </TabsList>
          <TabsContent value="payouts" className="mt-6"><PayoutsSection /></TabsContent>
          <TabsContent value="deployments" className="mt-6"><DeploymentsSection /></TabsContent>
          <TabsContent value="reports" className="mt-6"><ReportsSection /></TabsContent>
          <TabsContent value="creators" className="mt-6"><CreatorsSection /></TabsContent>
          <TabsContent value="products" className="mt-6"><ProductsSection /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersSection /></TabsContent>
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
        .select("id, title, github_repo_url, hosted_app_url, deployment_status, creator:profiles!products_creator_id_fkey(username)")
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
    <TableShell>
      <thead className="border-b border-border bg-surface">
        <tr><Th>Creator</Th><Th>Product</Th><Th>Repo</Th><Th>Status</Th><Th>Hosted URL → mark live</Th></tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(data ?? []).map((r) => (
          <DeploymentRow key={r.id} row={r} onLive={(url) => markLive.mutate({ id: r.id, url })} />
        ))}
        {(!data || data.length === 0) && <tr><Td className="text-muted-foreground"><span>No pending deployments.</span></Td></tr>}
      </tbody>
    </TableShell>
  );
}

function DeploymentRow({ row, onLive }: { row: any; onLive: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <tr>
      <Td>@{row.creator?.username ?? "—"}</Td>
      <Td>{row.title}</Td>
      <Td>{row.github_repo_url ? <a className="text-primary hover:underline" href={row.github_repo_url} target="_blank" rel="noreferrer">repo</a> : "—"}</Td>
      <Td><StatusPill value={row.deployment_status} /></Td>
      <Td>
        <div className="flex items-center gap-2">
          <Input placeholder="https://app.example.com" value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 w-64" />
          <Button size="sm" onClick={() => url && onLive(url)}>Mark live</Button>
        </div>
      </Td>
    </tr>
  );
}

/* ============== REPORTS ============== */
function ReportsSection() {
  const qc = useQueryClient();
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
    <TableShell>
      <thead className="border-b border-border bg-surface">
        <tr><Th>Target</Th><Th>Reporter</Th><Th>Reason</Th><Th>Target ID</Th><Th>Actions</Th></tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(data ?? []).map((r) => (
          <tr key={r.id}>
            <Td><span className="font-mono text-xs uppercase">{r.target_type}</span></Td>
            <Td>@{r.reporter?.username ?? "—"}</Td>
            <Td className="max-w-md truncate">{r.reason}</Td>
            <Td className="font-mono text-xs text-muted-foreground">{r.target_id}</Td>
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
  );
}

/* ============== CREATORS ============== */
function CreatorsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "creators"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("creator_profiles")
        .select("user_id, is_suspended, onboarded_at, profile:profiles!creator_profiles_user_id_fkey(username, display_name)")
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
        <tr><Th>Creator</Th><Th>Products</Th><Th>Total earnings</Th><Th>Status</Th><Th>Actions</Th></tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(data ?? []).map((c) => (
          <tr key={c.user_id}>
            <Td>@{c.profile?.username ?? "—"}</Td>
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
function ProductsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, slug, status, featured, price_cents, currency, pricing_model, creator:profiles!products_creator_id_fkey(username)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
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
            <Td><StatusPill value={p.status} /></Td>
            <Td>{p.featured ? <span className="font-mono text-xs text-accent">★ FEATURED</span> : <span className="text-muted-foreground text-xs">—</span>}</Td>
            <Td>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={p.featured ? "outline" : "default"} onClick={() => update.mutate({ id: p.id, patch: { featured: !p.featured } })}>
                  {p.featured ? "Unfeature" : "Feature"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, patch: { status: "unlisted" } })}>Unlist</Button>
                <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, patch: { status: "removed" } })}>Remove</Button>
              </div>
            </Td>
          </tr>
        ))}
        {(!data || data.length === 0) && <tr><Td className="text-muted-foreground"><span>No products.</span></Td></tr>}
      </tbody>
    </TableShell>
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
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <TableShell>
      <thead className="border-b border-border bg-surface">
        <tr><Th>User</Th><Th>Roles</Th><Th>Toggle</Th></tr>
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
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
