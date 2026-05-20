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
import { updateRecipeIngredientQty } from "@/lib/recipes.admin.functions";
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
import { fmtNum } from "@/lib/domain";
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
} from "lucide-react";
import type { RecipeRow } from "@/lib/recipes.functions";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  weaponDisplayCategory,
  itemSubLabel,
  PRINT_LABELS,
  PRINT_BADGE_CLASS,
} from "@/lib/armory.catalog";

export const Route = createFileRoute("/_authenticated/receitas")({
  component: Page,
});

function printBadge(tier: string | null): { label: string; cls: string } | null {
  if (!tier || tier === "orange") return null;
  const label = PRINT_LABELS[tier] ?? tier;
  const cls = PRINT_BADGE_CLASS[tier] ?? "";
  if (!cls) return null;
  return { label, cls };
}

function RecipeCard({
  r,
  isManager,
  onSimulate,
  editMode,
  onUpdateIngredient,
  pending,
}: {
  r: RecipeRow;
  isManager: boolean;
  onSimulate: (id: number) => void;
  editMode: boolean;
  onUpdateIngredient: (recipeId: number, ingItemId: number, qty: number) => void;
  pending: boolean;
}) {
  const badge = printBadge(r.tier);
  const [editing, setEditing] = useState<Map<number, string>>(new Map());

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
                  {i.quantity} × {fmtNum(i.unit_cost)} = {fmtNum(Math.round(i.line_cost))} €
                </span>
              )}
            </li>
          );
        })}
        {!r.ingredients.length && (
          <li className="text-muted-foreground">Sem ingredientes registados</li>
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Custo: {fmtNum(Math.round(r.total_cost))} €
        </span>
        {isManager ? (
          <span className={cn("font-medium", r.margin >= 0 ? "text-emerald-400" : "text-destructive")}>
            {r.margin >= 0 ? "+" : ""}{fmtNum(Math.round(r.margin))} €
            {r.margin_pct != null ? ` (${r.margin_pct.toFixed(0)}%)` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground/70">
            <Lock className="h-3 w-3" /> chefia
          </span>
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

  const grouped = useMemo(() => {
    const all = recipes.data ?? [];
    const filtered = search ? all.filter((r) => r.item_name.toLowerCase().includes(search.toLowerCase())) : all;

    const map = new Map<string, RecipeRow[]>();
    for (const r of filtered) {
      const key = weaponDisplayCategory(r.recipe_category, r.tier, r.item_name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }

    for (const list of map.values()) {
      list.sort((a, b) => b.estimated_value - a.estimated_value);
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

  const totalRecipes = (recipes.data ?? []).filter(r => weaponDisplayCategory(r.recipe_category, r.tier, r.item_name) !== null).length;

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
          const cfg = ARMORY_CAT_CONFIG[category];
          const Icon = cfg?.icon ?? Package;
          return (
            <section key={category} className="animate-rise">
              <div className="mb-3 flex items-center gap-2">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", cfg?.bg ?? "bg-muted")}>
                  <Icon className={cn("h-4 w-4", cfg?.color ?? "text-muted-foreground")} />
                </div>
                <h2 className={cn("text-display text-sm font-bold tracking-wide", cfg?.headerColor ?? "text-foreground")}>
                  {cfg?.label ?? category}
                </h2>
                <span className="text-[11px] text-muted-foreground/60">
                  {items.length} receita{items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((r) => (
                  <RecipeCard
                    key={r.recipe_id}
                    r={r}
                    isManager={isManager}
                    editMode={editMode}
                    pending={updateIng.isPending}
                    onUpdateIngredient={(rid, iid, qty) => updateIng.mutate({ recipe_id: rid, ingredient_item_id: iid, quantity: qty })}
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
              <div className="rounded-sm border border-border bg-muted/30 p-3 text-xs">
                <div className="font-medium">{result.item_name} × {result.requested_qty}</div>
                <div>Custo total: <strong>{fmtNum(Math.round(result.total_cost))} €</strong></div>
                <div className={result.feasible ? "text-emerald-500 mt-2" : "text-red-500 mt-2"}>
                  {result.feasible ? "Stock suficiente" : "Stock insuficiente:"}
                </div>
                {!result.feasible && (
                  <ul className="mt-1 space-y-0.5">
                    {result.missing.map((m) => (
                      <li key={m.name}>· {m.name}: faltam {m.missing} (tens {m.in_stock} / precisas {m.needed})</li>
                    ))}
                  </ul>
                )}
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
