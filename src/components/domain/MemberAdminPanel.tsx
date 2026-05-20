import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
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

type Stats = {
  kills: number;
  deaths: number;
  saidas: number;
  deliveries: number;
  vendas: number;
  orders: number;
};

export function MemberAdminPanel({
  member,
  stats,
  myTier,
  canManage,
}: {
  member: Member;
  stats: Stats;
  myTier: string | null;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();

  const renameFn = useAuthedServerFn(adminRenameMember);
  const tierFn = useAuthedServerFn(adminSetTier);
  const kickFn = useAuthedServerFn(adminKickMember);
  const adjustFn = useAuthedServerFn(adminAdjustStats);

  const [name, setName] = useState(member.display_name ?? "");
  const [nick, setNick] = useState(member.nick ?? "");
  const [tier, setTier] = useState<string>(member.tier ?? "young_blood");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Delta inputs (all start at "0")
  const [killsDelta, setKillsDelta] = useState("0");
  const [deathsDelta, setDeathsDelta] = useState("0");
  const [saidasDelta, setSaidasDelta] = useState("0");
  const [deliveriesDelta, setDeliveriesDelta] = useState("0");
  const [vendasDelta, setVendasDelta] = useState("0");
  const [ordersDelta, setOrdersDelta] = useState("0");

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

  const hasAnyDelta =
    Number(killsDelta) !== 0 ||
    Number(deathsDelta) !== 0 ||
    Number(saidasDelta) !== 0 ||
    Number(deliveriesDelta) !== 0 ||
    Number(vendasDelta) !== 0 ||
    Number(ordersDelta) !== 0;

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

        {/* Ajustar estatísticas */}
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Ajustar stats
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Kills */}
            <div className="space-y-1">
              <Label className="text-xs">Kills (atual: {stats.kills})</Label>
              <Input
                type="number"
                value={killsDelta}
                onChange={(e) => setKillsDelta(e.target.value)}
                placeholder="+/-"
              />
            </div>
            {/* Deaths */}
            <div className="space-y-1">
              <Label className="text-xs">Mortes (atual: {stats.deaths})</Label>
              <Input
                type="number"
                value={deathsDelta}
                onChange={(e) => setDeathsDelta(e.target.value)}
                placeholder="+/-"
              />
            </div>
            {/* Saídas */}
            <div className="space-y-1">
              <Label className="text-xs">Saídas (atual: {stats.saidas})</Label>
              <Input
                type="number"
                value={saidasDelta}
                onChange={(e) => setSaidasDelta(e.target.value)}
                placeholder="+/-"
              />
            </div>
            {/* Entregas */}
            <div className="space-y-1">
              <Label className="text-xs">Entregas (atual: {stats.deliveries})</Label>
              <Input
                type="number"
                value={deliveriesDelta}
                onChange={(e) => setDeliveriesDelta(e.target.value)}
                placeholder="+/-"
              />
            </div>
            {/* Vendas */}
            <div className="space-y-1">
              <Label className="text-xs">Vendas (atual: {stats.vendas})</Label>
              <Input
                type="number"
                value={vendasDelta}
                onChange={(e) => setVendasDelta(e.target.value)}
                placeholder="+/-"
              />
            </div>
            {/* Encomendas */}
            <div className="space-y-1">
              <Label className="text-xs">Encomendas (atual: {stats.orders})</Label>
              <Input
                type="number"
                value={ordersDelta}
                onChange={(e) => setOrdersDelta(e.target.value)}
                placeholder="+/-"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo</Label>
            <Input
              placeholder="ex: corrigir bug"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null || !hasAnyDelta}
            onClick={() =>
              run(
                "adjust",
                () =>
                  adjustFn({
                    data: {
                      id: member.id,
                      kills_delta: Number(killsDelta) || undefined,
                      deaths_delta: Number(deathsDelta) || undefined,
                      saidas_delta: Number(saidasDelta) || undefined,
                      deliveries_delta: Number(deliveriesDelta) || undefined,
                      sales_delta: Number(vendasDelta) || undefined,
                      orders_delta: Number(ordersDelta) || undefined,
                      reason: reason || undefined,
                    },
                  }),
                "Estatísticas ajustadas",
              )
            }
          >
            Aplicar ajuste
          </Button>
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
