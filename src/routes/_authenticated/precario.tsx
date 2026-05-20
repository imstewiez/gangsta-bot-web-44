import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useMemo, useState } from "react";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { listRecipes, type RecipeRow } from "@/lib/recipes.functions";
import { updateItemPrice } from "@/lib/recipes.admin.functions";
import {
  tierMargin,
  TIER_LABELS,
  type CatalogItem,
} from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtNum } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";
import {
  Tags,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  pricingDisplayCategory,
} from "@/lib/armory.catalog";

export const Route = createFileRoute("/_authenticated/precario")({
  component: Page,
});

const COMPRA_GROUPS: { key: string; label: string }[] = [
  { key: "lixo", label: "Lixo" },
  { key: "madeiras", label: "Madeiras" },
  { key: "materias_primas", label: "Matérias-primas" },
  { key: "minerios", label: "Minérios" },
  { key: "corpos", label: "Corpos" },
  { key: "prints", label: "Prints" },
  { key: "drogas", label: "Drogas" },
];

function Page() {
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
    (cat.data ?? []).forEach((it) => {
      const k = it.subcategory ?? "outros";
      (out[k] ||= []).push(it);
    });
    return out;
  }, [cat.data]);

  const recipeMap = useMemo(() => {
    const map = new Map<number, RecipeRow>();
    for (const r of recipes.data ?? []) {
      map.set(r.item_id, r);
    }
    return map;
  }, [recipes.data]);

  const myMargin = tierMargin(me.data?.tier);
  const isManager = me.data?.is_manager ?? false;

  const updatePrice = useMutation({
    mutationFn: (v: { item_id: number; purchase_price?: number; min_sale_price?: number }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Preço atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function vendaItemsForGroup(catKey: string): CatalogItem[] {
    const items: CatalogItem[] = [];
    for (const [sub, list] of Object.entries(grouped)) {
      if (pricingDisplayCategory(sub) === catKey) items.push(...list);
    }
    return items;
  }

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

      {isManager && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {editMode ? "Concluir" : "Editar preços"}
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="compra" className="interactive-tab">A firma compra</TabsTrigger>
          <TabsTrigger value="venda" className="interactive-tab">A firma vende</TabsTrigger>
        </TabsList>

        <TabsContent value="compra" className="mt-4 space-y-8">
          <p className="text-xs text-muted-foreground">
            Preços que pagamos pelo material que entregares. Larga em <span className="text-foreground">Entregas</span>.
          </p>
          {COMPRA_GROUPS.map((g) => (
            <BuyTable
              key={g.key}
              catKey={g.key}
              title={g.label}
              items={grouped[g.key] ?? []}
              editMode={editMode && isManager}
              onUpdatePrice={(id, val) => updatePrice.mutate({ item_id: id, purchase_price: val })}
              pending={updatePrice.isPending}
            />
          ))}
        </TabsContent>

        <TabsContent value="venda" className="mt-4 space-y-8">
          <p className="text-xs text-muted-foreground">
            Só vendemos a gente da casa. Encomendas em <span className="text-foreground">Encomendas</span>.
          </p>
          {ARMORY_CAT_ORDER.map((key) => (
            <SellTable
              key={key}
              catKey={key}
              title={ARMORY_CAT_CONFIG[key].label}
              items={vendaItemsForGroup(key)}
              myMargin={myMargin}
              recipeMap={recipeMap}
              editMode={editMode && isManager}
              onUpdatePrice={(id, val) => updatePrice.mutate({ item_id: id, min_sale_price: val })}
              pending={updatePrice.isPending}
            />
          ))}
        </TabsContent>
      </Tabs>
    </>
  );
}

function BuyTable({
  title,
  items,
  catKey,
  editMode,
  onUpdatePrice,
  pending,
}: {
  title: string;
  items: CatalogItem[];
  catKey: string;
  editMode: boolean;
  onUpdatePrice: (id: number, val: number) => void;
  pending: boolean;
}) {
  if (!items.length) return null;
  const isDrogas = items[0]?.subcategory === "drogas";
  const sorted = [...items].sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0));
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-display text-sm uppercase tracking-widest text-muted-foreground">
        <CategoryIcon category={catKey} size={16} />
        {title}
      </h2>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              {isDrogas ? (
                <><th className="px-3 py-2 text-right">Morador</th><th className="px-3 py-2 text-right">Civil</th></>
              ) : (
                <th className="px-3 py-2 text-right">Preço</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => (
              <PriceRow key={it.id} it={it} catKey={catKey} editMode={editMode} onUpdatePrice={onUpdatePrice} pending={pending} isDrogas={isDrogas} />
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
  myMargin,
  catKey,
  recipeMap,
  editMode,
  onUpdatePrice,
  pending,
}: {
  title: string;
  items: CatalogItem[];
  myMargin: number;
  catKey: string;
  recipeMap: Map<number, RecipeRow>;
  editMode: boolean;
  onUpdatePrice: (id: number, val: number) => void;
  pending: boolean;
}) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => (b.min_sale_price ?? 0) - (a.min_sale_price ?? 0));
  const cfg = ARMORY_CAT_CONFIG[catKey as any];
  return (
    <section>
      <h2 className={cn("mb-2 flex items-center gap-2 text-display text-sm uppercase tracking-widest", cfg?.headerColor ?? "text-muted-foreground")}>
        {cfg && <cfg.icon className="h-4 w-4" />}
        {title}
      </h2>
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Base</th>
              <th className="px-3 py-2 text-right">Para ti</th>
              <th className="px-3 py-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => (
              <SellRow key={it.id} it={it} catKey={catKey} myMargin={myMargin} recipe={recipeMap.get(it.id) ?? null} editMode={editMode} onUpdatePrice={onUpdatePrice} pending={pending} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PriceRow({
  it, catKey, editMode, onUpdatePrice, pending, isDrogas,
}: {
  it: CatalogItem; catKey: string; editMode: boolean; onUpdatePrice: (id: number, val: number) => void; pending: boolean; isDrogas: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(it.purchase_price ?? 0));

  return (
    <tr className="border-t border-border">
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
                {fmtNum(it.purchase_price ?? 0)} <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )
          ) : (
            fmtNum(it.purchase_price ?? 0)
          )}
        </td>
      )}
    </tr>
  );
}

function SellRow({
  it, catKey, myMargin, recipe, editMode, onUpdatePrice, pending,
}: {
  it: CatalogItem; catKey: string; myMargin: number; recipe: RecipeRow | null;
  editMode: boolean; onUpdatePrice: (id: number, val: number) => void; pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [val, setVal] = useState(String(it.min_sale_price ?? 0));
  const base = it.min_sale_price ?? 0;
  const paraTi = Math.round(base * (1 + myMargin));

  return (
    <>
      <tr className="border-t border-border">
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-2 font-medium">
            <ItemIcon name={it.name} category={it.subcategory ?? catKey} size={14} />
            {it.name}
          </span>
        </td>
        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
          {editMode ? (
            editing ? (
              <div className="flex items-center justify-end gap-1">
                <Input type="number" min={0} className="h-5 w-20 text-right text-xs px-1" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
                <button className="text-emerald-400" disabled={pending} onClick={() => { onUpdatePrice(it.id, Number(val)); setEditing(false); }}><Check className="h-3 w-3" /></button>
                <button className="text-muted-foreground" onClick={() => { setVal(String(it.min_sale_price ?? 0)); setEditing(false); }}><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button className="flex items-center gap-1 justify-end w-full" onClick={() => setEditing(true)}>
                {fmtNum(base)} <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )
          ) : (
            fmtNum(base)
          )}
        </td>
        <td className="px-3 py-2 text-right font-mono text-primary font-semibold">{fmtNum(paraTi)}</td>
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
                  <span className="font-mono text-muted-foreground/80">{ing.quantity} × {fmtNum(ing.unit_cost)} = {fmtNum(Math.round(ing.line_cost))} €</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border/30 flex justify-between gap-4 text-muted-foreground/60">
                <span>Custo estimado</span>
                <span className="font-mono">{fmtNum(Math.round(recipe.total_cost))} €</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
