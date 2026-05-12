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

export const Route = createFileRoute("/_authenticated/inventario")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: Page,
});

type CatMeta = { label: string; emoji: string; tone: string; order: number; matchSub?: (s: string | null) => boolean };

// Cor de cada grupo (usa tokens do design system)
const GROUPS: Record<string, CatMeta> = {
  armas_orange: { label: "Armas Orange", emoji: "🟧", tone: "warning", order: 1 },
  armas_red:    { label: "Armas Red",    emoji: "🟥", tone: "destructive", order: 2 },
  armas_brancas:{ label: "Armas Brancas",emoji: "🔪", tone: "info", order: 3 },
  municoes:     { label: "Carregadores & Munições", emoji: "🎯", tone: "primary", order: 4 },
  drogas:       { label: "Drogas",       emoji: "💊", tone: "success", order: 5 },
  materias_primas: { label: "Matérias-primas", emoji: "⛏️", tone: "primary", order: 6 },
  componentes:  { label: "Componentes",  emoji: "⚙️", tone: "muted", order: 7 },
  consumiveis:  { label: "Consumíveis",  emoji: "🥤", tone: "muted", order: 8 },
  lixo:         { label: "Lixo & Sucata",emoji: "🗑️", tone: "muted", order: 9 },
  outros:       { label: "Outros",       emoji: "📦", tone: "muted", order: 99 },
};

function classifyRow(r: { category: string | null; item_name: string }): string {
  const c = (r.category ?? "").toLowerCase();
  const n = (r.item_name ?? "").toLowerCase();
  if (c === "armas_brancas") return "armas_brancas";
  if (c === "municoes" || c === "municao" || /carregador|municao|munição|bala/.test(n)) return "municoes";
  if (c === "drogas") return "drogas";
  if (c === "lixo") return "lixo";
  if (c === "componentes" || c === "acessorios") return "componentes";
  if (c === "consumiveis" || c === "consumivel") return "consumiveis";
  if (c === "materias_primas" || c === "materiais") return "materias_primas";
  if (c === "armas" || c === "armas_fogo") {
    // tenta separar por nome
    if (/red|ak|m4|sniper|fuzil|shotgun|caçadeira/.test(n)) return "armas_red";
    return "armas_orange";
  }
  return "outros";
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

  // group by visual category
  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = classifyRow(r);
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  if (q.isLoading) return <p className="text-muted-foreground">A contar…</p>;
  if (!rows.length)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Armazém vazio. Mete-te a trabalhar.
      </Card>
    );

  const ordered = Object.entries(groups).sort(
    (a, b) => (GROUPS[a[0]]?.order ?? 50) - (GROUPS[b[0]]?.order ?? 50)
  );

  return (
    <div className="space-y-6">
      {ordered.map(([cat, items]) => {
        const meta = GROUPS[cat] ?? GROUPS.outros;
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
                <span className="text-lg leading-none">{meta.emoji}</span>
                <h2 className="text-display text-sm uppercase tracking-widest">
                  {meta.label}
                </h2>
              </div>
              <span className="text-display text-[11px] tracking-wider opacity-90">
                {items.length} refs · {fmtNum(total)} em casa · {fmtNum(Math.round(value))} €
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
                  .sort((a, b) => (b.qty ?? 0) - (a.qty ?? 0))
                  .map((r) => {
                    const low = r.qty <= 0;
                    const warn = r.qty > 0 && r.qty < 5;
                    return (
                      <tr key={r.item_id} className="border-t border-border hover:bg-accent/30">
                        <td className="px-3 py-2 font-medium">{r.item_name}</td>
                        <td
                          className={
                            "px-3 py-2 text-right font-mono " +
                            (low ? "text-destructive" : warn ? "text-warning" : "")
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
              <td className="px-3 py-2">{MOV_LABEL[r.type] ?? r.type}</td>
              <td className="px-3 py-2 font-medium">{r.item_name ?? "—"}</td>
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
