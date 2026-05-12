import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listRecipes,
  computeCraftFeasibility,
  type CraftFeasibility,
} from "@/lib/recipes.functions";
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
import { toast } from "sonner";
import { Hammer, Calculator, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/receitas")({
  component: Page,
});

function Page() {
  const fn = useServerFn(listRecipes);
  const calcFn = useServerFn(computeCraftFeasibility);
  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: () => fn() });
  const [calcRecipe, setCalcRecipe] = useState<number | null>(null);
  const [qtyStr, setQtyStr] = useState("1");
  const [result, setResult] = useState<CraftFeasibility | null>(null);
  const [search, setSearch] = useState("");

  const calc = useMutation({
    mutationFn: () =>
      calcFn({
        data: {
          recipe_id: calcRecipe!,
          quantity: Math.max(1, Number(qtyStr) || 1),
        },
      }),
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (recipes.data ?? []).filter(
    (r) => !search || r.item_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        eyebrow="Crafting"
        title="Receitas"
        description="Custo real por receita, com base nos preços de compra dos ingredientes."
      />
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Procurar item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {recipes.isLoading && (
          <p className="text-muted-foreground">A carregar…</p>
        )}
        {filtered.map((r) => (
          <div
            key={r.recipe_id}
            className="rounded-sm border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-display text-sm">{r.item_name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.tier ?? r.category ?? "—"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCalcRecipe(r.recipe_id);
                  setQtyStr("1");
                  setResult(null);
                }}
              >
                <Calculator className="mr-1 h-4 w-4" />
                Simular
              </Button>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {r.ingredients.map((i) => (
                <li
                  key={i.item_id}
                  className="flex justify-between border-b border-border/40 py-1"
                >
                  <span>
                    {i.quantity}× {i.name}
                  </span>
                  <span className="text-muted-foreground">
                    {fmtNum(Math.round(i.line_cost))} €
                  </span>
                </li>
              ))}
              {!r.ingredients.length && (
                <li className="text-muted-foreground">
                  Sem ingredientes registados
                </li>
              )}
            </ul>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Custo: {fmtNum(Math.round(r.total_cost))} €
              </span>
              {isManager ? (
                <span
                  className={
                    r.margin >= 0
                      ? "text-success font-medium"
                      : "text-destructive font-medium"
                  }
                >
                  Margem firma: {fmtNum(Math.round(r.margin))} €{" "}
                  {r.margin_pct != null ? `(${r.margin_pct.toFixed(0)}%)` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                  <Lock className="h-3 w-3" /> margem só para a chefia
                </span>
              )}
            </div>
          </div>
        ))}
        {!recipes.isLoading && !filtered.length && (
          <p className="text-muted-foreground">Sem receitas.</p>
        )}
      </div>

      <Dialog
        open={calcRecipe != null}
        onOpenChange={(v) => !v && setCalcRecipe(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simular crafting</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-muted-foreground">
                Quantidade a craftar
              </label>
              <Input
                type="number"
                min={1}
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
              />
            </div>
            {result && (
              <div className="rounded-sm border border-border bg-muted/30 p-3 text-xs">
                <div className="font-medium">
                  {result.item_name} × {result.requested_qty}
                </div>
                <div>
                  Custo total:{" "}
                  <strong>{fmtNum(Math.round(result.total_cost))} €</strong>
                </div>
                <div
                  className={
                    result.feasible
                      ? "text-emerald-500 mt-2"
                      : "text-red-500 mt-2"
                  }
                >
                  {result.feasible
                    ? "Stock suficiente ✓"
                    : "Stock insuficiente:"}
                </div>
                {!result.feasible && (
                  <ul className="mt-1 space-y-0.5">
                    {result.missing.map((m) => (
                      <li key={m.name}>
                        · {m.name}: faltam {m.missing} (tens {m.in_stock} /
                        precisas {m.needed})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCalcRecipe(null)}>
              Fechar
            </Button>
            <Button onClick={() => calc.mutate()} disabled={calc.isPending}>
              <Hammer className="mr-1 h-4 w-4" />
              {calc.isPending ? "…" : "Calcular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
