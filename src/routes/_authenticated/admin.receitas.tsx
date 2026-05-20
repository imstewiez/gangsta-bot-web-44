import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";

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
import { Save, Pencil, X, Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/receitas")({
  component: Page,
});

function Page() {
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

  return (
    <>
      <PageHeader
        eyebrow="Chefia"
        title="Editar Receitas"
        description="Editar receitas de craft"
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Procurar arma"
          value={editing.get("_search") ?? ""}
          onChange={(e) => setEditing((prev) => new Map(prev).set("_search", e.target.value))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((r) => (
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
      </div>
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
    <Card>
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
