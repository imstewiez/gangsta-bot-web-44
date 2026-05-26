import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getStock, getLedger, adjustStock, type StockRow as StockRowType } from "@/lib/inventory.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { updateItemPrice } from "@/lib/recipes.admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { fmtNum, fmtDate, fmtPrice } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { Package, History, Pencil, Check, X, Loader2 } from "lucide-react";
import { AccessDenied } from "@/components/domain/AccessDenied";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";
import { CategoryHeader } from "@/components/domain/CategoryHeader";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  filterItemForDisplay,
} from "@/lib/armory.catalog";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [{ title: "Inventário | Ballas Gang" }],
  }),
  component: Page,
});



// Materiais que NÃO usamos nos crafts — esconder do stock
const EXCLUDED_ITEMS = [
  "nylon",
  "embalagem",
  "borracha",
  "tecido",
  "papel",
  "kevlar",
  "couro",
  "cana de pesca",
  "carreto",
  "saco",
  "lixo eletrónico",
  "lixo eletronico",
  "plástico velho",
  "plastico velho",
  "telemóvel estragado",
  "telemovel estragado",
  "rádio estragado",
  "radio estragado",
];

function classifyRow(r: { category: string | null; subcategory: string | null; item_name: string }): string | null {
  const name = r.item_name.toLowerCase();

  // Esconder materiais que não usamos
  if (EXCLUDED_ITEMS.some((h) => name.includes(h))) return null;

  // Forçar cobre, peças estragadas e sucata para materiais craft
  if (/\bcobre\b/.test(name)) return "materiais_craft";
  if (/peças estragadas|pecas estragadas/.test(name)) return "materiais_craft";
  if (/\bsucata\b/.test(name)) return "materiais_craft";

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
  craftado: "Craftado",
};

function Page() {
  const qc = useQueryClient();
  useRealtimeSync([{ table: "inventory", queryKeys: [["stock"], ["ledger"]] }]);
  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const [editMode, setEditMode] = useState(false);
  const isManager = me.data?.is_manager ?? false;

  const adjustFn = useAuthedServerFn(adjustStock);
  const updatePriceFn = useAuthedServerFn(updateItemPrice);

  const adjustMutation = useMutation({
    mutationFn: (v: { item_id: number; new_qty: number }) => adjustFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });

  const priceMutation = useMutation({
    mutationFn: (v: { item_id: number; purchase_price?: number }) => updatePriceFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });

  if (me.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

      {isManager && (
        <Reveal direction="up" delay={50}>
          <div className="mb-4 flex justify-end">
            <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {editMode ? "Concluir" : "Editar stock/preços"}
            </Button>
          </div>
        </Reveal>
      )}

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
            <StockTable
              editMode={editMode && isManager}
              onAdjustStock={(id, qty) => adjustMutation.mutate({ item_id: id, new_qty: qty })}
              onUpdatePrice={(id, price) => priceMutation.mutate({ item_id: id, purchase_price: price })}
              pending={adjustMutation.isPending || priceMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="ledger" className="mt-4">
            <LedgerTable />
          </TabsContent>
        </Tabs>
      </Reveal>
    </>
  );
}

function StockTable({
  editMode,
  onAdjustStock,
  onUpdatePrice,
  pending,
}: {
  editMode: boolean;
  onAdjustStock: (item_id: number, new_qty: number) => void;
  onUpdatePrice: (item_id: number, price: number) => void;
  pending: boolean;
}) {
  const fn = useAuthedServerFn(getStock);
  const q = useQuery({ queryKey: ["stock"], queryFn: () => fn() });
  const rows = q.data ?? [];

  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = classifyRow(r);
    if (!k) return acc;
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  // Build ordered list following ARMORY_CAT_ORDER
  const ordered: [string, typeof rows][] = [];
  for (const cat of ARMORY_CAT_ORDER) {
    const list = groups[cat];
    if (list && list.length > 0) ordered.push([cat, list]);
  }

  const total = ordered.reduce((s, [, arr]) => s + arr.length, 0);

  if (q.isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!total)
    return (
      <Reveal direction="up" delay={100}>
        <Card className="interactive-card p-8 text-center text-muted-foreground">
          Armazém vazio. Mete-te a trabalhar.
        </Card>
      </Reveal>
    );

  return (
    <Stagger direction="up" staggerDelay={80} baseDelay={100} className="space-y-6">
      {ordered.map(([cat, items]) => {
        const cfg = ARMORY_CAT_CONFIG[cat as keyof typeof ARMORY_CAT_CONFIG];
        const meta = cfg ?? { label: cat, tone: "muted", order: 99, icon: Package, color: "", bg: "", border: "", headerColor: "" };
        const totalQty = items.reduce((s, r) => s + (r.qty ?? 0), 0);
        const value = items.reduce(
          (s, r) => s + (r.qty ?? 0) * (r.unit_price ?? 0),
          0,
        );
        return (
          <section
            key={cat}
            className="overflow-hidden rounded-sm border border-border bg-card"
          >
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
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Em casa</th>
                    <th className="px-3 py-2 text-right">Preço unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .slice()
                    .sort((a, b) => (a.unit_price ?? 0) - (b.unit_price ?? 0))
                    .map((r) => (
                      <StockRow
                        key={r.item_id}
                        r={r}
                        cat={cat}
                        editMode={editMode}
                        onAdjustStock={onAdjustStock}
                        onUpdatePrice={onUpdatePrice}
                        pending={pending}
                      />
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

function StockRow({
  r,
  cat,
  editMode,
  onAdjustStock,
  onUpdatePrice,
  pending,
}: {
  r: StockRowType;
  cat: string;
  editMode: boolean;
  onAdjustStock: (item_id: number, new_qty: number) => void;
  onUpdatePrice: (item_id: number, price: number) => void;
  pending: boolean;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [qtyVal, setQtyVal] = useState(String(r.qty));
  const [priceVal, setPriceVal] = useState(String(r.unit_price ?? 0));
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
        {editMode ? (
          editingQty ? (
            <div className="flex items-center justify-end gap-1">
              <Input type="number" min={0} className="h-5 w-16 text-right text-xs px-1" value={qtyVal} onChange={(e) => setQtyVal(e.target.value)} autoFocus />
              <button className="text-emerald-400" disabled={pending} onClick={() => { onAdjustStock(r.item_id, Number(qtyVal)); setEditingQty(false); }}><Check className="h-3 w-3" /></button>
              <button className="text-muted-foreground" onClick={() => { setQtyVal(String(r.qty)); setEditingQty(false); }}><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button className="flex items-center gap-1 justify-end w-full" onClick={() => { setQtyVal(String(r.qty)); setEditingQty(true); }}>
              {fmtNum(r.qty)} <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )
        ) : (
          fmtNum(r.qty)
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
        {editMode ? (
          editingPrice ? (
            <div className="flex items-center justify-end gap-1">
              <Input type="number" min={0} className="h-5 w-20 text-right text-xs px-1" value={priceVal} onChange={(e) => setPriceVal(e.target.value)} autoFocus />
              <button className="text-emerald-400" disabled={pending} onClick={() => { onUpdatePrice(r.item_id, Number(priceVal)); setEditingPrice(false); }}><Check className="h-3 w-3" /></button>
              <button className="text-muted-foreground" onClick={() => { setPriceVal(String(r.unit_price ?? 0)); setEditingPrice(false); }}><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button className="flex items-center gap-1 justify-end w-full" onClick={() => { setPriceVal(String(r.unit_price ?? 0)); setEditingPrice(true); }}>
              {r.unit_price != null ? fmtPrice(r.unit_price) : "—"} <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )
        ) : (
          r.unit_price != null ? fmtPrice(r.unit_price) : "—"
        )}
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!rows.length)
    return (
      <Reveal direction="up" delay={100}>
        <Card className="interactive-card p-8 text-center text-muted-foreground">
          Sem movimentos registados.
        </Card>
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
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-right">Qtd</th>
            <th className="px-3 py-2 text-left">Membro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-border interactive-row"
            >
              <td className="px-3 py-2 text-muted-foreground">
                {fmtDate(r.created_at).split(",")[0]}
              </td>
              <td className="px-3 py-2">
                {MOV_LABEL[r.type] ?? r.type}
              </td>
              <td className="px-3 py-2 font-medium">
                {r.item_name ?? "—"}
              </td>
              <td
                className={
                  "px-3 py-2 text-right font-mono " +
                  (r.qty > 0 ? "text-success" : r.qty < 0 ? "text-destructive" : "")
                }
              >
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
