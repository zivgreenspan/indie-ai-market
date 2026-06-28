import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { CATEGORIES, type CategoryValue } from "@/lib/categories";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/products/new")({
  head: () => ({ meta: [{ title: "New product · River" }] }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    tagline: "",
    description: "",
    cover_image_url: "",
    category: "productivity" as CategoryValue,
    price: "9",
    pricing_model: "one_time" as "one_time" | "subscription",
    hosting_method: "url" as "url" | "github",
    hosted_app_url: "",
    github_repo_url: "",
    status: "draft" as "draft" | "published",
  });

  const githubRegex = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (form.hosting_method === "github" && !githubRegex.test(form.github_repo_url.trim())) {
      toast.error("Enter a valid public GitHub repo URL (https://github.com/user/repo)");
      return;
    }
    if (form.hosting_method === "url" && !form.hosted_app_url.trim()) {
      toast.error("Enter your hosted app URL");
      return;
    }


    setBusy(true);
    try {
      const priceCents = Math.round(parseFloat(form.price || "0") * 100);
      const slug = slugify(form.title);
      if (!slug) throw new Error("Title must contain letters or numbers");

      const isGithub = form.hosting_method === "github";
      const { error } = await supabase.from("products").insert({
        creator_id: user.id,
        slug,
        title: form.title,
        tagline: form.tagline || null,
        description: form.description || null,
        cover_image_url: form.cover_image_url || null,
        category: form.category,
        price_cents: priceCents,
        currency: "usd",
        pricing_model: form.pricing_model,
        hosted_app_url: isGithub ? null : form.hosted_app_url.trim(),
        github_repo_url: isGithub ? form.github_repo_url.trim() : null,
        deployment_status: isGithub ? "pending" : "none",
        status: form.status,
        published_at: form.status === "published" ? new Date().toISOString() : null,
      });

      if (error) throw error;
      toast.success("Product created");
      navigate({ to: "/dashboard/products" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drafts stay private. Publish when you're ready for the world.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="My amazing app"
            />
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="One sentence to sell it."
              maxLength={160}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={6}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does it do? Who is it for? Markdown supported."
            />
          </div>
          <div className="space-y-2">
            <Label>Cover image URL</Label>
            <Input
              type="url"
              value={form.cover_image_url}
              onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as CategoryValue })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pricing model</Label>
              <Select
                value={form.pricing_model}
                onValueChange={(v) => setForm({ ...form, pricing_model: v as "one_time" | "subscription" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="subscription" disabled>
                    Subscription (coming soon)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Price (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as "draft" | "published" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-4">
            <Label>How is your app hosted?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, hosting_method: "url" })}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  form.hosting_method === "url"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">I have a hosted URL</div>
                <div className="text-xs text-muted-foreground">Already deployed somewhere.</div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, hosting_method: "github" })}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  form.hosting_method === "github"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">Upload via GitHub repo</div>
                <div className="text-xs text-muted-foreground">We'll deploy it for you.</div>
              </button>
            </div>

            {form.hosting_method === "url" ? (
              <div className="space-y-2 pt-2">
                <Label>Hosted app URL</Label>
                <Input
                  type="url"
                  required
                  value={form.hosted_app_url}
                  onChange={(e) => setForm({ ...form, hosted_app_url: e.target.value })}
                  placeholder="https://yourapp.com"
                />
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <Label>GitHub repository URL</Label>
                <Input
                  type="url"
                  required
                  value={form.github_repo_url}
                  onChange={(e) => setForm({ ...form, github_repo_url: e.target.value })}
                  placeholder="https://github.com/username/repo"
                />
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Currently supports Next.js projects only.</li>
                  <li>• Repo must be public for now.</li>
                  <li>• Deployment will be queued and handled by our team.</li>
                </ul>
              </div>
            )}
          </div>


          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/dashboard/products" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save product
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
