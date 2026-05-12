import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { tierMargin, TIER_LABELS, type CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtNum } from "@/lib/domain";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";

export const Route = createFileRoute("/_authenticated/precario")({ component: Page });

const COMPRA_GROUPS: { key: string; label: string }[] = [
  { key: "lixo", label: "Lixo" },
  { key: "madeiras", label: "Madeiras" },
  { key: "materias_primas", label: "Matérias-primas" },
  { key: "minerios", label: "Minérios" },
  { key: "corpos", label: "Corpos" },
  { key: "prints", label: "Prints" },
  { key: "drogas", label: "Drogas" },
];

const VENDA_GROUPS: { key: string; label: string }[] = [
  { key: "armas_brancas", label: "Armas brancas" },
  { key: "armas_orange", label: "Armas Orange" },
  { key: "armas_red", label: "Armas Red" },
  { key: "carregadores", label: "Carregadores" },
  { key: "coletes", label: "Coletes" },
  { key: "acessorios", label: "Acessórios" },
];

function Page() {
  const catFn = useServerFn(getCatalog);
  const meFn = useServerFn(getCurrentMember);
  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => catFn() });
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const [tab, setTab] = useState("compra");

  const grouped = useMemo(() => {
    const out: Record<string, CatalogItem[]> = {};
    (cat.data ?? []).forEach((it) => {
      const k = it.subcategory ?? "outros";
      (out[k] ||= []).push(it);
    });
    return out;
  }, [cat.data]);

  const myMargin = tierMargin(me.data?.tier);

  return (
    <>
      <PageHeader
        eyebrow="Tabela da firma"
        title="Preçário"
        description={
          me.data
            ? `Vês os preços ajustados ao teu escalão — ${TIER_LABELS[me.data.tier ?? ""] ?? "—"}${myMargin > 0 ? ` (margem +${(myMargin * 100).toFixed(1)}%)` : ""}.`
            : "Tabela de compra e venda da firma."
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="compra">A firma compra</TabsTrigger>
          <TabsTrigger value="venda">A firma vende</TabsTrigger>
        </TabsList>

        <TabsContent value="compra" className="mt-4 space-y-8">
          <p className="text-xs text-muted-foreground">
            Preços que pagamos pelo material que entregares. Larga em <span className="text-foreground">Entregas</span>.
          </p>
          {COMPRA_GROUPS.map((g) => (
            <BuyTable key={g.key} title={g.label} items={grouped[g.key] ?? []} />
          ))}
        </TabsContent>

        <TabsContent value="venda" className="mt-4 space-y-8">
          <p className="text-xs text-muted-foreground">
            Só vendemos a gente da casa. Encomendas em <span className="text-foreground">Encomendas</span>.
          </p>
          {VENDA_GROUPS.map((g) => (
            <SellTable key={g.key} title={g.label} items={grouped[g.key] ?? []} myMargin={myMargin} />
          ))}
        </TabsContent>
      </Tabs>
    </>
  );
}

function BuyTable({ title, items, catKey }: { title: string; items: CatalogItem[]; catKey: string }) {
  if (!items.length) return null;
  const isDrogas = items[0]?.subcategory === "drogas";
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-display text-sm uppercase tracking-widest text-muted-foreground">
        <CategoryIcon category={catKey} size={16} />
        {title}
      </h2>
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              {isDrogas ? (
                <>
                  <th className="px-3 py-2 text-right">Morador</th>
                  <th className="px-3 py-2 text-right">Civil</th>
                </>
              ) : (
                <th className="px-3 py-2 text-right">Preço</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <ItemIcon name={it.name} category={it.subcategory ?? catKey} size={14} />
                    {it.name}
                  </span>
                </td>
                {isDrogas ? (
                  <>
                    <td className="px-3 py-2 text-right font-mono text-success">{fmtNum(it.morador_purchase_price ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(it.purchase_price ?? 0)}</td>
                  </>
                ) : (
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(it.purchase_price ?? 0)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SellTable({ title, items, myMargin }: { title: string; items: CatalogItem[]; myMargin: number }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="text-display text-sm uppercase tracking-widest text-muted-foreground mb-2">{title}</h2>
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Base</th>
              <th className="px-3 py-2 text-right">YB +1.5%</th>
              <th className="px-3 py-2 text-right">GN +1%</th>
              <th className="px-3 py-2 text-right">GF +0.5%</th>
              <th className="px-3 py-2 text-right">Para ti</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const base = it.min_sale_price ?? 0;
              return (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{it.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(base)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtNum(Math.round(base * 1.015))}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtNum(Math.round(base * 1.01))}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtNum(Math.round(base * 1.005))}</td>
                  <td className="px-3 py-2 text-right font-mono text-primary font-semibold">{fmtNum(Math.round(base * (1 + myMargin)))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
