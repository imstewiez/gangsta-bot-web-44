import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStock, getLedger } from "@/lib/inventory.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { fmtNum, fmtMoney, fmtDate, formatMovementType, prettyItemName } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair, Package, History } from "lucide-react";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/inventario")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: Page,
});

type CatMeta = { label: string; tone: string; order: number; group: "venda" | "compra" };

// Espelha exatamente as subcategorias do preçário.
const GROUPS: Record<string, CatMeta> = {
  // O que a firma vende
  armas_red:        { label: "Armas Red",          tone: "destructive", order: 1,  group: "venda" },
  armas_orange:     { label: "Armas Orange",       tone: "warning",     order: 2,  group: "venda" },
  carregadores:     { label: "Carregadores",       tone: "primary",     order: 3,  group: "venda" },
  acessorios:       { label: "Acessórios",         tone: "info",        order: 4,  group: "venda" },
  coletes:          { label: "Coletes",            tone: "warning",     order: 5,  group: "venda" },
  // Materiais (o que a firma compra / craftamos)
  drogas:           { label: "Drogas",             tone: "success",     order: 10, group: "compra" },
  corpos:           { label: "Corpos",             tone: "primary",     order: 11, group: "compra" },
  prints:           { label: "Prints",             tone: "primary",     order: 12, group: "compra" },
  minerios:         { label: "Minérios",           tone: "muted",       order: 13, group: "compra" },
  materias_primas:  { label: "Matérias-primas",    tone: "muted",       order: 14, group: "compra" },
  madeiras:         { label: "Madeiras",           tone: "muted",       order: 15, group: "compra" },
  lixo:             { label: "Lixo",               tone: "muted",       order: 16, group: "compra" },
};

const TONE_BG: Record<string, string> = {
  warning: "bg-warning/15 border-warning/40 text-warning",
  destructive: "bg-destructive/15 border-destructive/40 text-destructive",
  info: "bg-info/15 border-info/40 text-info",
  primary: "bg-primary/15 border-primary/40 text-primary",
  success: "bg-success/15 border-success/40 text-success",
  muted: "bg-muted/40 border-border text-muted-foreground",
};


function Page() {
  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  if (me.isLoading) {
    return <p className="text-muted-foreground">A abrir o armazém…</p>;
  }
  if (!me.data?.can_see_inventory) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
          <Crosshair className="h-5 w-5 text-destructive" />
        </div>
        <h2 className="text-display text-lg">Sem chave para esta porta.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O armazém é assunto da chefia e do Patrão di Zona.
        </p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Armazém"
        title="Inventário"
        description="Armas e carregadores que a firma tem em casa. Movimentos automáticos via entregas e encomendas."
        icon={Package}
      />
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">
            <Package className="mr-1.5 h-3.5 w-3.5" /> Stock
          </TabsTrigger>
          <TabsTrigger value="ledger">
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
    </>
  );
}

function StockTable() {
  const fn = useServerFn(getStock);
  const q = useQuery({ queryKey: ["stock"], queryFn: () => fn() });
  const rows = q.data ?? [];
  const [filter, setFilter] = useState<string>("todas");

  // Agrupa pela subcategory vinda da BD (mesma fonte do preçário).
  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = r.subcategory;
    if (!k || !GROUPS[k]) return acc;
    (acc[k] ||= []).push(r);
    return acc;
  }, {});
  const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0);

  if (q.isLoading) {
    return (
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <tbody>
            <TableRowsSkeleton rows={8} cols={3} widths={["w-40", "w-16", "w-20"]} />
          </tbody>
        </table>
      </div>
    );
  }
  if (!total)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Armazém vazio. Mete-te a trabalhar.
      </Card>
    );

  const ordered = Object.entries(groups)
    .sort((a, b) => (GROUPS[a[0]]?.order ?? 50) - (GROUPS[b[0]]?.order ?? 50))
    .filter(([cat]) => filter === "todas" || cat === filter);

  const allCats = Object.entries(groups).sort(
    (a, b) => (GROUPS[a[0]]?.order ?? 50) - (GROUPS[b[0]]?.order ?? 50)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={filter === "todas" ? "default" : "outline"}
          className="h-7 px-3 text-[11px] uppercase tracking-wider"
          onClick={() => setFilter("todas")}
        >
          Todas
        </Button>
        {allCats.map(([cat]) => {
          const meta = GROUPS[cat];
          const active = filter === cat;
          return (
            <Button
              key={cat}
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-7 px-3 text-[11px] uppercase tracking-wider"
              onClick={() => setFilter(cat)}
            >
              <CategoryIcon category={cat} size={12} />
              <span className="ml-1.5">{meta?.label ?? cat}</span>
            </Button>
          );
        })}
      </div>
        const meta = GROUPS[cat] ?? { label: cat, tone: "muted", order: 99, group: "compra" as const };
        const total = items.reduce((s, r) => s + (r.qty ?? 0), 0);
        const value = items.reduce((s, r) => s + (r.qty ?? 0) * (r.unit_price ?? 0), 0);
        return (
          <section key={cat} className="overflow-hidden rounded-sm border border-border bg-card">
            <header
              className={
                "flex items-center justify-between gap-3 border-b px-4 py-2.5 " +
                TONE_BG[meta.tone]
              }
            >
              <div className="flex items-center gap-2">
                <CategoryIcon category={cat} tone={meta.tone} size={18} />
                <h2 className="text-display text-sm uppercase tracking-widest">
                  {meta.label}
                </h2>
              </div>
              <span className="text-display text-[11px] tracking-wider opacity-90">
                {items.length} refs · {fmtNum(total)} em casa · {fmtMoney(Math.round(value))}
              </span>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-display text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Em casa</th>
                  <th className="px-3 py-2 text-right">Preço unid.</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .slice()
                  .sort((a, b) => (b.unit_price ?? 0) - (a.unit_price ?? 0) || (b.qty ?? 0) - (a.qty ?? 0))
                  .map((r) => {
                    const low = r.qty <= 0;
                    const warn = r.qty > 0 && r.qty < 5;
                    return (
                      <tr key={r.item_id} className="border-t border-border hover:bg-accent/30">
                        <td className="px-3 py-2 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <ItemIcon name={r.item_name} category={r.subcategory ?? cat} size={14} />
                            {prettyItemName(r.item_name)}
                          </span>
                        </td>
                        <td
                          className={
                            "px-3 py-2 text-right font-mono " +
                            (low ? "text-destructive" : warn ? "text-warning" : "")
                          }
                        >
                          {fmtNum(r.qty)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {r.unit_price != null ? fmtMoney(r.unit_price) : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function LedgerTable() {
  const fn = useServerFn(getLedger);
  const q = useQuery({ queryKey: ["ledger"], queryFn: () => fn({ data: { limit: 150 } }) });
  return (
    <div className="overflow-hidden rounded-sm border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-display text-xs">
          <tr>
            <th className="px-3 py-2 text-left">Quando</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-left">Quem</th>
            <th className="px-3 py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {q.isLoading && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted-foreground">
                A puxar histórico…
              </td>
            </tr>
          )}
          {(q.data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {fmtDate(r.created_at)}
              </td>
              <td className="px-3 py-2">{formatMovementType(r.type)}</td>
              <td className="px-3 py-2 font-medium">
                {r.item_name ? (
                  <span className="inline-flex items-center gap-2">
                    <ItemIcon name={r.item_name} size={14} />
                    {prettyItemName(r.item_name)}
                  </span>
                ) : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.member_name ?? "—"}</td>
              <td
                className={
                  "px-3 py-2 text-right font-mono " +
                  (r.qty < 0 ? "text-destructive" : "text-success")
                }
              >
                {r.qty > 0 ? "+" : ""}
                {fmtNum(r.qty)}
              </td>
            </tr>
          ))}
          {!q.isLoading && !q.data?.length && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted-foreground">
                Sem movimentos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
