import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useMemo, useState } from "react";
import { getCatalog, getBuyCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { listRecipes, type RecipeRow } from "@/lib/recipes.functions";
import { itemPoints, type CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtPrice } from "@/lib/domain";
import { ItemIcon } from "@/components/domain/ItemIcon";
import { CategoryHeader } from "@/components/domain/CategoryHeader";
import { ChevronDown, ChevronUp, Package, Star, Tags } from "lucide-react";
import { ARMORY_CAT_CONFIG, ARMORY_CAT_ORDER, filterItemForDisplay } from "@/lib/armory.catalog";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/precario")({
  head: () => ({ meta: [{ title: "Preçário | Ballas Gang" }] }),
  component: Page,
});

function withMaterial(item: CatalogItem) {
  return Number(item.tier_price_with_material ?? item.tier_price ?? item.min_sale_price ?? 0);
}

function withoutMaterial(item: CatalogItem) {
  return Number(item.tier_price_without_material ?? item.purchase_price ?? 0);
}

function Page() {
  useRealtimeSync([
    { table: "items", queryKeys: [["catalog"], ["buyCatalog"], ["recipes"]] },
    { table: "item_tier_surcharges", queryKeys: [["catalog"], ["recipes"]] },
    { table: "recipe_ingredients", queryKeys: [["recipes"]] },
    { table: "recipe_ingredient_tier_overrides", queryKeys: [["recipes"]] },
  ]);

  const [tab, setTab] = useState("compra");
  const catFn = useAuthedServerFn(getCatalog);
  const buyCatFn = useAuthedServerFn(getBuyCatalog);
  const meFn = useAuthedServerFn(getCurrentMember);
  const recipesFn = useAuthedServerFn(listRecipes);

  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => catFn() });
  const buyCat = useQuery({ queryKey: ["buyCatalog"], queryFn: () => buyCatFn(), enabled: tab === "compra" });
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: () => recipesFn() });

  const highDemandItems = useMemo(() => (buyCat.data ?? []).filter((item) => item.high_demand), [buyCat.data]);
  const buyGrouped = useMemo(() => groupCatalog((buyCat.data ?? []).filter((item) => !item.high_demand)), [buyCat.data]);
  const recipeMap = useMemo(() => new Map((recipes.data ?? []).map((r) => [r.item_id, r] as const)), [recipes.data]);
  const isManager = me.data?.is_manager ?? false;

  function saleItemsForGroup(catKey: string) {
    return (cat.data ?? []).filter(
      (item) => filterItemForDisplay(item.name, item.category, item.subcategory) === catKey && (withMaterial(item) > 0 || withoutMaterial(item) > 0),
    );
  }

  return (
    <>
      <PageHeader eyebrow="Tabela da firma" title="Preçário" icon={Tags} description="Preços de compra e venda da firma." />
      <Reveal direction="up" delay={100}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="compra" className="interactive-tab">A firma compra</TabsTrigger>
            <TabsTrigger value="venda" className="interactive-tab">A firma vende</TabsTrigger>
          </TabsList>
          <TabsContent value="compra" className="mt-4 space-y-8">
            <p className="text-xs text-muted-foreground">Preços que pagamos pelo material entregue.</p>
            <Stagger direction="up" staggerDelay={80} baseDelay={100} className="space-y-8">
              {highDemandItems.length ? <BuyTable catKey="materiais" title="Material Em Alta" items={highDemandItems} highDemand /> : null}
              {ARMORY_CAT_ORDER.map((key) => {
                const items = buyGrouped[key] ?? [];
                return items.length ? <BuyTable key={key} catKey={key} title={ARMORY_CAT_CONFIG[key].label} items={items} /> : null;
              })}
            </Stagger>
          </TabsContent>
          <TabsContent value="venda" className="mt-4 space-y-8">
            <p className="text-xs text-muted-foreground">Preços visíveis conforme o teu cargo atual.</p>
            <Stagger direction="up" staggerDelay={80} baseDelay={100} className="space-y-8">
              {ARMORY_CAT_ORDER.map((key) => (
                <SellTable key={key} catKey={key} title={ARMORY_CAT_CONFIG[key].label} items={saleItemsForGroup(key)} recipeMap={recipeMap} isManager={isManager} />
              ))}
            </Stagger>
          </TabsContent>
        </Tabs>
      </Reveal>
    </>
  );
}

function groupCatalog(items: CatalogItem[]) {
  const out: Record<string, CatalogItem[]> = {};
  for (const item of items) {
    const key = filterItemForDisplay(item.name, item.category, item.subcategory);
    if (key) (out[key] ||= []).push(item);
  }
  return out;
}

function effectivePoints(item: CatalogItem) {
  return item.high_demand && item.high_demand_points != null
    ? item.high_demand_points
    : itemPoints(item.name, item.category, item.xp_points);
}

function BuyTable({ title, items, catKey, highDemand = false }: { title: string; items: CatalogItem[]; catKey: string; highDemand?: boolean }) {
  const sorted = [...items].sort((a, b) => highDemand ? effectivePoints(b) - effectivePoints(a) : (a.purchase_price ?? 0) - (b.purchase_price ?? 0));
  return (
    <section>
      <div className="mb-2"><CategoryHeader category={catKey} label={title} /></div>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Material</th>
              <th className="px-3 py-2 text-center">Pontos</th>
              <th className="px-3 py-2 text-right">Preço</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className={cn("border-t border-border interactive-row", item.high_demand && "bg-amber-500/5")}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <ItemIcon name={item.name} category={catKey} size={14} />
                    {item.name}
                    {item.high_demand && <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">em alta</span>}
                  </span>
                  {item.high_demand_reason && <div className="mt-1 text-[11px] text-muted-foreground">{item.high_demand_reason}</div>}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center justify-center gap-1 rounded-sm bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400">
                    <Star className="h-2.5 w-2.5" />
                    {effectivePoints(item)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{fmtPrice(item.purchase_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SellTable({ title, items, catKey, recipeMap, isManager }: { title: string; items: CatalogItem[]; catKey: string; recipeMap: Map<number, RecipeRow>; isManager: boolean }) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => withoutMaterial(a) - withoutMaterial(b));
  return (
    <section>
      <div className="mb-2"><CategoryHeader category={catKey} label={title} /></div>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Material</th>
              <th className="px-3 py-2 text-right">Sem material</th>
              <th className="px-3 py-2 text-right">Com material</th>
              <th className="w-10 px-3 py-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <SellRow key={item.id} item={item} catKey={catKey} recipe={recipeMap.get(item.id) ?? null} isManager={isManager} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SellRow({ item, catKey, recipe, isManager }: { item: CatalogItem; catKey: string; recipe: RecipeRow | null; isManager: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-t border-border interactive-row">
        <td className="px-3 py-2"><span className="inline-flex items-center gap-2 font-medium"><ItemIcon name={item.name} category={catKey} size={14} />{item.name}</span></td>
        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtPrice(withoutMaterial(item))}</td>
        <td className="px-3 py-2 text-right font-mono"><span className="text-primary font-semibold">{fmtPrice(withMaterial(item))}</span></td>
        <td className="px-3 py-2 text-center">
          {recipe?.ingredients.length ? (
            <button onClick={() => setExpanded((value) => !value)} className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && recipe?.ingredients.length ? (
        <tr>
          <td colSpan={4} className="px-3 py-2 bg-muted/20 border-t border-border/50">
            <div className="space-y-1 text-xs">
              <div className="mb-1.5 flex items-center gap-1.5 font-medium text-muted-foreground"><Package className="h-3 w-3" />Materiais para entregar</div>
              {recipe.ingredients.map((ing) => (
                <div key={ing.item_id} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{ing.name}</span>
                  <span className="font-mono text-muted-foreground/80">{ing.quantity} {ing.quantity === 1 ? "unidade" : "unidades"}</span>
                </div>
              ))}
              {isManager ? (
                <>
                  <div className="flex justify-between gap-4 border-t border-border/30 pt-1 text-muted-foreground/60"><span>Custo estimado</span><span className="font-mono">{fmtPrice(Math.round(recipe.total_cost))}</span></div>
                  <div className="flex justify-between gap-4 text-muted-foreground/60"><span>Margem</span><span className="font-mono">{recipe.margin_pct != null ? Math.round(recipe.margin_pct) : 0}%</span></div>
                </>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
