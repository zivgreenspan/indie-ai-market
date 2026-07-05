import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
      const [creator, products, follows, payout] = await Promise.all([
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
      ]);
      return {
        creator: creator.data,
        products: products.data ?? [],
        followers: follows.count ?? 0,
        payoutMethod: payout.data?.payout_method ?? null,
      };
    },
  });

  const payoutsReady = !!overview?.payoutMethod;
  const products = overview?.products ?? [];
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
