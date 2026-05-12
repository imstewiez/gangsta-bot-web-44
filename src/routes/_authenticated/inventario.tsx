import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStock, getLedger } from "@/lib/inventory.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtNum, fmtDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/inventario")({ component: Page });

function Page() {
  const stockFn = useServerFn(getStock);
  const ledgerFn = useServerFn(getLedger);
  const stock = useQuery({ queryKey: ["stock"], queryFn: () => stockFn() });
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => ledgerFn({ data: { limit: 100 } }) });
  return (
    <>
      <PageHeader eyebrow="Material" title="Inventário" description="Stock total e movimentos recentes." />
      <Tabs defaultValue="stock">
        <TabsList><TabsTrigger value="stock">Stock</TabsTrigger><TabsTrigger value="ledger">Ledger</TabsTrigger></TabsList>
        <TabsContent value="stock">
          <div className="overflow-hidden rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-display text-xs"><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Categoria</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Preço</th></tr></thead>
              <tbody>
                {stock.isLoading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
                {(stock.data ?? []).map((r) => (
                  <tr key={r.item_id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium">{r.item_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(r.qty)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.unit_price != null ? fmtNum(r.unit_price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="ledger">
          <div className="overflow-hidden rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-display text-xs"><tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Membro</th><th className="px-3 py-2 text-right">Qty</th></tr></thead>
              <tbody>
                {ledger.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
                {(ledger.data ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2">{r.item_name ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.member_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(r.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
