import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";

import {
  listItemsAdmin,
  updateItemPrice,
  type AdminItemRow,
} from "@/lib/recipes.admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Pencil, X, Check } from "lucide-react";
import { useState } from "react";
import { fmtNum } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/precos")({
  component: Page,
});

function Page() {
  const fn = useAuthedServerFn(listItemsAdmin);
  const updateFn = useAuthedServerFn(updateItemPrice);
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["adminItems"], queryFn: () => fn() });
  const [editing, setEditing] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");

  const m = useMutation({
    mutationFn: (v: { item_id: number; estimated_value?: number; purchase_price?: number }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminItems"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Preço atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (items.data ?? []).filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const groupBy = (key: (i: AdminItemRow) => string) => {
    const map = new Map<string, AdminItemRow[]>();
    for (const i of filtered) {
      const k = key(i) ?? "outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const groups = groupBy((i) => i.category);

  return (
    <>
      <PageHeader
        eyebrow="Chefia"
        title="Editar Preços"
        description="Editar preços dos items"
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Procurar item"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {groups.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {cat}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((item) => (
                <PriceCard
                  key={item.id}
                  item={item}
                  editing={editing}
                  setEditing={setEditing}
                  onSave={(updates) => m.mutate({ item_id: item.id, ...updates })}
                  isPending={m.isPending}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function PriceCard({
  item,
  editing,
  setEditing,
  onSave,
  isPending,
}: {
  item: AdminItemRow;
  editing: Map<string, string>;
  setEditing: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  onSave: (updates: { estimated_value?: number; purchase_price?: number }) => void;
  isPending: boolean;
}) {
  const evKey = `ev-${item.id}`;
  const ppKey = `pp-${item.id}`;
  const isEditingEv = editing.has(evKey);
  const isEditingPp = editing.has(ppKey);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-display text-sm">{item.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Estimated Value */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Valor estimado</span>
          {isEditingEv ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                className="h-7 w-28 text-right text-sm"
                value={editing.get(evKey) ?? String(item.estimated_value ?? 0)}
                onChange={(e) => setEditing((prev) => new Map(prev).set(evKey, e.target.value))}
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isPending}
                onClick={() => {
                  const val = Number(editing.get(evKey) ?? item.estimated_value);
                  onSave({ estimated_value: val });
                  setEditing((prev) => {
                    const n = new Map(prev);
                    n.delete(evKey);
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
                    n.delete(evKey);
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
              onClick={() => setEditing((prev) => new Map(prev).set(evKey, String(item.estimated_value ?? 0)))}
            >
              <span className="font-mono">{fmtNum(item.estimated_value)} €</span>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Purchase Price */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Preço de compra</span>
          {isEditingPp ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                className="h-7 w-28 text-right text-sm"
                value={editing.get(ppKey) ?? String(item.purchase_price ?? 0)}
                onChange={(e) => setEditing((prev) => new Map(prev).set(ppKey, e.target.value))}
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isPending}
                onClick={() => {
                  const val = Number(editing.get(ppKey) ?? item.purchase_price);
                  onSave({ purchase_price: val });
                  setEditing((prev) => {
                    const n = new Map(prev);
                    n.delete(ppKey);
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
                    n.delete(ppKey);
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
              onClick={() => setEditing((prev) => new Map(prev).set(ppKey, String(item.purchase_price ?? 0)))}
            >
              <span className="font-mono">{fmtNum(item.purchase_price)} €</span>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
