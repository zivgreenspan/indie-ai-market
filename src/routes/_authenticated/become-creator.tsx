import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { becomeCreator } from "@/lib/become-creator.functions";

export const Route = createFileRoute("/_authenticated/become-creator")({
  head: () => ({ meta: [{ title: "Become a creator · Stak" }] }),
  component: BecomeCreatorPage,
});

function BecomeCreatorPage() {
  const navigate = useNavigate();
  const submit = useServerFn(becomeCreator);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tagline: "",
    long_bio: "",
    website: "",
    x_handle: "",
    github_handle: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({ data: form });
      toast.success("You're a creator", {
        description: "Next: connect Stripe and ship your first product.",
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

        <form onSubmit={handleSubmit} className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-6">
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
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://yoursite.com"
                type="url"
              />
            </Field>
            <Field label="X / Twitter handle">
              <Input
                value={form.x_handle}
                onChange={(e) => setForm({ ...form, x_handle: e.target.value })}
                placeholder="@you"
              />
            </Field>
          </div>
          <Field label="GitHub handle">
            <Input
              value={form.github_handle}
              onChange={(e) => setForm({ ...form, github_handle: e.target.value })}
              placeholder="@you"
            />
          </Field>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              You'll connect Stripe to receive payouts in the next step.
            </p>
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
