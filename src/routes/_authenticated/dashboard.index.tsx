import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  CreditCard,
  Package,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { formatPrice } from "@/lib/format";
import { getPaddleConfig } from "@/lib/billing.functions";

type Tier = "free" | "creator" | "builder" | "studio";
type PaidTier = "creator" | "builder" | "studio";

const TIER_LIMITS: Record<Tier, number> = { free: 1, creator: 3, builder: 8, studio: Infinity };
const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  creator: "Creator",
  builder: "Builder",
  studio: "Studio",
};
const TIER_ORDER: Record<Tier, number> = { free: 0, creator: 1, builder: 2, studio: 3 };
const PADDLE_PLANS: { value: PaidTier; price: number; blurb: string }[] = [
  { value: "creator", price: 9, blurb: "Up to 3 products" },
  { value: "builder", price: 19, blurb: "Up to 8 products" },
  { value: "studio", price: 29, blurb: "Unlimited products" },
];
const TRAFFIC_LIMIT = 150;

// Only the free tier is traffic-capped today, but keyed by tier (rather
// than a bare boolean) so a future capped paid tier would just need an
// entry here - the per-product progress bar below already reads from
// this map instead of hardcoding "free".
const TIER_TRAFFIC_LIMITS: Partial<Record<Tier, number>> = { free: TRAFFIC_LIMIT };

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// Stable empty-array fallback so useMemo dependents below don't see a new
// array identity on every render while data is still loading.
const EMPTY_ARRAY: never[] = [];

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Initialize: (options: { token: string }) => void;
      Checkout: { open: (options: Record<string, unknown>) => void };
    };
  }
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM", matches Postgres to_char(now(), 'YYYY-MM')
}

export const Route = createFileRoute("/_authenticated/dashboard/")({
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
      const [creator, products, follows, payout, earnings, trafficHistory] = await Promise.all([
        supabase.from("creator_profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase
          .from("products")
          .select(
            "id, title, status, price_cents, currency, pricing_model, slug, monthly_visit_count, visit_count_month",
          )
          .eq("creator_id", uid),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("creator_id", uid),
        supabase
          .from("creator_payout_details")
          .select("payout_method")
          .eq("user_id", uid)
          .maybeSingle(),
        // Reversed earnings shouldn't count toward revenue anywhere below.
        supabase
          .from("creator_earnings")
          .select("product_id, net_cents, status, created_at")
          .eq("creator_id", uid)
          .neq("status", "reversed"),
        // RLS restricts this to rows whose product belongs to this creator -
        // no product_id filter needed (product ids aren't known yet at this
        // point anyway, since the products query above resolves in parallel).
        supabase.from("product_traffic_history").select("product_id, month, visit_count"),
      ]);
      return {
        creator: creator.data,
        products: products.data ?? [],
        followers: follows.count ?? 0,
        payoutMethod: payout.data?.payout_method ?? null,
        earnings: earnings.data ?? [],
        trafficHistory: trafficHistory.data ?? [],
      };
    },
  });

  const payoutsReady = !!overview?.payoutMethod;
  const products = overview?.products ?? EMPTY_ARRAY;
  const published = products.filter((p) => p.status === "published").length;
  const tier = (overview?.creator?.creator_subscription_tier ?? "free") as Tier;
  const isFree = tier === "free";
  const limit = TIER_LIMITS[tier];
  const trialEndsAt = overview?.creator?.trial_ends_at ?? null;
  const trialExpired = isFree && !!trialEndsAt && new Date(trialEndsAt) < new Date();

  const month = currentMonthKey();
  const cappedProducts = isFree
    ? products.filter(
        (p) => p.visit_count_month === month && p.monthly_visit_count >= TRAFFIC_LIMIT,
      )
    : [];

  const trafficLimit = TIER_TRAFFIC_LIMITS[tier];
  const earnings = overview?.earnings ?? EMPTY_ARRAY;
  const trafficHistory = overview?.trafficHistory ?? EMPTY_ARRAY;

  const lifetimeRevenueCents = useMemo(
    () => earnings.reduce((sum, e) => sum + e.net_cents, 0),
    [earnings],
  );

  // Account-wide revenue by month, for the top chart.
  const revenueChartData = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const e of earnings) {
      const m = e.created_at.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + e.net_cents);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, cents]) => ({ month: m, revenue: Math.round((cents / 100) * 100) / 100 }));
  }, [earnings]);

  // Lifetime revenue per product, for the per-product breakdown below.
  const revenueByProduct = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const e of earnings) {
      byProduct.set(e.product_id, (byProduct.get(e.product_id) ?? 0) + e.net_cents);
    }
    return byProduct;
  }, [earnings]);

  // Traffic history only ever has *closed-out* months (see
  // recordProductVisit) - the current, still-open month lives on the
  // product row itself, so it's merged in here to avoid the chart always
  // looking one month behind reality.
  const trafficChartData = useMemo(() => {
    const byMonth = new Map<string, Map<string, number>>();
    for (const row of trafficHistory) {
      const m = byMonth.get(row.month) ?? new Map<string, number>();
      m.set(row.product_id, row.visit_count);
      byMonth.set(row.month, m);
    }
    for (const p of products) {
      if (p.visit_count_month !== month) continue;
      const m = byMonth.get(month) ?? new Map<string, number>();
      m.set(p.id, p.monthly_visit_count);
      byMonth.set(month, m);
    }
    return [...byMonth.keys()].sort().map((m) => {
      const row: Record<string, string | number> = { month: m };
      const counts = byMonth.get(m)!;
      for (const p of products) {
        row[p.id] = counts.get(p.id) ?? 0;
      }
      return row;
    });
  }, [trafficHistory, products, month]);

  const revenueChartConfig = {
    revenue: { label: "Revenue", color: CHART_COLORS[0] },
  } as ChartConfig;

  const trafficChartConfig = useMemo(
    () =>
      Object.fromEntries(
        products.map((p, i) => [
          p.id,
          { label: p.title, color: CHART_COLORS[i % CHART_COLORS.length] },
        ]),
      ) as ChartConfig,
    [products],
  );

  const getConfig = useServerFn(getPaddleConfig);
  const { data: paddleConfig } = useQuery({
    enabled: !!user,
    queryKey: ["paddle-config"],
    queryFn: () => getConfig(),
    staleTime: Infinity,
  });

  const paddleReady = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || window.Paddle) return;
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  function openCheckout(targetTier: PaidTier) {
    if (!user) return;
    if (!paddleConfig?.clientToken) {
      toast.error("Billing isn't configured yet - check back soon.");
      return;
    }
    const priceId = paddleConfig.prices[targetTier];
    if (!priceId) {
      toast.error("This plan isn't available yet.");
      return;
    }
    const Paddle = window.Paddle;
    if (!Paddle) {
      toast.error("Checkout is still loading - try again in a moment.");
      return;
    }
    if (!paddleReady.current) {
      Paddle.Environment.set(paddleConfig.environment);
      Paddle.Initialize({ token: paddleConfig.clientToken });
      paddleReady.current = true;
    }
    Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(user.email ? { customer: { email: user.email } } : {}),
      customData: { user_id: user.id },
    });
  }

  function handleUpgradeInterest() {
    document.getElementById("billing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

      {!payoutsReady && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="font-medium">Add a payout method to start selling</p>
              <p className="text-sm text-muted-foreground">
                Payouts go directly to your bank or digital wallet. River takes a 10% platform fee.
                Nothing else.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="font-mono text-xs uppercase">
            <Link to="/become-creator">Set up payouts</Link>
          </Button>
        </div>
      )}

      {!isLoading && trialExpired && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-500">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="font-medium">Your free trial has ended</p>
              <p className="text-sm text-muted-foreground">
                Upgrade to keep publishing new products. Your existing product stays live.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="font-mono text-xs uppercase"
            onClick={handleUpgradeInterest}
          >
            Upgrade plan
          </Button>
        </div>
      )}

      {!isLoading &&
        cappedProducts.map((p) => (
          <div
            key={p.id}
            className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/15 p-2 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="font-medium">
                  "{p.title}" has reached the free tier traffic limit ({TRAFFIC_LIMIT}/month)
                </p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to keep it accessible to new visitors until the month resets.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="font-mono text-xs uppercase"
              onClick={handleUpgradeInterest}
            >
              Upgrade plan
            </Button>
          </div>
        ))}

      {!isLoading && !trialExpired && cappedProducts.length === 0 && tier !== "studio" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/15 p-2 text-accent">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-medium">
                {TIER_LABELS[tier]} plan · {products.length}/{limit === Infinity ? "∞" : limit}{" "}
                product
                {limit === 1 ? "" : "s"} used
              </p>
              <p className="text-sm text-muted-foreground">
                Upgrade for more products and features.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="font-mono text-xs uppercase"
            onClick={handleUpgradeInterest}
          >
            Upgrade plan
          </Button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat
          label="Plan"
          value={isLoading ? null : TIER_LABELS[tier]}
          sub={
            limit === Infinity ? "Unlimited products" : `${products.length}/${limit} products used`
          }
          icon={<Sparkles className="size-4" />}
        />
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
          sub="Tracked once a creator's Stripe Payment Link sells"
          icon={<ArrowUpRight className="size-4" />}
        />
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Your products</h2>
          <Link
            to="/dashboard/products"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
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
                    <span className="text-accent">
                      {formatPrice(p.price_cents, p.currency, p.pricing_model)}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How your products are performing over time.
        </p>

        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lifetime revenue
          </p>
          <p className="mt-1 font-display text-3xl font-semibold">
            {isLoading ? <Skeleton className="h-9 w-32" /> : formatCents(lifetimeRevenueCents)}
          </p>
          <div className="mt-5">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl bg-surface" />
            ) : revenueChartData.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                No revenue recorded yet.
              </div>
            ) : (
              <ChartContainer config={revenueChartConfig} className="h-64 w-full">
                <BarChart data={revenueChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent formatter={(value) => [`$${value}`, "Revenue"]} />
                    }
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Traffic over time
          </p>
          <div className="mt-5">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl bg-surface" />
            ) : trafficChartData.length === 0 || products.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                No traffic recorded yet.
              </div>
            ) : (
              <ChartContainer config={trafficChartConfig} className="h-64 w-full">
                <LineChart data={trafficChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {products.map((p) => (
                    <Line
                      key={p.id}
                      dataKey={p.id}
                      name={p.title}
                      type="monotone"
                      stroke={`var(--color-${p.id})`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <p className="font-medium">Per-product breakdown</p>
          </div>
          {isLoading ? (
            <div className="p-4">
              <Skeleton className="h-24 w-full rounded-xl bg-surface" />
            </div>
          ) : products.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nothing to show until you have a product.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {products.map((p) => {
                const revenue = revenueByProduct.get(p.id) ?? 0;
                const traffic = p.visit_count_month === month ? p.monthly_visit_count : 0;
                const usagePct = trafficLimit
                  ? Math.min(100, (traffic / trafficLimit) * 100)
                  : null;
                const nearLimit = trafficLimit ? traffic >= trafficLimit * 0.8 : false;
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono uppercase tracking-wide">{p.status}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Revenue
                        </p>
                        <p className="font-mono text-sm font-medium">{formatCents(revenue)}</p>
                      </div>
                      <div className="w-40 text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Traffic (this month)
                        </p>
                        {trafficLimit ? (
                          <>
                            <p
                              className={`font-mono text-sm font-medium ${
                                nearLimit ? "text-destructive" : ""
                              }`}
                            >
                              {traffic}/{trafficLimit} monthly visits used
                            </p>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                              <div
                                className={`h-full rounded-full ${
                                  nearLimit ? "bg-destructive" : "bg-primary"
                                }`}
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="font-mono text-sm font-medium">{traffic} visits</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section id="billing" className="mt-10 scroll-mt-24">
        <h2 className="font-display text-xl font-semibold">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You're on the {TIER_LABELS[tier]} plan
          {isFree && trialEndsAt && !trialExpired
            ? ` · trial ends ${new Date(trialEndsAt).toLocaleDateString()}`
            : ""}
          . Upgrading or switching plans opens Paddle's secure checkout.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PADDLE_PLANS.map((plan) => {
            const isCurrent = tier === plan.value;
            const isUpgrade = TIER_ORDER[tier] < TIER_ORDER[plan.value];
            return (
              <div
                key={plan.value}
                className={`rounded-2xl border p-5 ${
                  isCurrent ? "border-accent bg-accent/5" : "border-border bg-card"
                }`}
              >
                <p className="font-display text-lg font-semibold">{TIER_LABELS[plan.value]}</p>
                <p className="mt-1 font-mono text-2xl">
                  ${plan.price}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{plan.blurb}</p>
                <Button
                  className="mt-4 w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent}
                  onClick={() => openCheckout(plan.value)}
                >
                  {isCurrent ? "Current plan" : isUpgrade ? "Upgrade" : "Switch plan"}
                </Button>
              </div>
            );
          })}
        </div>
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
