import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getCurrentMember } from "@/lib/pricing.functions";
import { updateMyProfile } from "@/lib/members.functions";
import { getMemberXP } from "@/lib/xp.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fmtNum, TIER_LABELS } from "@/lib/domain";
import { TierIcon } from "@/components/domain/TierIcon";
import { toast } from "sonner";
import { User, Save, Zap } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";
import { useState } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/_authenticated/perfil")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "O meu perfil | Ballas Gang" }],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  useRealtimeSync([
    "members",
    { table: "all_time_stats", queryKeys: [["me"], ["my-xp"]] },
  ]);
  const meFn = useAuthedServerFn(getCurrentMember);
  const xpFn = useAuthedServerFn(getMemberXP);
  const updateFn = useAuthedServerFn(updateMyProfile);
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const xp = useQuery({ queryKey: ["my-xp"], queryFn: () => xpFn({ data: { member_id: me.data!.id } }), enabled: !!me.data });

  const [name, setName] = useState(me.data?.display_name ?? "");

  const m = useMutation({
    mutationFn: () => updateFn({ data: { display_name: name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="O meu perfil"
        description="Gerir o teu perfil e progresso"
        icon={User}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal direction="up" delay={0}>
          <Card className="interactive-card">
            <CardHeader>
              <CardTitle className="text-display text-sm">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                  maxLength={80}
                />
              </div>

              <ButtonLoading
                loading={m.isPending}
                onClick={() => m.mutate()}
                disabled={!name.trim()}
              >
                <Save className="mr-1.5 h-4 w-4" />
                Guardar
              </ButtonLoading>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal direction="up" delay={100}>
          <Card className="interactive-card">
            <CardHeader>
              <CardTitle className="text-display text-sm">Progresso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <TierIcon tier={me.data?.tier ?? null} size="lg" />
                <div>
                  <div className="font-semibold">{TIER_LABELS[me.data?.tier ?? ""] ?? me.data?.tier ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {me.data?.role_label ?? "—"}
                  </div>
                </div>
              </div>

              {xp.data && !xp.data.maxedOut && (
                <div className="space-y-1.5 rounded-sm bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">XP total</span>
                    <span className="text-sm font-bold">{fmtNum(xp.data.totalPoints)}</span>
                  </div>
                  <Progress value={xp.data.progress} className="h-2" />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{xp.data.currentTierName}</span>
                    <span>{xp.data.progress.toFixed(1)}% — faltam {fmtNum(xp.data.remaining)} XP</span>
                    <span>{xp.data.nextTierName}</span>
                  </div>
                </div>
              )}

              {xp.data?.maxedOut && (
                <div className="flex items-center gap-2 rounded-sm bg-primary/10 p-3 text-primary">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-semibold">Tier máximo atingido!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </>
  );
}
