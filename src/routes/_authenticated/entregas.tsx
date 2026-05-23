import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState } from "react";
import {
  listDeliveries,
  createDelivery,
  decideDelivery,
  fixMissingDeliveryMemberIds,
} from "@/lib/deliveries.functions";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { listManagers } from "@/lib/members.functions";
import type { CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtDate, fmtNum , fmtPrice, fmtCategoryLabel} from "@/lib/domain";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  itemDisplayCategory,
} from "@/lib/armory.catalog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Check,
  X,
  PackageOpen,
  Package,
  Coins,
  Wrench,
} from "lucide-react";
import { ItemIcon } from "@/components/domain/ItemIcon";
import type { LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/layout/FadeIn";
import { SearchableSelect } from "@/components/ui/searchable-select";

export const Route = createFileRoute("/_authenticated/entregas")({
  component: Page,
});

// Estados por tipo: a label muda consoante seja entrega vs venda
function statusMeta(
  tipo: string,
  status: string,
): { label: string; color: string } {
  const isVenda = tipo === "venda";
  if (status === "pending")
    return {
      label: isVenda ? "Pendente" : "à espera",
      color: "bg-muted text-muted-foreground border-border",
    };
  if (status === "approved")
    return {
      label: isVenda ? "Pago" : "Entregue",
      color: "bg-success/15 text-success border-success/30",
    };
  if (status === "rejected")
    return {
      label: isVenda ? "Recusada" : "Recusada",
      color: "bg-destructive/15 text-destructive border-destructive/30",
    };
  return {
    label: status,
    color: "bg-muted text-muted-foreground border-border",
  };
}

const TIPO_META: Record<
  string,
  { label: string; Icon: LucideIcon; tone: string }
> = {
  entrega: {
    label: "Entrega de stock",
    Icon: Package,
    tone: "bg-info/15 text-info border-info/30",
  },
  venda: {
    label: "Aquisição interna",
    Icon: Coins,
    tone: "bg-warning/15 text-warning border-warning/30",
  },
};

function Page() {
  useRealtimeSync(["deliveries"]);
  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState("mine");
  return (
    <>
      <PageHeader
        eyebrow="Entregas"
        title="Entregas"
        description="Registo de entregas"
        action={<NewDelivery />}
      />
      <FadeIn>
        <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine" className="interactive-tab">As minhas</TabsTrigger>
          {isManager && <TabsTrigger value="manage" className="interactive-tab">Para conferir</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine" className="mt-4">
          <DelList scope="mine" canDecide={false} />
        </TabsContent>
        {isManager && (
          <TabsContent value="manage" className="mt-4">
            <FixDeliveriesButton />
            <DelList scope="manage" canDecide />
          </TabsContent>
        )}
      </Tabs>
      </FadeIn>
    </>
  );
}

function DelList({
  scope,
  canDecide,
}: {
  scope: "mine" | "manage";
  canDecide: boolean;
}) {
  const fn = useAuthedServerFn(listDeliveries);
  const decFn = useAuthedServerFn(decideDelivery);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["deliveries", scope],
    queryFn: () => fn({ data: { scope } }),
  });
  const m = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decFn({ data: v }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["deliveries"] });
      const prev = qc.getQueryData(["deliveries", scope]);
      qc.setQueryData(["deliveries", scope], (old: any) =>
        old?.map((d: any) =>
          d.id === vars.id ? { ...d, status: vars.approve ? "approved" : "rejected" } : d
        )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["deliveries", scope], ctx.prev);
      toast.error(_e.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["my-xp"] });
      qc.invalidateQueries({ queryKey: ["home-kpis"] });
      toast.success("Guardado");
    },
  });

  if (list.isLoading)
    return <p className="text-muted-foreground">A carregar entregas</p>;
  if (!list.data?.length)
    return (
      <Card className="p-10 text-center">
        <PackageOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-display text-sm text-muted-foreground">
          {scope === "mine"
            ? "Nenhum registo"
            : "Nenhuma pendente"}
        </p>
      </Card>
    );

  return (
    <div className="grid gap-3">
      {list.data.map((d) => {
        const tipoMeta = TIPO_META[d.tipo] ?? TIPO_META.entrega;
        const st = statusMeta(d.tipo, d.status);
        return (
          <Card key={d.id} className={`p-4 border-l-4 ${d.tipo === "venda" ? "border-l-warning" : "border-l-info"}`}>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider " +
                      tipoMeta.tone
                    }
                  >
                    <tipoMeta.Icon className="h-3.5 w-3.5" /> {tipoMeta.label}
                  </span>
                  <span className="font-semibold">
                    {d.requester_name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(d.created_at)}
                  </span>
                  <span
                    className={
                      "ml-auto rounded-sm border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider " +
                      st.color
                    }
                  >
                    {st.label}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-border/50 text-sm">
                  {d.lines.map((l, i) => (
                    <li key={i} className="flex justify-between py-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">
                          {l.qty}×
                        </span>
                        <ItemIcon name={l.item_name ?? ""} size={14} />
                        {l.item_name ?? `#${l.item_id}`}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {l.unit_value != null
                          ? fmtPrice(l.unit_value * l.qty)
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-end justify-between border-t border-border pt-2">
                  {d.notes ? (
                    <span className="text-xs italic text-muted-foreground">
                      "{d.notes}"
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="inline-flex items-center gap-1.5 font-mono text-base font-semibold">
                    {d.tipo === "venda" ? <Coins className="h-4 w-4 text-warning" /> : <Package className="h-4 w-4 text-info" />}
                    {fmtPrice(d.total_value)}
                  </span>
                </div>
              </div>
              {canDecide && d.status === "pending" && (
                <div className="flex flex-col gap-1.5">
                  <ButtonLoading
                    size="sm"
                    loading={m.isPending}
                    onClick={() => m.mutate({ id: d.id, approve: true })}
                    disabled={m.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    {d.tipo === "venda" ? "Comprar" : "Receber"}
                  </ButtonLoading>
                  <ButtonLoading
                    size="sm"
                    variant="outline"
                    loading={m.isPending}
                    onClick={() => m.mutate({ id: d.id, approve: false })}
                    disabled={m.isPending}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Recusar
                  </ButtonLoading>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function NewDelivery() {
  const [open, setOpen] = useState(false);
  const catFn = useAuthedServerFn(getCatalog);
  const createFn = useAuthedServerFn(createDelivery);
  const qc = useQueryClient();
  const cat = useQuery({
    queryKey: ["catalog"],
    queryFn: () => catFn(),
    enabled: open,
  });
  const items = (cat.data ?? []).filter(
    (i: CatalogItem) => i.side === "compra",
  );
  const [lines, setLines] = useState<{ item_id: string; qty: string }[]>([
    { item_id: "", qty: "1" },
  ]);
  const [notes, setNotes] = useState("");
  const [tipo, setTipo] = useState<"entrega" | "venda">("entrega");
  const [responsavel, setResponsavel] = useState("");
  const managersFn = useAuthedServerFn(listManagers);
  const managers = useQuery({
    queryKey: ["managers"],
    queryFn: () => managersFn(),
    enabled: open,
  });
  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          lines: lines
            .filter((l) => l.item_id && l.qty)
            .map((l) => ({ item_id: Number(l.item_id), qty: Number(l.qty) })),
          notes: notes || null,
          tipo,
          responsavel_member_id: responsavel ? Number(responsavel) : null,
        },
      }),
    onSuccess: () => {
      toast.success(
        tipo === "venda"
          ? "Aquisição registada com sucesso."
          : "Entrega submetida. Aguarda confirmação.",
      );
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      setOpen(false);
      setLines([{ item_id: "", qty: "1" }]);
      setNotes("");
      setTipo("entrega");
      setResponsavel("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Nova entrega
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipo === "venda" ? <Coins className="h-5 w-5 text-warning" /> : <Package className="h-5 w-5 text-info" />}
            {tipo === "venda" ? "Registar nova aquisição" : "Registar nova entrega"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Responsável
            </label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger>
                <SelectValue placeholder="Seleciona quem gere isto" />
              </SelectTrigger>
              <SelectContent>
                {(managers.data ?? []).map((mgr) => (
                  <SelectItem key={mgr.id} value={String(mgr.id)}>
                    {mgr.display_name ?? mgr.nick ?? `Membro #${mgr.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo("entrega")}
                className={
                  "rounded-sm cursor-pointer border px-3 py-2 text-left text-sm transition-colors " +
                  (tipo === "entrega"
                    ? "border-info bg-info/15 text-info"
                    : "border-border bg-card interactive-row")
                }
              >
                <div className="inline-flex items-center gap-1.5 text-display text-[11px] uppercase tracking-wider">
                  <Package className="h-3 w-3" /> Entregar
                </div>
                <div className="text-xs text-muted-foreground">
                  Integra no inventário
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTipo("venda")}
                className={
                  "rounded-sm cursor-pointer border px-3 py-2 text-left text-sm transition-colors " +
                  (tipo === "venda"
                    ? "border-warning bg-warning/15 text-warning"
                    : "border-border bg-card interactive-row")
                }
              >
                <div className="inline-flex items-center gap-1.5 text-display text-[11px] uppercase tracking-wider">
                  <Coins className="h-3 w-3" /> Vender
                </div>
                <div className="text-xs text-muted-foreground">
                  Compensação ao colaborador
                </div>
              </button>
            </div>
          </div>
          {lines.map((l, idx) => {
            const groups = new Map<string, typeof items>();
            for (const i of items) {
              const cat = itemDisplayCategory(i.name, i.category, i.subcategory);
              if (!groups.has(cat)) groups.set(cat, []);
              groups.get(cat)!.push(i);
            }
            const deliveryOptions: { value: string; label: string; group: string; groupColor?: string }[] = [];
            for (const cat of ARMORY_CAT_ORDER) {
              const list = groups.get(cat);
              if (!list) continue;
              const cfg = ARMORY_CAT_CONFIG[cat];
              deliveryOptions.push(
                ...list.map((i) => ({
                  value: String(i.id),
                  label: `${i.name} · ${cfg?.label ?? fmtCategoryLabel(cat)}`,
                  group: cfg?.label ?? fmtCategoryLabel(cat),
                  groupColor: cfg?.headerColor,
                })),
              );
            }
            return (
              <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
                <SearchableSelect
                  value={l.item_id}
                  onChange={(v) =>
                    setLines(
                      lines.map((x, i) => (i === idx ? { ...x, item_id: v } : x)),
                    )
                  }
                  options={deliveryOptions}
                  placeholder="Item"
                  searchPlaceholder="Procurar item..."
                  emptyText="Nenhum item encontrado."
                />
                <Input
                  type="number"
                  min={1}
                  value={l.qty}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, i) =>
                        i === idx ? { ...x, qty: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLines([...lines, { item_id: "", qty: "1" }])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Mais uma linha
          </Button>
          <div>
            <label className="text-xs text-muted-foreground">
              Notas (opcional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <ButtonLoading loading={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "A processar" : "Submeter"}
          </ButtonLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FixDeliveriesButton() {
  const fixFn = useAuthedServerFn(fixMissingDeliveryMemberIds);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => fixFn(),
    onSuccess: (res) => {
      toast.success(`Corrigidas ${res.rows_fixed} entregas antigas`);
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["member"] });
      qc.invalidateQueries({ queryKey: ["my-xp"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mb-4">
      <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
        <Wrench className="mr-1 h-3.5 w-3.5" />
        {m.isPending ? "A corrigir..." : "Corrigir entregas antigas"}
      </Button>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Corrige entregas aprovadas antes da atualização que não tinham membro associado.
      </p>
    </div>
  );
}
