import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getStock, getLedger, type StockRow as StockRowType } from "@/lib/inventory.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { fmtNum, fmtDate, fmtPrice } from "@/lib/domain";
import { Package, History, Loader2 } from "lucide-react";
import { AccessDenied } from "@/components/domain/AccessDenied";
import { EMPTY_STATE, LOADING } from "@/lib/messages";
import { ItemIcon } from "@/components/domain/ItemIcon";
import { CategoryHeader } from "@/components/domain/CategoryHeader";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  filterItemForDisplay,
} from "@/lib/armory.catalog";
import { getInventoryExcludedItems } from "@/lib/config.loader";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [{ title: "Inventário | Ballas Gang" }],
  }),
  component: Page,
});

function classifyRow(r: { category: string | null; subcategory: string | null; item_name: string }): string | null {
  const name = r.item_name.toLowerCase();
  // Excluir acessórios do stock
  if (r.category === "acessorios" || r.subcategory === "acessorios" || r.category === "acessorios_armas") return null;
  const excludedItems = getInventoryExcludedItems();
  if (excludedItems.some((h) => name.includes(h.toLowerCase()))) return null;
  return filterItemForDisplay(r.item_name, r.category, r.subcategory);
}

const MOV_LABEL: Record<string, string> = {
  saldo_inicial: "Saldo inicial",
  entrega_bairrista: "Entrega",
  venda_bairrista: "Venda",
  entrega_oficial: "Entrega oficial",
  fornecimento_org: "Fornecimento",
  consumo_saida: "Saída",
  devolucao_saida: "Devolução",
  ajuste_manual: "Ajuste",
  perda_saida: "Perdido",
  apreendido: "Apreendido",
  fabricado: "Fabricado",
};

function Page() {
  useRealtimeSync([{ table: "inventory", queryKeys: [["stock"], ["ledger"]] }]);
  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  if (me.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{LOADING.inventory}</p>
      </div>
    );
  }
  if (!me.data?.can_see_inventory) {
    return <AccessDenied />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Armazém"
        title="Inventário"
        description="Stock da firma"
        icon={Package}
      />

      <Reveal direction="up" delay={100}>
        <Tabs defaultValue="stock">
          <TabsList>
            <TabsTrigger value="stock" className="interactive-tab">
              <Package className="mr-1.5 h-3.5 w-3.5" /> Stock
            </TabsTrigger>
            <TabsTrigger value="ledger" className="interactive-tab">
              <History className="mr-1.5 h-3.5 w-3.5" /> Movimentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="mt-4">
            <StockTable />
          </TabsContent>
          <TabsContent value="ledger" className="mt-4">
            <LedgerTable />
          </TabsContent>
        </Tabs>
      </Reveal>
    </>
  );
}

function StockTable() {
  const fn = useAuthedServerFn(getStock);
  const q = useQuery({ queryKey: ["stock"], queryFn: () => fn() });
  const rows = q.data ?? [];

  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = classifyRow(r);
    if (!k) return acc;
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  const ordered: [string, typeof rows][] = [];
  for (const cat of ARMORY_CAT_ORDER) {
    const list = groups[cat];
    if (list && list.length > 0) ordered.push([cat, list]);
  }

  const total = ordered.reduce((s, [, arr]) => s + arr.length, 0);

  if (q.isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{LOADING.inventory}</p>
      </div>
    );
  if (!total)
    return (
      <Reveal direction="up" delay={100}>
        <div className="col-span-full text-center py-12">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">{EMPTY_STATE.inventory.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{EMPTY_STATE.inventory.description}</p>
        </div>
      </Reveal>
    );

  return (
    <Stagger direction="up" staggerDelay={80} baseDelay={100} className="space-y-6">
      {ordered.map(([cat, items]) => {
        const cfg = ARMORY_CAT_CONFIG[cat as keyof typeof ARMORY_CAT_CONFIG];
        const meta = cfg ?? { label: cat, tone: "muted", order: 99, icon: Package, color: "", bg: "", border: "", headerColor: "" };
        const totalQty = items.reduce((s, r) => s + (r.qty ?? 0), 0);
        const value = items.reduce((s, r) => s + (r.qty ?? 0) * (r.unit_price ?? 0), 0);
        return (
          <section key={cat} className="overflow-hidden rounded-sm border border-border bg-card">
            <div className="border-b">
              <CategoryHeader
                category={cat}
                className="rounded-none border-x-0 border-t-0"
                right={`${items.length} refs · ${fmtNum(totalQty)} em casa · ${fmtPrice(Math.round(value))}`}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Material</th>
                    <th className="px-3 py-2 text-right">Em casa</th>
                    <th className="px-3 py-2 text-right">Preço unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .slice()
                    .sort((a, b) => (a.unit_price ?? 0) - (b.unit_price ?? 0))
                    .map((r) => (
                      <StockRow key={r.item_id} r={r} cat={cat} />
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </Stagger>
  );
}

function StockRow({ r, cat }: { r: StockRowType; cat: string }) {
  const low = r.qty <= 0;
  const warn = r.qty > 0 && r.qty < 5;

  return (
    <tr className="border-t border-border interactive-row">
      <td className="px-3 py-2 font-medium">
        <span className="inline-flex items-center gap-2">
          <ItemIcon name={r.item_name} category={r.subcategory ?? cat} size={14} />
          {r.item_name}
        </span>
      </td>
      <td className={"px-3 py-2 text-right font-mono " + (low ? "text-destructive" : warn ? "text-warning" : "")}>
        {fmtNum(r.qty)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
        {r.unit_price != null ? fmtPrice(r.unit_price) : "—"}
      </td>
    </tr>
  );
}

function LedgerTable() {
  const fn = useAuthedServerFn(getLedger);
  const q = useQuery({
    queryKey: ["ledger"],
    queryFn: () => fn({ data: { limit: 50 } }),
  });
  const rows = q.data ?? [];

  if (q.isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{LOADING.inventory}</p>
      </div>
    );
  if (!rows.length)
    return (
      <Reveal direction="up" delay={100}>
        <div className="col-span-full text-center py-12">
          <History className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">{EMPTY_STATE.inventoryLedger.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{EMPTY_STATE.inventoryLedger.description}</p>
        </div>
      </Reveal>
    );

  return (
    <Reveal direction="up" delay={100}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Material</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              <th className="px-3 py-2 text-left">Membro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border interactive-row">
                <td className="px-3 py-2 text-muted-foreground">
                  {fmtDate(r.created_at).split(",")[0]}
                </td>
                <td className="px-3 py-2">
                  {MOV_LABEL[r.type] ?? r.type}
                </td>
                <td className="px-3 py-2 font-medium">
                  {r.item_name ?? "—"}
                </td>
                <td className={"px-3 py-2 text-right font-mono " + (r.qty > 0 ? "text-success" : r.qty < 0 ? "text-destructive" : "")}>
                  {r.qty > 0 ? "+" : ""}
                  {fmtNum(r.qty)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.member_name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}
