import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · River" }] }),
  component: SettingsPage,
});

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

function SettingsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    avatar_url: "",
  });

  const { data: profile, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["settings-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, username, bio, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        username: profile.username ?? "",
        bio: profile.bio ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
    }
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const username = form.username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(username)) {
      toast.error(
        "Username must be 3-30 characters: lowercase letters, numbers, underscores only.",
      );
      return;
    }
    if (!form.display_name.trim()) {
      toast.error("Display name can't be empty.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim(),
          username,
          bio: form.bio.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["settings-profile", user.id] });
      toast.success("Profile updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save changes";
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
        toast.error("That username is already taken.");
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <main className="container-page py-10">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-64 rounded-2xl bg-surface" />
        </div>
      </main>
    );
  }

  return (
    <main className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update how you appear across River.</p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6"
        >
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              required
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="Your name"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="yourhandle"
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and underscores only. This is your River URL: /c/
              {form.username || "yourhandle"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Avatar URL</Label>
            <Input
              type="url"
              value={form.avatar_url}
              onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              rows={4}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              maxLength={500}
              placeholder="A little about you."
            />
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
