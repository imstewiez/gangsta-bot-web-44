import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { tierMargin, TIER_LABELS, type CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { fmtMoney, prettyItemName } from "@/lib/domain";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";
import { Tags } from "lucide-react";

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
  const [compraCat, setCompraCat] = useState<string>("todas");
  const [vendaCat, setVendaCat] = useState<string>("todas");

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
        icon={Tags}
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
          <CategoryChips
            groups={COMPRA_GROUPS}
            grouped={grouped}
            value={compraCat}
            onChange={setCompraCat}
          />
          {COMPRA_GROUPS.filter((g) => compraCat === "todas" || g.key === compraCat).map((g) => (
            <BuyTable key={g.key} catKey={g.key} title={g.label} items={grouped[g.key] ?? []} />
          ))}
        </TabsContent>

        <TabsContent value="venda" className="mt-4 space-y-8">
          <p className="text-xs text-muted-foreground">
            Só vendemos a gente da casa. Encomendas em <span className="text-foreground">Encomendas</span>.
          </p>
          <CategoryChips
            groups={VENDA_GROUPS}
            grouped={grouped}
            value={vendaCat}
            onChange={setVendaCat}
          />
          {VENDA_GROUPS.filter((g) => vendaCat === "todas" || g.key === vendaCat).map((g) => (
            <SellTable key={g.key} catKey={g.key} title={g.label} items={grouped[g.key] ?? []} myMargin={myMargin} />
          ))}
        </TabsContent>
      </Tabs>
    </>
  );
}

function CategoryChips({
  groups, grouped, value, onChange,
}: {
  groups: { key: string; label: string }[];
  grouped: Record<string, CatalogItem[]>;
  value: string;
  onChange: (v: string) => void;
}) {
  const visible = groups.filter((g) => (grouped[g.key]?.length ?? 0) > 0);
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant={value === "todas" ? "default" : "outline"}
        className="h-7 px-3 text-[11px] uppercase tracking-wider"
        onClick={() => onChange("todas")}
      >
        Todas
      </Button>
      {visible.map((g) => {
        const active = value === g.key;
        return (
          <Button
            key={g.key}
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-7 px-3 text-[11px] uppercase tracking-wider"
            onClick={() => onChange(g.key)}
          >
            <CategoryIcon category={g.key} size={12} />
            <span className="ml-1.5">{g.label}</span>
          </Button>
        );
      })}
    </div>
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
                    {prettyItemName(it.name)}
                  </span>
                </td>
                {isDrogas ? (
                  <>
                    <td className="px-3 py-2 text-right font-mono text-success">{fmtMoney(it.morador_purchase_price ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.purchase_price ?? 0)}</td>
                  </>
                ) : (
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(it.purchase_price ?? 0)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SellTable({ title, items, myMargin, catKey }: { title: string; items: CatalogItem[]; myMargin: number; catKey: string }) {
  if (!items.length) return null;
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
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <ItemIcon name={it.name} category={it.subcategory ?? catKey} size={14} />
                      {prettyItemName(it.name)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(base)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtMoney(Math.round(base * 1.015))}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtMoney(Math.round(base * 1.01))}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtMoney(Math.round(base * 1.005))}</td>
                  <td className="px-3 py-2 text-right font-mono text-primary font-semibold">{fmtMoney(Math.round(base * (1 + myMargin)))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
