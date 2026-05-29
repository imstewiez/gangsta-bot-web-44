import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useMemo, useState } from "react";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { listRecipes, type RecipeRow } from "@/lib/recipes.functions";
import { updateItemPrice } from "@/lib/recipes.admin.functions";

import {
  itemPoints,
  type CatalogItem,
  type CurrentMember,
} from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtNum, fmtPrice } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";
import { CategoryHeader } from "@/components/domain/CategoryHeader";
import {
  Tags,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Package,
  Star,
} from "lucide-react";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  filterItemForDisplay,
} from "@/lib/armory.catalog";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Reveal, Stagger } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/precario")({
  head: () => ({
    meta: [{ title: "Preçário | Ballas Gang" }],
  }),
  component: Page,
});

const COMPRA_GROUPS: { key: string; label: string }[] = [
  { key: "corpos", label: "Corpos" },
  { key: "prints", label: "Prints" },
];

function Page() {
  useRealtimeSync([
    { table: "items", queryKeys: [["catalog"]] },
  ]);
  const qc = useQueryClient();
  const catFn = useAuthedServerFn(getCatalog);
  const meFn = useAuthedServerFn(getCurrentMember);
  const recipesFn = useAuthedServerFn(listRecipes);
  const updateFn = useAuthedServerFn(updateItemPrice);
  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => catFn() });
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: () => recipesFn() });
  const [tab, setTab] = useState("compra");
  const [editMode, setEditMode] = useState(false);

  const grouped = useMemo(() => {
    const out: Record<string, CatalogItem[]> = {};
    for (const it of cat.data ?? []) {
      const k = filterItemForDisplay(it.name, it.category, it.subcategory);
      if (!k) continue;
      (out[k] ||= []).push(it);
    }
    return out;
  }, [cat.data]);

  const recipeMap = useMemo(() => {
    const map = new Map<number, RecipeRow>();
    for (const r of recipes.data ?? []) {
      map.set(r.item_id, r);
    }
    return map;
  }, [recipes.data]);

  const isManager = me.data?.is_manager ?? false;

  const updatePrice = useMutation({
    mutationFn: (v: { item_id: number; purchase_price?: number; min_sale_price?: number; xp_points?: number }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Preço atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function vendaItemsForGroup(catKey: string): CatalogItem[] {
    return (cat.data ?? []).filter((it) => {
      const c = filterItemForDisplay(it.name, it.category, it.subcategory);
      if (!c) return false;
      const hasPrice = (it.min_sale_price ?? 0) > 0 || (it.tier_price ?? 0) > 0;
      return c === catKey && hasPrice;
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Tabela da firma"
        title="Preçário"
        icon={Tags}
        description={
          me.data
            ? `Preços de venda da firma.`
            : "Tabela de compra e venda da firma."
        }
      />

      {isManager && (
        <Reveal direction="up" delay={50}>
          <div className="mb-4 flex justify-end gap-2">
            <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {editMode ? "Concluir" : "Editar preços"}
            </Button>
          </div>
        </Reveal>
      )}

      <Reveal direction="up" delay={100}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="compra" className="interactive-tab">A firma compra</TabsTrigger>
            <TabsTrigger value="venda" className="interactive-tab">A firma vende</TabsTrigger>
          </TabsList>

          <TabsContent value="compra" className="mt-4 space-y-8">
            <Reveal direction="up" delay={50}>
              <p className="text-xs text-muted-foreground">
                Preços que pagamos pelo material que entregares. Larga em <span className="text-foreground">Entregas</span>.
              </p>
            </Reveal>
            <Stagger direction="up" staggerDelay={80} baseDelay={100} className="space-y-8">
              {COMPRA_GROUPS.map((g) => (
                <BuyTable
                  key={g.key}
                  catKey={g.key}
                  title={g.label}
                  items={grouped[g.key] ?? []}
                  editMode={editMode && isManager}
                  onUpdatePrice={(id, val) => updatePrice.mutate({ item_id: id, purchase_price: val })}
                  onUpdatePoints={(id, val) => updatePrice.mutate({ item_id: id, xp_points: val })}
                  pending={updatePrice.isPending}
                />
              ))}
            </Stagger>
          </TabsContent>

          <TabsContent value="venda" className="mt-4 space-y-8">
            <Reveal direction="up" delay={50}>
              <p className="text-xs text-muted-foreground">
                Só vendemos a gente da casa. Encomendas em <span className="text-foreground">Encomendas</span>.
              </p>
            </Reveal>
            <Stagger direction="up" staggerDelay={80} baseDelay={100} className="space-y-8">
              {ARMORY_CAT_ORDER.map((key) => (
                <SellTable
                  key={key}
                  catKey={key}
                  title={ARMORY_CAT_CONFIG[key].label}
                  items={vendaItemsForGroup(key)}
                  recipeMap={recipeMap}
                  isManager={isManager}
                  editMode={editMode && isManager}
                  onUpdatePrice={(id, field, val) => updatePrice.mutate({ item_id: id, [field]: val })}
                  pending={updatePrice.isPending}
                />
              ))}
            </Stagger>
          </TabsContent>
        </Tabs>
      </Reveal>
    </>
  );
}

function BuyTable({
  title,
  items,
  catKey,
  editMode,
  onUpdatePrice,
  onUpdatePoints,
  pending,
}: {
  title: string;
  items: CatalogItem[];
  catKey: string;
  editMode: boolean;
  onUpdatePrice: (id: number, val: number) => void;
  onUpdatePoints: (id: number, val: number) => void;
  pending: boolean;
}) {
  if (!items.length) return null;
  const isDrogas = items[0]?.subcategory === "drogas";
  const sorted = [...items].sort((a, b) => (a.purchase_price ?? 0) - (b.purchase_price ?? 0));
  return (
    <section>
      <div className="mb-2">
        <CategoryHeader category={catKey} label={title} />
      </div>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-center">Pontos</th>
              {isDrogas ? (
                <><th className="px-3 py-2 text-right">Morador</th><th className="px-3 py-2 text-right">Civil</th></>
              ) : (
                <th className="px-3 py-2 text-right">Preço</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => (
              <PriceRow key={it.id} it={it} catKey={catKey} editMode={editMode} onUpdatePrice={onUpdatePrice} onUpdatePoints={onUpdatePoints} pending={pending} isDrogas={isDrogas} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SellTable({
  title,
  items,
  catKey,
  recipeMap,
  isManager,
  editMode,
  onUpdatePrice,
  pending,
}: {
  title: string;
  items: CatalogItem[];
  catKey: string;
  recipeMap: Map<number, RecipeRow>;
  isManager: boolean;
  editMode: boolean;
  onUpdatePrice: (id: number, field: "purchase_price" | "min_sale_price", val: number) => void;
  pending: boolean;
}) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => (a.min_sale_price ?? 0) - (b.min_sale_price ?? 0));
  const cfg = (ARMORY_CAT_CONFIG as any)[catKey];
  return (
    <section>
      <div className="mb-2">
        <CategoryHeader category={catKey} label={title} />
      </div>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Sem material</th>
              <th className="px-3 py-2 text-right">Com material</th>
              <th className="px-3 py-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => (
              <SellRow key={it.id} it={it} catKey={catKey} recipe={recipeMap.get(it.id) ?? null} isManager={isManager} editMode={editMode} onUpdatePrice={onUpdatePrice} pending={pending} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PriceRow({
  it, catKey, editMode, onUpdatePrice, onUpdatePoints, pending, isDrogas,
}: {
  it: CatalogItem; catKey: string; editMode: boolean; onUpdatePrice: (id: number, val: number) => void; onUpdatePoints: (id: number, val: number) => void; pending: boolean; isDrogas: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(it.purchase_price ?? 0));
  const [editingPoints, setEditingPoints] = useState(false);
  const [ptsVal, setPtsVal] = useState(String(itemPoints(it.name, it.category, it.xp_points)));

  return (
    <tr className="border-t border-border interactive-row">
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2 font-medium">
          <ItemIcon name={it.name} category={catKey} size={14} />
          {it.name}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        {editMode ? (
          editingPoints ? (
            <div className="flex items-center justify-center gap-1">
              <Input type="number" min={0} className="h-5 w-14 text-center text-xs px-1" value={ptsVal} onChange={(e) => setPtsVal(e.target.value)} autoFocus />
              <button className="text-emerald-400" disabled={pending} onClick={() => { onUpdatePoints(it.id, Number(ptsVal)); setEditingPoints(false); }}><Check className="h-3 w-3" /></button>
              <button className="text-muted-foreground" onClick={() => { setPtsVal(String(itemPoints(it.name, it.category, it.xp_points))); setEditingPoints(false); }}><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button className="inline-flex items-center justify-center gap-1 rounded-sm bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400" onClick={() => setEditingPoints(true)}>
              <Star className="h-2.5 w-2.5" />
              {itemPoints(it.name, it.category, it.xp_points)}
              <Pencil className="h-2.5 w-2.5 text-amber-200/70" />
            </button>
          )
        ) : (
          <span className="inline-flex items-center justify-center gap-1 rounded-sm bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400">
            <Star className="h-2.5 w-2.5" />
            {itemPoints(it.name, it.category, it.xp_points)}
          </span>
        )}
      </td>
      {isDrogas ? (
        <>
          <td className="px-3 py-2 text-right font-mono text-success">{fmtPrice(it.morador_purchase_price)}</td>
          <td className="px-3 py-2 text-right font-mono">{fmtPrice(it.purchase_price)}</td>
        </>
      ) : (
        <td className="px-3 py-2 text-right font-mono">
          {editMode ? (
            editing ? (
              <div className="flex items-center justify-end gap-1">
                <Input type="number" min={0} className="h-5 w-20 text-right text-xs px-1" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
                <button className="text-emerald-400" disabled={pending} onClick={() => { onUpdatePrice(it.id, Number(val)); setEditing(false); }}><Check className="h-3 w-3" /></button>
                <button className="text-muted-foreground" onClick={() => { setVal(String(it.purchase_price ?? 0)); setEditing(false); }}><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button className="flex items-center gap-1 justify-end w-full" onClick={() => setEditing(true)}>
                {fmtPrice(it.purchase_price)} <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )
          ) : (
            fmtPrice(it.purchase_price)
          )}
        </td>
      )}
    </tr>
  );
}

function SellRow({
  it, catKey, recipe, isManager, editMode, onUpdatePrice, pending,
}: {
  it: CatalogItem; catKey: string; recipe: RecipeRow | null;
  isManager: boolean;
  editMode: boolean; onUpdatePrice: (id: number, field: "purchase_price" | "min_sale_price", val: number) => void; pending: boolean;
}) {
  const [editingPurchase, setEditingPurchase] = useState(false);
  const [editingSale, setEditingSale] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [purchaseVal, setPurchaseVal] = useState(String(it.purchase_price ?? 0));
  const [saleVal, setSaleVal] = useState(String(it.min_sale_price ?? 0));
  const finalPrice = it.tier_price ?? it.min_sale_price ?? 0;

  return (
    <>
      <tr className="border-t border-border interactive-row">
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-2 font-medium">
            <ItemIcon name={it.name} category={catKey} size={14} />
            {it.name}
          </span>
        </td>
        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
        {isManager && editMode ? (
          editingPurchase ? (
            <div className="flex items-center justify-end gap-1">
              <Input type="number" min={0} className="h-5 w-20 text-right text-xs px-1" value={purchaseVal} onChange={(e) => setPurchaseVal(e.target.value)} autoFocus />
              <button className="text-emerald-400" disabled={pending} onClick={() => { onUpdatePrice(it.id, "purchase_price", Number(purchaseVal)); setEditingPurchase(false); }}><Check className="h-3 w-3" /></button>
              <button className="text-muted-foreground" onClick={() => { setPurchaseVal(String(it.purchase_price ?? 0)); setEditingPurchase(false); }}><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button className="flex items-center gap-1 justify-end w-full" onClick={() => setEditingPurchase(true)}>
              {fmtPrice(it.purchase_price)} <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )
        ) : (
          <span>{fmtPrice(it.purchase_price)}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {isManager && editMode ? (
          editingSale ? (
            <div className="flex items-center justify-end gap-1">
              <Input type="number" min={0} className="h-5 w-20 text-right text-xs px-1" value={saleVal} onChange={(e) => setSaleVal(e.target.value)} autoFocus />
              <button className="text-emerald-400" disabled={pending} onClick={() => { onUpdatePrice(it.id, "min_sale_price", Number(saleVal)); setEditingSale(false); }}><Check className="h-3 w-3" /></button>
              <button className="text-muted-foreground" onClick={() => { setSaleVal(String(it.min_sale_price ?? 0)); setEditingSale(false); }}><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button className="flex items-center gap-1 justify-end w-full" onClick={() => setEditingSale(true)}>
              <span className="text-primary font-semibold">{fmtPrice(finalPrice)}</span> <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )
        ) : (
          <span className="text-primary font-semibold">{fmtPrice(finalPrice)}</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
          {recipe && recipe.ingredients.length > 0 && (
            <button onClick={() => setExpanded((v) => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </td>
      </tr>
      {expanded && recipe && recipe.ingredients.length > 0 && (
        <tr>
          <td colSpan={4} className="px-3 py-2 bg-muted/20 border-t border-border/50">
            <div className="text-xs space-y-1">
              <div className="text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5">
                <Package className="h-3 w-3" />
                Materiais para entregar
              </div>
              {recipe.ingredients.map((ing) => (
                <div key={ing.item_id} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{ing.name}</span>
                  <span className="font-mono text-muted-foreground/80">{ing.quantity} {ing.quantity === 1 ? "unidade" : "unidades"}</span>
                </div>
              ))}
              {isManager && (
                <>
                  <div className="pt-1 border-t border-border/30 flex justify-between gap-4 text-muted-foreground/60">
                    <span>Custo estimado</span>
                    <span className="font-mono">{fmtPrice(Math.round(recipe.total_cost))}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground/60">
                    <span>Margem</span>
                    <span className="font-mono">{recipe.margin_pct != null ? Math.round(recipe.margin_pct) : 0}%</span>
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
