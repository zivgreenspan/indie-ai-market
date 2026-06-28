import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, Plus, Search, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { profile, isCreator } = useProfile(user?.id);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <Link
          to="/"
          className="font-display text-2xl font-medium lowercase text-foreground"
          style={{ letterSpacing: "-0.04em" }}
        >
          river
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-1.5 text-sm text-foreground bg-surface" }}
            activeOptions={{ exact: true }}
          >
            Discover
          </Link>
          <Link
            to="/explore"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-1.5 text-sm text-foreground bg-surface" }}
          >
            Explore
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Search">
            <Search className="size-4" />
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-surface-2 font-mono text-xs">
                    {(profile?.display_name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden text-sm sm:inline">{profile?.display_name ?? "Account"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                  Signed in as @{profile?.username ?? "—"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/library">Your library</Link>
                </DropdownMenuItem>
                {profile && (
                  <DropdownMenuItem asChild>
                    <Link to="/c/$username" params={{ username: profile.username }}>
                      <UserIcon className="mr-2 size-4" /> Your profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {isCreator ? (
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">Creator dashboard</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/become-creator">
                      <Plus className="mr-2 size-4" /> Become a creator
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut} className="text-muted-foreground">
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="font-medium">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
