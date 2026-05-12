import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { listAppUsers, setUserRole } from "@/lib/admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Shield, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if (isServer()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const listFn = useServerFn(listAppUsers);
  const setFn = useServerFn(setUserRole);
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["appUsers"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (v: {
      user_id: string;
      role: "admin" | "member";
      grant: boolean;
    }) => setFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appUsers"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader
        eyebrow="Chefia"
        title="Admin"
        description="Gerir acessos da app."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-display text-sm">
            Utilizadores da app
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading && (
            <p className="text-muted-foreground text-sm">A carregar…</p>
          )}
          {users.error && (
            <p className="text-destructive text-sm">
              {(users.error as Error).message}
            </p>
          )}
          <div className="space-y-2">
            {(users.data ?? []).map((u) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <div
                  key={u.user_id}
                  className="flex items-center gap-3 rounded-sm border border-border p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {u.display_name ?? "(sem nome)"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {u.discord_id ?? u.user_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      desde {fmtDate(u.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className={
                          "rounded-sm px-2 py-1 text-display " +
                          (r === "admin"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted")
                        }
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant={isAdmin ? "outline" : "default"}
                    disabled={m.isPending}
                    onClick={() =>
                      m.mutate({
                        user_id: u.user_id,
                        role: "admin",
                        grant: !isAdmin,
                      })
                    }
                  >
                    {isAdmin ? (
                      <>
                        <ShieldOff className="mr-1 h-3 w-3" />
                        Remover admin
                      </>
                    ) : (
                      <>
                        <Shield className="mr-1 h-3 w-3" />
                        Tornar admin
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
            {!users.isLoading && !users.data?.length && (
              <p className="text-sm text-muted-foreground">Sem utilizadores.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
