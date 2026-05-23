import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState, useMemo } from "react";
import {
  listRecipes,
  computeCraftFeasibility,
  type CraftFeasibility,
} from "@/lib/recipes.functions";
import { updateRecipeIngredientQty, updateItemPrice } from "@/lib/recipes.admin.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtNum, fmtPrice } from "@/lib/domain";
import { cn } from "@/lib/utils";

import { toast } from "sonner";
import {
  Hammer,
  Calculator,
  Lock,
  Package,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { RecipeRow } from "@/lib/recipes.functions";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  itemDisplayCategory,
  itemSubLabel,
  PRINT_LABELS,
  PRINT_BADGE_CLASS,
  isOrangeWeapon,
  isAllowedWeapon,
} from "@/lib/armory.catalog";
import { CategoryHeader } from "@/components/domain/CategoryHeader";

export const Route = createFileRoute("/_authenticated/receitas")({
  head: () => ({
    meta: [{ title: "Receitas | Ballas Gang" }],
  }),
  component: Page,
});

function printBadge(tier: string | null, itemName: string | null): { label: string; cls: string } | null {
  let effectiveTier = tier;
  if (!effectiveTier && isOrangeWeapon(itemName)) {
    effectiveTier = "laranja";
  }
  if (!effectiveTier) return null;
  const label = PRINT_LABELS[effectiveTier] ?? effectiveTier;
  const cls = PRINT_BADGE_CLASS[effectiveTier] ?? "";
  if (!cls) return null;
  return { label, cls };
}

function RecipeCard({
  r,
  isManager,
  member,
  onSimulate,
  editMode,
  onUpdateIngredient,
  onUpdatePrice,
  pending,
}: {
  r: RecipeRow;
  isManager: boolean;
  member: { tier: string | null; is_morador: boolean } | null;
  onSimulate: (id: number) => void;
  editMode: boolean;
  onUpdateIngredient: (recipeId: number, ingItemId: number, qty: number) => void;
  onUpdatePrice: (itemId: number, price: number) => void;
  pending: boolean;
}) {
  const badge = printBadge(r.tier, r.item_name);
  const [editing, setEditing] = useState<Map<number, string>>(new Map());
  const [expanded, setExpanded] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const salePrice = r.min_sale_price ?? 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm interactive-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-display text-sm font-medium truncate">{r.item_name}</span>
            {badge && (
              <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="text-[11px] font-medium text-muted-foreground">
            {itemSubLabel(r.category, r.recipe_category)}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => onSimulate(r.recipe_id)}>
          <Calculator className="mr-1 h-3.5 w-3.5" />
          Simular
        </Button>
      </div>

      <ul className="mt-3 space-y-1 text-xs">
        {r.ingredients.map((i) => {
          const isEditing = editing.has(i.item_id);
          return (
            <li key={i.item_id} className="flex justify-between border-b border-border/40 py-1">
              <span className="text-muted-foreground">{i.name}</span>
              {editMode && isManager ? (
                isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      className="h-5 w-14 text-right text-[10px] px-1 py-0"
                      value={editing.get(i.item_id) ?? String(i.quantity)}
                      onChange={(e) => setEditing((prev) => new Map(prev).set(i.item_id, e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = Math.max(0, Number(editing.get(i.item_id) ?? i.quantity));
                          onUpdateIngredient(r.recipe_id, i.item_id, val);
                          setEditing((prev) => { const n = new Map(prev); n.delete(i.item_id); return n; });
                        }
                      }}
                      autoFocus
                    />
                    <button className="text-emerald-400 hover:text-emerald-300" disabled={pending} onClick={() => {
                      const val = Math.max(0, Number(editing.get(i.item_id) ?? i.quantity));
                      onUpdateIngredient(r.recipe_id, i.item_id, val);
                      setEditing((prev) => { const n = new Map(prev); n.delete(i.item_id); return n; });
                    }}><Check className="h-3 w-3" /></button>
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditing((prev) => { const n = new Map(prev); n.delete(i.item_id); return n; })}><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <button className="flex items-center gap-1 font-mono text-muted-foreground/70 hover:text-foreground" onClick={() => setEditing((prev) => new Map(prev).set(i.item_id, String(i.quantity)))}>
                    {i.quantity}× <Pencil className="h-2.5 w-2.5" />
                  </button>
                )
              ) : (
                <span className="text-muted-foreground/70 font-mono">
                  {i.quantity} unidades
                </span>
              )}
            </li>
          );
        })}
        {!r.ingredients.length && (
          <li className="text-muted-foreground">Sem ingredientes registados</li>
        )}
      </ul>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          {isManager && editingPrice ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                className="h-5 w-24 text-right text-[10px] px-1 py-0"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = Math.max(0, Number(priceDraft));
                    onUpdatePrice(r.item_id, val);
                    setEditingPrice(false);
                  }
                }}
                autoFocus
              />
              <button
                className="text-emerald-400 hover:text-emerald-300"
                onClick={() => {
                  const val = Math.max(0, Number(priceDraft));
                  onUpdatePrice(r.item_id, val);
                  setEditingPrice(false);
                }}
              >
                <Check className="h-3 w-3" />
              </button>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingPrice(false)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 font-medium text-foreground"
              onClick={() => {
                if (isManager) {
                  setEditingPrice(true);
                  setPriceDraft(String(Math.round(salePrice)));
                }
              }}
            >
              {fmtPrice(Math.round(salePrice))}
              {isManager && <Pencil className="h-2.5 w-2.5 text-muted-foreground" />}
            </button>
          )}
          {isManager && (
            <button
              className="inline-flex items-center gap-1 text-muted-foreground/70 hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        {isManager && expanded && (
          <div className="mt-2 rounded-md border border-border/50 bg-muted/20 p-2 text-[11px] space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Breakdown de custos
            </div>
            {r.ingredients.map((ing) => (
              <div key={ing.item_id} className="flex justify-between text-muted-foreground/80">
                <span>{ing.name}</span>
                <span className="font-mono">
                  {fmtPrice(Math.round(ing.line_cost))}
                  <span className="text-muted-foreground/50"> ({fmtNum(Math.round(ing.unit_cost))} × {ing.quantity})</span>
                </span>
              </div>
            ))}
            <div className="border-t border-border/40 pt-1 mt-1 flex justify-between font-medium text-foreground">
              <span>Custo total</span>
              <span className="font-mono">{fmtPrice(Math.round(r.total_cost))}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Margem</span>
              <span className="font-mono">
                {fmtPrice(Math.round(r.margin))}
                {r.margin_pct !== null ? ` (${r.margin_pct.toFixed(1)}%)` : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Page() {
  useRealtimeSync(["recipes"]);
  const qc = useQueryClient();
  const fn = useAuthedServerFn(listRecipes);
  const calcFn = useAuthedServerFn(computeCraftFeasibility);
  const meFn = useAuthedServerFn(getCurrentMember);
  const updateFn = useAuthedServerFn(updateRecipeIngredientQty);
  const updatePriceFn = useAuthedServerFn(updateItemPrice);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: () => fn() });
  const [calcRecipe, setCalcRecipe] = useState<number | null>(null);
  const [qtyStr, setQtyStr] = useState("1");
  const [result, setResult] = useState<CraftFeasibility | null>(null);
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);

  const calc = useMutation({
    mutationFn: () => calcFn({ data: { recipe_id: calcRecipe!, quantity: Math.max(1, Number(qtyStr) || 1) } }),
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateIng = useMutation({
    mutationFn: (v: { recipe_id: number; ingredient_item_id: number; quantity: number }) => updateFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipes"] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePrice = useMutation({
    mutationFn: (v: { item_id: number; estimated_value: number }) => updatePriceFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipes"] }); toast.success("Preço atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const all = (recipes.data ?? []).filter((r) => {
      if (/mk2/i.test(r.item_name)) return false;
      const key = itemDisplayCategory(r.item_name, r.category, r.subcategory);
      if (key === "outros" || key === "armas_brancas") return false;
      // Apenas armas permitidas (Red / Orange) — tudo o resto é escondido
      if ((key === "armas_red" || key === "armas_orange") && !isAllowedWeapon(r.item_name)) return false;
      return true;
    });
    const filtered = search ? all.filter((r) => r.item_name.toLowerCase().includes(search.toLowerCase())) : all;

    const map = new Map<string, RecipeRow[]>();
    for (const r of filtered) {
      const key = itemDisplayCategory(r.item_name, r.category, r.subcategory);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }

    for (const list of map.values()) {
      list.sort((a, b) => (a.min_sale_price ?? 0) - (b.min_sale_price ?? 0));
    }
    return Array.from(map.entries()).sort((a, b) => {
      const ia = ARMORY_CAT_ORDER.indexOf(a[0] as any);
      const ib = ARMORY_CAT_ORDER.indexOf(b[0] as any);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [recipes.data, search]);

  const totalRecipes = (recipes.data ?? []).filter(r => {
    if (/mk2/i.test(r.item_name)) return false;
    const key = itemDisplayCategory(r.item_name, r.category, r.subcategory);
    if (key === "outros" || key === "armas_brancas") return false;
    if ((key === "armas_red" || key === "armas_orange") && !isAllowedWeapon(r.item_name)) return false;
    return true;
  }).length;

  return (
    <>
      <PageHeader
        eyebrow="Material"
        title="Receitas"
        description={`${totalRecipes} receitas organizadas por categoria. Custo real com base nos preços de compra.`}
      />

      <div className="mb-5 flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input placeholder="Procurar item" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isManager && (
          <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {editMode ? "Concluir" : "Editar"}
          </Button>
        )}
      </div>

      {recipes.isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-card/40" />
          ))}
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(([category, items]) => {
          const cfg = (ARMORY_CAT_CONFIG as any)[category];
          const Icon = cfg?.icon ?? Package;
          return (
            <section key={category} className="animate-rise">
              <div className="mb-3">
                <CategoryHeader
                  category={category}
                  right={`${items.length} receita${items.length !== 1 ? "s" : ""}`}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((r) => (
                  <RecipeCard
                    key={r.recipe_id}
                    r={r}
                    isManager={isManager}
                    member={me.data ?? null}
                    editMode={editMode}
                    pending={updateIng.isPending || updatePrice.isPending}
                    onUpdateIngredient={(rid, iid, qty) => updateIng.mutate({ recipe_id: rid, ingredient_item_id: iid, quantity: qty })}
                    onUpdatePrice={(itemId, price) => updatePrice.mutate({ item_id: itemId, estimated_value: price })}
                    onSimulate={(id) => { setCalcRecipe(id); setQtyStr("1"); setResult(null); }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {!recipes.isLoading && !grouped.length && (
        <div className="rounded-xl border border-dashed border-border/50 bg-card/30 py-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">Sem receitas.</p>
        </div>
      )}

      <Dialog open={calcRecipe != null} onOpenChange={(v) => !v && setCalcRecipe(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Simular crafting</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Quantidade a craftar</label>
              <Input type="number" min={1} value={qtyStr} onChange={(e) => setQtyStr(e.target.value)} />
            </div>
            {result && (
              <div className="rounded-sm border border-border bg-muted/30 p-3 text-xs space-y-3">
                <div className="font-medium text-sm">{result.item_name} × {result.requested_qty}</div>
                
                {/* Materiais necessários */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Materiais necessários</div>
                  <ul className="space-y-1">
                    {result.ingredients.map((ing) => (
                      <li key={ing.name} className="flex justify-between items-center">
                        <span className="text-foreground">{ing.name}</span>
                        <span className="text-muted-foreground">
                          {ing.qty_per_recipe} × {result.requested_qty} = {fmtNum(ing.needed)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Custos — apenas chefia */}
                {isManager && result.ingredients.length > 0 && (
                  <div className="border-t border-border/50 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Custo estimado (chefia)</div>
                    <ul className="space-y-1">
                      {result.ingredients.map((ing) => (
                        <li key={`cost-${ing.name}`} className="flex justify-between items-center text-muted-foreground/70">
                          <span>{ing.name}</span>
                          <span className="font-mono">{fmtPrice(ing.unit_cost)} × {fmtNum(ing.needed)} = {fmtPrice(Math.round(ing.line_cost))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Preço de venda */}
                {(() => {
                  const unitPrice = result.min_sale_price ?? 0;
                  const total = Math.round(unitPrice * result.requested_qty);
                  return (
                    <div className="border-t border-border pt-2">
                      <div className="flex justify-between items-center font-semibold text-sm">
                        <span>Total a pagar:</span>
                        <span className="text-emerald-400">{fmtPrice(total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCalcRecipe(null)}>Fechar</Button>
            <Button onClick={() => calc.mutate()} disabled={calc.isPending}>
              <Hammer className="mr-1 h-4 w-4" />
              {calc.isPending ? "" : "Calcular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
