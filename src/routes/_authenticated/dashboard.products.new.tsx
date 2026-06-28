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
    github_repo_url: "",
    status: "draft" as "draft" | "published",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const priceCents = Math.round(parseFloat(form.price || "0") * 100);
      const slug = slugify(form.title);
      if (!slug) throw new Error("Title must contain letters or numbers");

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
        github_repo_url: form.github_repo_url || null,
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

          <div className="space-y-2">
            <Label>GitHub repository (optional)</Label>
            <Input
              type="url"
              value={form.github_repo_url}
              onChange={(e) => setForm({ ...form, github_repo_url: e.target.value })}
              placeholder="https://github.com/you/repo"
            />
            <p className="text-xs text-muted-foreground">
              We'll auto-deploy your repo in a future release. For now this is just for show.
            </p>
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
