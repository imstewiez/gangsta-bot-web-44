import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStock, getLedger } from "@/lib/inventory.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { fmtNum, fmtDate } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair, Package, History } from "lucide-react";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";

export const Route = createFileRoute("/_authenticated/inventario")({
  component: Page,
});

type CatMeta = { label: string; tone: string; order: number };

const GROUPS: Record<string, CatMeta> = {
  armas_red: { label: "Armas Red", tone: "destructive", order: 1 },
  armas_orange: { label: "Armas Orange", tone: "warning", order: 2 },
  carregadores: { label: "Carregadores", tone: "primary", order: 3 },
  acessorios_armas: { label: "Acessórios", tone: "info", order: 4 },
  drogas: { label: "Drogas", tone: "success", order: 5 },
  materiais_craft: {
    label: "Materiais de Craft",
    tone: "muted",
    order: 6,
  },
};

function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classifyRow(r: { category: string | null; item_name: string }): string | null {
  const c = (r.category ?? "").toLowerCase();
  const n = normalizeName(r.item_name);

  // === 1. EXCLUIR ===
  if (c === "armas_brancas") return null;
  if (n.includes("estragad")) return null;
  if (c === "coletes" || n.includes("colete")) return null;
  if (n.includes("gusenberg") && n.includes("sweeper")) return null;

  // === 2. MATERIAIS DE CRAFT (primeiro para não serem confundidos com armas) ===
  if (/\bcorpo\b|\bcorpos\b|\bprint\b|\bprints\b|\ba[çc]o\b|\bpe[çc]as\b|\bcobre\b|\bp[oó]lvora\b/.test(n)) {
    return "materiais_craft";
  }

  // === 3. CARREGADORES ===
  if (/\bcarregador\b/.test(n)) {
    return "carregadores";
  }

  // === 4. ACESSÓRIOS ===
  if (
    /\bsilenciador\b|\bmira\b|\bgrip\b|\blanterna\b|\bmuzzle\b|\bbarrel\b|\bextensivo\b|\bmag\s*expandido\b/.test(n)
  ) {
    return "acessorios_armas";
  }

  // === 5. DROGAS ===
  if (
    /\bcabe[çc]os\b|\bhaxixe\b|\berva\b|\bmeth\b|\bmeta\b|\bmetanfetamina\b|\bmaconha\b|\bcoca[ií]na\b|\bop[ií]o\b/.test(n)
  ) {
    return "drogas";
  }

  // === 6. ARMAS ORANGE (só se não for nada acima) ===
  if (
    /\bsns\b|\bxm3\b|\bmini\s*smg\b|\bmicro\s*smg\b|\bmachine\s*pistol\b|\btec\s*pistol\b|\bap\s*pistol\b|\bassault\s*shotgun\b|\bheavy\s*shotgun\b|\bcompact\s*rifle\b|\bgusenberg\b/.test(n)
  ) {
    return "armas_orange";
  }

  // === 7. ARMAS RED ===
  if (
    /\bheavy\s*pistol\b|\b\.50\b|\bp90\b|\bpdw\b|\bbullpup\b|\bcarabina\b|\brevolver\b|\bgadget\b|\bassault\s*rifle\b|\bsniper\b|\bfuzil\b/.test(n)
  ) {
    return "armas_red";
  }

  return null;
}

const TONE_BG: Record<string, string> = {
  warning: "bg-warning/15 border-warning/40 text-warning",
  destructive: "bg-destructive/15 border-destructive/40 text-destructive",
  info: "bg-info/15 border-info/40 text-info",
  primary: "bg-primary/15 border-primary/40 text-primary",
  success: "bg-success/15 border-success/40 text-success",
  muted: "bg-muted/40 border-border text-muted-foreground",
};

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
  craftado: "Crafte",
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

  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = classifyRow(r);
    if (!k) return acc;
    (acc[k] ||= []).push(r);
    return acc;
  }, {});
  const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0);

  if (q.isLoading) return <p className="text-muted-foreground">A contar…</p>;
  if (!total)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Armazém vazio. Mete-te a trabalhar.
      </Card>
    );

  // Ordena categorias por valor total decrescente
  const ordered = Object.entries(groups).sort((a, b) => {
    const valA = a[1].reduce((s, r) => s + (r.qty ?? 0) * (r.unit_price ?? 0), 0);
    const valB = b[1].reduce((s, r) => s + (r.qty ?? 0) * (r.unit_price ?? 0), 0);
    return valB - valA;
  });

  return (
    <div className="space-y-6">
      {ordered.map(([cat, items]) => {
        const meta = GROUPS[cat] ?? { label: cat, tone: "muted", order: 99 };
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
                {items.length} refs · {fmtNum(totalQty)} em casa ·{" "}
                {fmtNum(Math.round(value))} €
              </span>
            </header>
            <div className="overflow-x-auto">
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
                    .sort((a, b) => (b.unit_price ?? 0) - (a.unit_price ?? 0))
                    .map((r) => {
                      const low = r.qty <= 0;
                      const warn = r.qty > 0 && r.qty < 5;
                      return (
                        <tr
                          key={r.item_id}
                          className="border-t border-border hover:bg-accent/30"
                        >
                          <td className="px-3 py-2 font-medium">
                            <span className="inline-flex items-center gap-2">
                              <ItemIcon
                                name={r.item_name}
                                category={r.subcategory ?? cat}
                                size={14}
                              />
                              {r.item_name}
                            </span>
                          </td>
                          <td
                            className={
                              "px-3 py-2 text-right font-mono " +
                              (low
                                ? "text-destructive"
                                : warn
                                  ? "text-warning"
                                  : "")
                            }
                          >
                            {fmtNum(r.qty)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {r.unit_price != null ? fmtNum(r.unit_price) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LedgerTable() {
  const fn = useServerFn(getLedger);
  const q = useQuery({
    queryKey: ["ledger"],
    queryFn: () => fn({ page: 1, limit: 50 }),
  });
  const rows = q.data?.rows ?? [];

  if (q.isLoading) return <p className="text-muted-foreground">A carregar…</p>;
  if (!rows.length)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Sem movimentos registados.
      </Card>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-display text-[11px] uppercase tracking-wider text-muted-foreground">
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
              className="border-t border-border hover:bg-accent/30"
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
  );
}
