import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type ProfileSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setSession(s);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useProfile(userId: string | null | undefined) {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]).then(([p, r]) => {
      if (!active) return;
      setProfile((p.data as ProfileSummary | null) ?? null);
      setRoles((r.data ?? []).map((row) => row.role));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return { profile, roles, loading, isCreator: roles.includes("creator") };
}

export type AuthUser = User;
