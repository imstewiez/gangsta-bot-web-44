import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "./authed-server-fn";
import { getAuthProfile } from "./auth-profile.functions";

type Profile = {
  user_id: string;
  display_name: string | null;
  discord_id: string | null;
  avatar_url: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const profileFn = useAuthedServerFn(getAuthProfile);

  const {
    data: authData,
    refetch,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: ["auth-profile", session?.user?.id],
    queryFn: () => profileFn(),
    enabled: !!session?.user?.id,
    staleTime: 60_000,
  });

  const loadProfile = useCallback(async () => {
    if (session?.user?.id) {
      await refetch();
    }
  }, [session?.user?.id, refetch]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (!s) setLoading(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    user: session?.user ?? null,
    session,
    profile: authData?.profile ?? null,
    roles: authData?.roles ?? [],
    loading: loading || profileLoading,
    isAdmin: authData?.roles?.includes("admin") ?? false,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: loadProfile,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
