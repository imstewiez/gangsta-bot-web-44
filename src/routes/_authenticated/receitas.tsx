import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState, useMemo } from "react";
import {
  listRecipes,
  computeCraftFeasibility,
  type CraftFeasibility,
} from "@/lib/recipes.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtNum, fmtPrice } from "@/lib/domain";

import { toast } from "sonner";
import { beautifyError, EMPTY_STATE, LOADING } from "@/lib/messages";
import {
  Hammer,
  Calculator,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Loader2,
} from "lucide-react";
import type { RecipeRow } from "@/lib/recipes.functions";
import {
  ARMORY_CAT_ORDER,
  itemSubLabel,
  PRINT_LABELS,
  PRINT_BADGE_CLASS,
  isOrangeWeapon,
  filterItemForDisplay,
} from "@/lib/armory.catalog";
import { CategoryHeader } from "@/components/domain/CategoryHeader";
import { Reveal, Stagger } from "@/components/layout/Reveal";

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
  canSeeCosts,
  expanded,
  onToggle,
  simulateResult,
  onSimulate,
}: {
  r: RecipeRow;
  canSeeCosts: boolean;
  expanded: boolean;
  onToggle: () => void;
  simulateResult: CraftFeasibility | null;
  onSimulate: (recipeId: number, qty: number) => void;
}) {
  const badge = printBadge(r.tier, r.item_name);
  const salePrice = r.tier_price ?? r.min_sale_price ?? 0;
  const [qtyDraft, setQtyDraft] = useState("1");

  const handleSimulate = () => {
    const qty = Math.max(1, Number(qtyDraft) || 1);
    onSimulate(r.recipe_id, qty);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm interactive-card overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
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
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-foreground">{fmtPrice(Math.round(salePrice))}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 pb-4 space-y-4">
          <div className="pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
              <FlaskConical className="h-3 w-3" />
              Materiais
            </div>
            <div className="space-y-2">
              {r.ingredients.map((ing) => (
                <div key={ing.item_id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{ing.name}</span>
                  <span className="font-mono text-muted-foreground/70">
                    {fmtNum(ing.quantity)}×
                  </span>
                </div>
              ))}
              {!r.ingredients.length && <p className="text-xs text-muted-foreground">Sem ingredientes registados</p>}
            </div>
          </div>

          {canSeeCosts && (
            <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-1.5 text-[11px]">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Detalhe de custos
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

          <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              <Calculator className="h-3 w-3" />
              Simular materiais
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="h-7 w-24 text-sm"
                value={qtyDraft}
                onChange={(e) => setQtyDraft(e.target.value)}
                placeholder="Qtd"
              />
              <Button size="sm" className="h-7 text-xs" onClick={handleSimulate}>
                <Hammer className="mr-1 h-3 w-3" />
                Calcular
              </Button>
            </div>

            {simulateResult && simulateResult.recipe_id === r.recipe_id && (
              <div className="mt-2 space-y-2 text-xs">
                <div className="font-medium text-sm">
                  {simulateResult.item_name} × {simulateResult.requested_qty}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Materiais necessários</div>
                  <ul className="space-y-1">
                    {simulateResult.ingredients.map((ing) => (
                      <li key={ing.name} className="flex justify-between items-center">
                        <span>{ing.name}</span>
                        <span className="text-muted-foreground">
                          {fmtNum(ing.qty_per_recipe)} × {fmtNum(simulateResult.requested_qty)} = {fmtNum(ing.needed)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {canSeeCosts && simulateResult.ingredients.length > 0 && (
                  <div className="border-t border-border/50 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Custo estimado</div>
                    <ul className="space-y-1">
                      {simulateResult.ingredients.map((ing) => (
                        <li key={`cost-${ing.name}`} className="flex justify-between text-muted-foreground/70">
                          <span>{ing.name}</span>
                          <span className="font-mono">{fmtPrice(ing.unit_cost)} × {fmtNum(ing.needed)} = {fmtPrice(Math.round(ing.line_cost))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border-t border-border pt-2">
                  <div className="flex justify-between items-center font-semibold text-sm">
                    <span>Total a pagar:</span>
                    <span className="text-emerald-400">
                      {fmtPrice(Math.round((simulateResult.tier_price ?? simulateResult.min_sale_price ?? 0) * simulateResult.requested_qty))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Page() {
  useRealtimeSync([
    { table: "items", queryKeys: [["catalog"], ["adminItems"], ["recipes"]] },
    { table: "recipe_ingredients", queryKeys: [["recipes"], ["adminRecipes"]] },
  ]);
  const fn = useAuthedServerFn(listRecipes);
  const calcFn = useAuthedServerFn(computeCraftFeasibility);
  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: () => fn() });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [simulateResult, setSimulateResult] = useState<CraftFeasibility | null>(null);
  const canSeeCosts = me.data?.is_manager ?? false;

  const calc = useMutation({
    mutationFn: (v: { recipe_id: number; quantity: number }) => calcFn({ data: v }),
    onSuccess: (r) => setSimulateResult(r),
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const grouped = useMemo(() => {
    const all = (recipes.data ?? []).filter((r) => filterItemForDisplay(r.item_name, r.category, r.subcategory) !== null);
    const filtered = search ? all.filter((r) => r.item_name.toLowerCase().includes(search.toLowerCase())) : all;
    const map = new Map<string, RecipeRow[]>();
    for (const r of filtered) {
      const key = filterItemForDisplay(r.item_name, r.category, r.subcategory);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const list of map.values()) list.sort((a, b) => (a.tier_price ?? a.min_sale_price ?? 0) - (b.tier_price ?? b.min_sale_price ?? 0));
    return Array.from(map.entries()).sort((a, b) => {
      const ia = ARMORY_CAT_ORDER.indexOf(a[0] as any);
      const ib = ARMORY_CAT_ORDER.indexOf(b[0] as any);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [recipes.data, search]);

  const totalRecipes = (recipes.data ?? []).filter((r) => filterItemForDisplay(r.item_name, r.category, r.subcategory) !== null).length;

  return (
    <>
      <PageHeader
        eyebrow="Material"
        title="Receitas"
        description={`${totalRecipes} receitas organizadas por categoria. Consulta de materiais necessários por item.`}
      />

      <Reveal direction="up">
        <div className="mb-5 flex items-center gap-3">
          <div className="max-w-sm flex-1">
            <Input placeholder="Procurar material" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </Reveal>

      {recipes.isLoading && (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{LOADING.recipes}</p>
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(([category, items], idx) => (
          <Reveal key={category} direction="up" delay={idx * 100}>
            <section className="animate-rise">
              <div className="mb-3">
                <CategoryHeader category={category} right={`${items.length} receita${items.length !== 1 ? "s" : ""}`} />
              </div>
              <Stagger className="grid gap-3 md:grid-cols-2" staggerDelay={80}>
                {items.map((r) => (
                  <RecipeCard
                    key={r.recipe_id}
                    r={r}
                    canSeeCosts={canSeeCosts}
                    expanded={expandedId === r.recipe_id}
                    onToggle={() => {
                      setExpandedId((prev) => (prev === r.recipe_id ? null : r.recipe_id));
                      setSimulateResult(null);
                    }}
                    simulateResult={simulateResult}
                    onSimulate={(rid, qty) => calc.mutate({ recipe_id: rid, quantity: qty })}
                  />
                ))}
              </Stagger>
            </section>
          </Reveal>
        ))}
      </div>

      {!recipes.isLoading && !grouped.length && (
        <Reveal direction="up">
          <div className="col-span-full text-center py-12">
            <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">{EMPTY_STATE.recipes.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{EMPTY_STATE.recipes.description}</p>
          </div>
        </Reveal>
      )}
    </>
  );
}
