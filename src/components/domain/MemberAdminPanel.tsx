import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminRenameMember,
  adminSetTier,
  adminKickMember,
  adminAdjustStats,
  TIER_LIST,
} from "@/lib/member-admin.functions";
import { TIER_LABELS } from "@/lib/domain";
import { Pencil, Crown, UserMinus, Activity } from "lucide-react";

type Member = {
  id: number;
  display_name: string | null;
  nick: string | null;
  tier: string | null;
};

export function MemberAdminPanel({
  member,
  myTier,
  canManage,
}: {
  member: Member;
  myTier: string | null;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();

  const renameFn = useServerFn(adminRenameMember);
  const tierFn = useServerFn(adminSetTier);
  const kickFn = useServerFn(adminKickMember);
  const adjustFn = useServerFn(adminAdjustStats);

  const [name, setName] = useState(member.display_name ?? "");
  const [nick, setNick] = useState(member.nick ?? "");
  const [tier, setTier] = useState<string>(member.tier ?? "young_blood");
  const [killsStr, setKillsStr] = useState("0");
  const [deathsStr, setDeathsStr] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function run<T>(label: string, fn: () => Promise<T>, ok: string) {
    setBusy(label);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["member", String(member.id)] });
      await qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-display text-sm flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" /> Painel de Chefia
          {!canManage && (
            <span className="ml-auto text-[10px] text-muted-foreground">Só leitura — mesmo cargo ou superior</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Renomear */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" /> Renomear (sincroniza com Discord)
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Alcunha</Label>
              <Input value={nick} onChange={(e) => setNick(e.target.value)} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={busy !== null || !name.trim()}
            onClick={() =>
              run(
                "rename",
                () =>
                  renameFn({
                    data: {
                      id: member.id,
                      display_name: name.trim(),
                      nickname: nick.trim() || null,
                    },
                  }),
                "Nome atualizado",
              )
            }
          >
            Guardar nome
          </Button>
        </section>

        {/* Promover/Despromover */}
        <section className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <Crown className="h-3.5 w-3.5" /> Promover / Despromover
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="h-9 rounded-sm border border-border bg-input px-2 text-sm"
              disabled={!canManage}
            >
              {TIER_LIST.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canManage || busy !== null || tier === member.tier}
              onClick={() =>
                run(
                  "tier",
                  () =>
                    tierFn({
                      data: {
                        id: member.id,
                        tier: tier,
                      },
                    }),
                  "Tier atualizado e enviado ao bot",
                )
              }
            >
              Aplicar
            </Button>
          </div>
          {!canManage && (
            <p className="text-[11px] text-muted-foreground">
              Não podes alterar o tier de alguém do mesmo cargo ou superior ao teu.
            </p>
          )}
        </section>

        {/* Ajustar stats */}
        <section className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Ajustar stats (enganos /
            testes)
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <Label className="text-xs">Kills (+/-)</Label>
              <Input
                type="number"
                value={killsStr}
                onChange={(e) => setKillsStr(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Mortes (+/-)</Label>
              <Input
                type="number"
                value={deathsStr}
                onChange={(e) => setDeathsStr(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Input
                placeholder="ex: corrigir bug"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={
              busy !== null ||
              (Number(killsStr) === 0 && Number(deathsStr) === 0)
            }
            onClick={() =>
              run(
                "adjust",
                () =>
                  adjustFn({
                    data: {
                      id: member.id,
                      kills_delta: killsStr || undefined,
                      deaths_delta: deathsStr || undefined,
                      reason: reason || undefined,
                    },
                  }),
                "Stats ajustadas",
              )
            }
          >
            Aplicar ajuste
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Para encomendas / entregas / vendas / saídas, ajusta nas próprias
            páginas — aqui só PvP.
          </p>
        </section>

        {/* Kick */}
        <section className="space-y-2 border-t border-destructive/30 pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-destructive">
            <UserMinus className="h-3.5 w-3.5" /> Expulsar do bairro
          </div>
          <p className="text-xs text-muted-foreground">
            Marca o membro como saído e dá kick no Discord automaticamente via
            bot.
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={!canManage || busy !== null}
            onClick={() => {
              if (!confirm(`Confirmar expulsão de ${member.display_name}?`))
                return;
              run(
                "kick",
                () =>
                  kickFn({
                    data: { id: member.id, reason: reason || undefined },
                  }),
                "Membro expulso",
              ).then(() => nav({ to: "/membros" }));
            }}
          >
            Expulsar
          </Button>
          {!canManage && (
            <p className="text-[11px] text-muted-foreground">
              Não podes expulsar alguém do mesmo cargo ou superior ao teu.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
