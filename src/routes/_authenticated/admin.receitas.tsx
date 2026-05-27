import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { checkManagerAccess } from "@/lib/access-check.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import {
  listRecipesAdmin,
  updateRecipeIngredientQty,
  type AdminRecipeRow,
} from "@/lib/recipes.admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Pencil, X, Check, Package } from "lucide-react";
import { useState } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ARMORY_CAT_ORDER, ARMORY_CAT_CONFIG, filterItemForDisplay } from "@/lib/armory.catalog";
import { CategoryHeader } from "@/components/domain/CategoryHeader";
import { Reveal, Stagger } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/admin/receitas")({
  beforeLoad: async () => {
    if (isServer()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [{ title: "Editar Receitas | Ballas Gang" }],
  }),
  component: Page,
});

function Page() {
  const managerFn = useAuthedServerFn(checkManagerAccess);
  const managerCheck = useQuery({ queryKey: ["managerCheck"], queryFn: () => managerFn() });
  useRealtimeSync([
    { table: "craft_recipes", queryKeys: [["adminRecipes"]] },
    { table: "recipe_ingredients", queryKeys: [["adminRecipes"]] },
  ]);
  const fn = useAuthedServerFn(listRecipesAdmin);
  const updateFn = useAuthedServerFn(updateRecipeIngredientQty);
  const qc = useQueryClient();
  const recipes = useQuery({ queryKey: ["adminRecipes"], queryFn: () => fn() });
  const [editing, setEditing] = useState<Map<string, string>>(new Map());

  const m = useMutation({
    mutationFn: (v: { recipe_id: number; ingredient_item_id: number; quantity: number }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminRecipes"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (recipes.data ?? []).filter((r) =>
    r.item_name.toLowerCase().includes((editing.get("_search") ?? "").toLowerCase()),
  );

  const grouped = (() => {
    const map = new Map<string, AdminRecipeRow[]>();
    for (const r of filtered) {
      const key = filterItemForDisplay(r.item_name, r.category, r.subcategory) ?? "outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.item_name.localeCompare(b.item_name)));
    }
    return Array.from(map.entries()).sort((a, b) => {
      const ia = ARMORY_CAT_ORDER.indexOf(a[0] as any);
      const ib = ARMORY_CAT_ORDER.indexOf(b[0] as any);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  })();

  if (managerCheck.isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!managerCheck.data?.allowed) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Só a direção pode aceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Chefia"
        title="Editar Receitas"
        description="Editar receitas de craft"
      />

      <Reveal direction="up">
        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Procurar arma"
            value={editing.get("_search") ?? ""}
            onChange={(e) => setEditing((prev) => new Map(prev).set("_search", e.target.value))}
          />
        </div>
      </Reveal>

      {grouped.length === 0 ? (
        <Reveal direction="up">
          <div className="rounded-xl border border-dashed border-border/50 bg-card/30 py-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">Sem receitas.</p>
          </div>
        </Reveal>
      ) : (
        <div className="space-y-8">
          {grouped.map(([category, items], idx) => {
            const cfg = (ARMORY_CAT_CONFIG as any)[category];
            return (
              <Reveal key={category} direction="up" delay={idx * 100}>
                <section>
                  <div className="mb-3">
                    <CategoryHeader
                      category={category}
                      right={`${items.length} receita${items.length !== 1 ? "s" : ""}`}
                    />
                  </div>
                  <Stagger className="grid gap-4 md:grid-cols-2" staggerDelay={80}>
                    {items.map((r) => (
                      <RecipeEditorCard
                        key={r.recipe_id}
                        r={r}
                        editing={editing}
                        setEditing={setEditing}
                        onSave={(ingId, qty) =>
                          m.mutate({ recipe_id: r.recipe_id, ingredient_item_id: ingId, quantity: qty })
                        }
                        isPending={m.isPending}
                      />
                    ))}
                  </Stagger>
                </section>
              </Reveal>
            );
          })}
        </div>
      )}
    </>
  );
}

function RecipeEditorCard({
  r,
  editing,
  setEditing,
  onSave,
  isPending,
}: {
  r: AdminRecipeRow;
  editing: Map<string, string>;
  setEditing: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  onSave: (ingId: number, qty: number) => void;
  isPending: boolean;
}) {
  return (
    <Card className="interactive-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-display text-sm flex items-center gap-2">
          {r.item_name}
          {r.tier && (
            <span className="text-[10px] uppercase tracking-wide rounded-sm px-1.5 py-0.5 border bg-muted text-muted-foreground">
              {r.tier}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {r.ingredients.map((ing) => {
            const key = `${r.recipe_id}-${ing.item_id}`;
            const isEditing = editing.has(key);
            return (
              <div key={ing.item_id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{ing.name}</span>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      className="h-7 w-20 text-right text-sm"
                      value={editing.get(key) ?? String(ing.quantity)}
                      onChange={(e) =>
                        setEditing((prev) => new Map(prev).set(key, e.target.value))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = Math.max(0, Number(editing.get(key) ?? ing.quantity));
                          onSave(ing.item_id, val);
                          setEditing((prev) => {
                            const n = new Map(prev);
                            n.delete(key);
                            return n;
                          });
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={isPending}
                      onClick={() => {
                        const val = Math.max(0, Number(editing.get(key) ?? ing.quantity));
                        onSave(ing.item_id, val);
                        setEditing((prev) => {
                          const n = new Map(prev);
                          n.delete(key);
                          return n;
                        });
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        setEditing((prev) => {
                          const n = new Map(prev);
                          n.delete(key);
                          return n;
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 rounded-sm px-2 py-1 text-sm hover:bg-muted transition-colors"
                    onClick={() =>
                      setEditing((prev) => new Map(prev).set(key, String(ing.quantity)))
                    }
                  >
                    <span className="font-mono">{ing.quantity}</span>
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            );
          })}
          {!r.ingredients.length && (
            <p className="text-sm text-muted-foreground">Sem ingredientes</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
