import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { becomeCreator } from "@/lib/become-creator.functions";

type PayoutMethod = "paypal" | "bank" | "later";
type PlatformType = "instagram" | "youtube" | "tiktok" | "x" | "custom";

const PLATFORM_OPTIONS: { value: PlatformType; label: string; placeholder: string }[] = [
  { value: "instagram", label: "Instagram", placeholder: "@yourhandle or full profile URL" },
  { value: "youtube", label: "YouTube", placeholder: "Channel URL" },
  { value: "tiktok", label: "TikTok", placeholder: "@yourhandle or full profile URL" },
  { value: "x", label: "X (Twitter)", placeholder: "@yourhandle or full profile URL" },
  { value: "custom", label: "Website / other link", placeholder: "https://yoursite.com" },
];

export const Route = createFileRoute("/_authenticated/become-creator")({
  head: () => ({ meta: [{ title: "Become a creator · River" }] }),
  component: BecomeCreatorPage,
});

function BecomeCreatorPage() {
  const navigate = useNavigate();
  const submit = useServerFn(becomeCreator);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tagline: "",
    long_bio: "",
    platform_link: "",
    x_handle: "",
    github_handle: "",
  });
  const [platformType, setPlatformType] = useState<PlatformType>("instagram");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("later");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({
        data: {
          ...form,
          platform_type: platformType,
          payout_method: payoutMethod === "later" ? null : payoutMethod,
          payout_email: payoutMethod === "paypal" ? payoutEmail : null,
          payout_details: payoutMethod === "bank" ? payoutDetails : null,
          stripe_webhook_secret: stripeWebhookSecret || null,
        },
      });
      toast.success("You're a creator", {
        description: "Next: ship your first product.",
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete signup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3 text-primary" /> Creator onboarding
        </span>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">
          Set up your creator profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          This is the page customers see when they consider buying from you. Make it count.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-6"
        >
          <Field
            label="One-liner"
            description="What do you build? 140 characters or fewer."
            required
          >
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="I ship small, sharp AI tools for designers."
              maxLength={140}
              required
            />
          </Field>

          <Field label="About" description="Tell people what you're about. Optional.">
            <Textarea
              value={form.long_bio}
              onChange={(e) => setForm({ ...form, long_bio: e.target.value })}
              rows={5}
              maxLength={2000}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Main platform" description="Where do people find you?">
              <Select
                value={platformType}
                onValueChange={(v) => setPlatformType(v as PlatformType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={PLATFORM_OPTIONS.find((p) => p.value === platformType)?.label ?? "Link"}>
              <Input
                value={form.platform_link}
                onChange={(e) => setForm({ ...form, platform_link: e.target.value })}
                placeholder={PLATFORM_OPTIONS.find((p) => p.value === platformType)?.placeholder}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="X / Twitter handle">
              <Input
                value={form.x_handle}
                onChange={(e) => setForm({ ...form, x_handle: e.target.value })}
                placeholder="@you"
              />
            </Field>
            <Field label="GitHub handle">
              <Input
                value={form.github_handle}
                onChange={(e) => setForm({ ...form, github_handle: e.target.value })}
                placeholder="@you"
              />
            </Field>
          </div>

          <div className="space-y-2 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              River pays creators monthly. We handle all transactions and transfer your earnings
              directly to you, minus our 10% platform fee. We support multiple payout methods
              globally.
            </p>
          </div>

          <div className="space-y-6 rounded-xl border border-border bg-surface/40 p-5">
            <div>
              <h2 className="font-display text-lg font-semibold">How would you like to be paid?</h2>
            </div>

            <Field label="Payout method" description="You can change this anytime.">
              <Select
                value={payoutMethod}
                onValueChange={(v) => setPayoutMethod(v as PayoutMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paypal">Digital Wallet (e.g. PayPal)</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="later">Set up later</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {payoutMethod === "paypal" && (
              <Field label="Your payment email address">
                <Input
                  type="email"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
            )}

            {payoutMethod === "bank" && (
              <Field label="Your bank details (we'll follow up to confirm)">
                <Textarea
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  rows={4}
                  maxLength={2000}
                />
              </Field>
            )}

            <p className="text-xs text-muted-foreground">
              You can update your payout preferences anytime from your settings.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="font-display text-lg font-semibold">
              Stripe webhook (for paid products)
            </h2>
            <p className="text-xs text-muted-foreground">
              If you sell paid products with a Stripe Payment Link, add River's webhook URL in your
              Stripe dashboard (shown when you create a paid product) and paste the signing secret
              Stripe gives you here. This lets River verify purchases are really yours and grant
              buyers access automatically.
            </p>
            <Field
              label="Stripe webhook signing secret"
              description="Starts with whsec_. Optional until you sell a paid product."
            >
              <Input
                type="password"
                value={stripeWebhookSecret}
                onChange={(e) => setStripeWebhookSecret(e.target.value)}
                placeholder="whsec_..."
                autoComplete="off"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  description,
  required,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm">
          {label} {required && <span className="text-primary">*</span>}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
