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

const CAT_LABEL: Record<string, string> = {
  armas: "Armas",
  armas_fogo: "Armas de fogo",
  armas_brancas: "Armas brancas",
  municoes: "Carregadores",
  acessorios: "Acessórios",
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

  // group by category
  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = r.category ?? "outros";
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

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([cat, items]) => {
        const total = items.reduce((s, r) => s + (r.qty ?? 0), 0);
        return (
          <section key={cat}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-display text-sm uppercase tracking-widest text-muted-foreground">
                {CAT_LABEL[cat] ?? cat}
              </h2>
              <span className="text-display text-xs text-muted-foreground">
                {items.length} refs · <span className="text-foreground">{fmtNum(total)}</span> em casa
              </span>
            </div>
            <div className="overflow-hidden rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-display text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Em casa</th>
                    <th className="px-3 py-2 text-right">Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const low = r.qty <= 0;
                    const warn = r.qty > 0 && r.qty < 5;
                    return (
                      <tr
                        key={r.item_id}
                        className="border-t border-border hover:bg-accent/30"
                      >
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
            </div>
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
