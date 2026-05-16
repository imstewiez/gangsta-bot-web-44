import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
  import type { Session, User } from "@supabase/supabase-js";
  import { supabase } from "@/integrations/supabase/client";

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
    const [profile, setProfile] = useState<Profile | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const loadProfile = async (uid: string) => {
      console.log("[auth] loadProfile start, uid:", uid);
      try {
        const [{ data: p, error: pErr }, { data: r, error: rErr }] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id,display_name,discord_id,avatar_url")
            .eq("user_id", uid)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        if (pErr) console.error("[auth] profiles error:", pErr);
        if (rErr) console.error("[auth] user_roles error:", rErr);
        console.log("[auth] profiles result:", p);
        console.log("[auth] roles result:", r);
        setProfile(p ?? null);
        setRoles((r ?? []).map((x: { role: string }) => x.role));
      } catch (e) {
        console.error("[auth] loadProfile exception:", e);
        setProfile(null);
        setRoles([]);
      }
    };

    useEffect(() => {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_evt, s) => {
        console.log("[auth] onAuthStateChange, event:", _evt, "hasSession:", !!s);
        setSession(s);
        if (s?.user) {
          // defer to avoid deadlock
          setTimeout(() => loadProfile(s.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
      });
      supabase.auth.getSession().then(({ data, error }) => {
        console.log("[auth] getSession result:", { hasSession: !!data.session, error });
        setSession(data.session);
        if (data.session?.user)
          loadProfile(data.session.user.id).finally(() => setLoading(false));
        else setLoading(false);
      });
      return () => subscription.unsubscribe();
    }, []);

    const value: AuthCtx = {
      user: session?.user ?? null,
      session,
      profile,
      roles,
      loading,
      isAdmin: roles.includes("admin"),
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
    };

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  export function useAuth() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
  }
