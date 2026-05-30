import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import {
  listDbItemsAdmin,
  updateItemAdmin,
  createItemAdmin,
  deleteItemAdmin,
  deleteItemsAdmin,
  getMaterialItemsAdmin,
  updateItemRecipeAdmin,
} from "@/lib/recipes.admin.functions";
import {
  listItemTierSurcharges,
  upsertItemTierSurcharge,
} from "@/lib/tier-pricing.functions";
import { getCategoryLabel } from "@/lib/config.loader";
import { ARMORY_CAT_CONFIG } from "@/lib/armory.catalog";
import { PageHeader } from "@/components/layout/AppShell";
import { CategoryHeader } from "@/components/domain/CategoryHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtPrice } from "@/lib/domain";
import { toast } from "sonner";
import { beautifyError } from "@/lib/messages";
import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  Loader2,
  Package,
  Search,
  Star,
  Tag,
} from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/itens")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Gestão de Materiais | Ballas Gang" }],
  }),
  component: AdminItemsPage,
});

const SIDE_META: Record<string, { label: string; color: string }> = {
  venda: { label: "Venda", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  compra: { label: "Compra", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ambos: { label: "Ambos", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

const TIER_LABELS: Record<string, string> = {
  young_blood: "Bairrista-1",
  o_gunao: "Bairrista-2",
  gangster_fodido: "Bairrista-3",
};

const TIER_ORDER = ["young_blood", "o_gunao", "gangster_fodido"] as const;

function computeTierPrices(item: any, surcharges?: Map<string, number>): { tier: string; label: string; price: number }[] {
  const basePrice = item.min_sale_price ?? 0;
  return TIER_ORDER.map((t) => {
    const surcharge = surcharges?.get(t) ?? 0;
    return { tier: t, label: TIER_LABELS[t], price: basePrice + surcharge };
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  armas_orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  armas_red: "bg-red-500/15 text-red-400 border-red-500/30",
  municoes: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  carregadores: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  acessorios: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  coletes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  corpos: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  prints: "bg-primary/15 text-primary border-primary/30",
  reciclagem: "bg-green-500/15 text-green-400 border-green-500/30",
  materiais: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  metais: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  madeiras: "bg-amber-600/15 text-amber-600 border-amber-600/30",
  texteis: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  componentes: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  droga: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  equipamento: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  dinheiro: "bg-emerald-600/15 text-emerald-500 border-emerald-600/30",
  outros: "bg-muted/40 text-muted-foreground border-border",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS);

function AdminItemsPage() {
  useRealtimeSync([
    { table: "items", queryKeys: [["dbItemsAdmin"], ["catalog"], ["buyCatalog"]] },
    { table: "inventory_balance", queryKeys: [["stock"]] },
  ]);
  const qc = useQueryClient();
  const listFn = useAuthedServerFn(listDbItemsAdmin);
  const updateFn = useAuthedServerFn(updateItemAdmin);
  const createFn = useAuthedServerFn(createItemAdmin);
  const deleteFn = useAuthedServerFn(deleteItemAdmin);
  const bulkDeleteFn = useAuthedServerFn(deleteItemsAdmin);
  const materialsFn = useAuthedServerFn(getMaterialItemsAdmin);
  const updateRecipeFn = useAuthedServerFn(updateItemRecipeAdmin);
  const listSurchargesFn = useAuthedServerFn(listItemTierSurcharges);

  const items = useQuery({ queryKey: ["dbItemsAdmin"], queryFn: () => listFn() });
  const materials = useQuery({ queryKey: ["materialItemsAdmin"], queryFn: () => materialsFn() });
  const surchargesQuery = useQuery({ queryKey: ["tierSurcharges"], queryFn: () => listSurchargesFn() });

  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [sideFilter, setSideFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<any>({ name: "", category: "armas_orange", side: "venda" });

  const updateM = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["buyCatalog"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setEditingItem(null);
      toast.success("Material atualizado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const createM = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      setShowAdd(false);
      setAddForm({ name: "", category: "armas_orange", side: "venda" });
      toast.success("Material criado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteFn({ data: { item_id: id } }),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      setSelected((prev) => { const n = new Set(prev); n.delete(deletedId); return n; });
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const bulkDeleteM = useMutation({
    mutationFn: async (ids: number[]) => {
      await bulkDeleteFn({ data: { item_ids: ids } });
    },
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      setSelected(new Set());
      toast.success(`${ids.length} items removidos`);
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const updateRecipeM = useMutation({
    mutationFn: (v: any) => updateRecipeFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Receita atualizada");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const filtered = useMemo(() => {
    return (items.data ?? []).filter((it: any) => {
      const matchesName = it.name.toLowerCase().includes(filter.toLowerCase());
      const matchesCat = !catFilter || it.category === catFilter;
      const matchesSide = !sideFilter || it.side === sideFilter;
      return matchesName && matchesCat && matchesSide;
    });
  }, [items.data, filter, catFilter, sideFilter]);

  const categoriesInUse = useMemo(() => {
    const set = new Set<string>();
    for (const it of items.data ?? []) if (it.category) set.add(it.category);
    return Array.from(set).sort();
  }, [items.data]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function selectAll() {
    const allIds = filtered.map((it: any) => it.id);
    const allSelected = allIds.every((id: number) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSelected) {
        allIds.forEach((id: number) => n.delete(id));
      } else {
        allIds.forEach((id: number) => n.add(id));
      }
      return n;
    });
  }



  return (
    <>
      <PageHeader
        eyebrow="Direção"
        title="Gestão de Materiais"
        description="Adicionar, editar e remover materiais da firma"
      />

      {/* Category counts */}
      <Reveal direction="up" delay={50}>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
          <Card className={cn("interactive-card shrink-0 cursor-pointer", !catFilter && "ring-1 ring-primary/40")} onClick={() => setCatFilter("")}>
            <CardContent className="px-3 py-2 flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-primary" />
              <div className="text-sm font-bold leading-none">{(items.data ?? []).length}</div>
              <div className="text-[10px] text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          {categoriesInUse.map((c) => {
            const count = (items.data ?? []).filter((it: any) => it.category === c).length;
            const cfg = CATEGORY_COLORS[c] ?? "";
            const isActive = catFilter === c;
            return (
              <Card
                key={c}
                className={cn("interactive-card shrink-0 cursor-pointer", isActive && "ring-1 ring-primary/40")}
                onClick={() => setCatFilter(isActive ? "" : c)}
              >
                <CardContent className="px-3 py-2 flex items-center gap-2">
                  <span className={cn("inline-block h-2 w-2 rounded-full", cfg.split(" ")[0]?.replace("bg-", "bg-") ?? "bg-muted")} />
                  <div className="text-sm font-bold leading-none">{count}</div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">{getCategoryLabel(c)}</div>
                </CardContent>
              </Card>
            );
          })}
          {selected.size > 0 && (
            <Card className="interactive-card shrink-0 border-amber-500/30">
              <CardContent className="px-3 py-2 flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-amber-400" />
                <div className="text-sm font-bold leading-none">{selected.size}</div>
                <div className="text-[10px] text-muted-foreground">Selecionados</div>
              </CardContent>
            </Card>
          )}
        </div>
      </Reveal>

      {/* Filters */}
      <Reveal direction="up" delay={100}>
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Procurar item..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Todas as categorias</option>
            {categoriesInUse.map((c) => (
              <option key={c} value={c}>{getCategoryLabel(c)}</option>
            ))}
          </select>
          <select
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Todos os lados</option>
            <option value="venda">Venda</option>
            <option value="compra">Compra</option>
            <option value="ambos">Ambos</option>
          </select>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            {showAdd ? "Cancelar" : "Novo item"}
          </Button>
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm(`Remover ${selected.size} materiais?`)) bulkDeleteM.mutate(Array.from(selected));
            }}>
              <Trash2 className="mr-1 h-4 w-4" /> Remover {selected.size}
            </Button>
          )}
        </div>
      </Reveal>

      {/* Add form */}
      {showAdd && (
        <Reveal direction="up" delay={50}>
          <Card className="mb-4 interactive-card border-primary/30">
            <CardHeader>
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Novo Material
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input placeholder="Nome" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
                <select value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                </select>
                <select value={addForm.side} onChange={(e) => setAddForm({ ...addForm, side: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="venda">Venda</option>
                  <option value="compra">Compra</option>
                  <option value="ambos">Ambos</option>
                </select>
                <Input type="number" placeholder="Preço base (oficiais)" value={addForm.purchase_price ?? ""} onChange={(e) => setAddForm({ ...addForm, purchase_price: Number(e.target.value) })} />
                <Input type="number" placeholder="Preço morador" value={addForm.morador_purchase_price ?? ""} onChange={(e) => setAddForm({ ...addForm, morador_purchase_price: Number(e.target.value) })} />
                <Input type="number" placeholder="Preço venda (com mat.)" value={addForm.min_sale_price ?? ""} onChange={(e) => setAddForm({ ...addForm, min_sale_price: Number(e.target.value) })} />
                <Input type="number" placeholder="Valor estimado" value={addForm.estimated_value ?? ""} onChange={(e) => setAddForm({ ...addForm, estimated_value: Number(e.target.value) })} />
                <Input type="number" placeholder="XP" value={addForm.xp_points ?? ""} onChange={(e) => setAddForm({ ...addForm, xp_points: Number(e.target.value) })} />
                <Button size="sm" onClick={() => createM.mutate(addForm)} disabled={createM.isPending}>
                  {createM.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      )}

      {/* Grid de materiais agrupados por categoria */}
      <AdminItemsGrid
        items={filtered}
        isLoading={items.isLoading}
        selected={selected}
        toggleSelect={toggleSelect}
        onEdit={(it: any) => setEditingItem(it)}
        surcharges={surchargesQuery.data ?? []}
      />

      {/* Edit Dialog */}
      {editingItem && (
        <EditItemDialog
          item={editingItem}
          materials={materials.data ?? []}
          onClose={() => setEditingItem(null)}
          onSave={(data: any) => updateM.mutate(data)}
          onUpdateRecipe={(data: any) => updateRecipeM.mutate(data)}
          pending={updateM.isPending || updateRecipeM.isPending}
        />
      )}
    </>
  );
}

const ADMIN_SECTIONS: { key: string; label: string; categories: string[] }[] = [
  { key: "armas_orange", label: "Armas Orange", categories: ["armas_orange"] },
  { key: "armas_red", label: "Armas Red", categories: ["armas_red"] },
  { key: "carregadores", label: "Carregadores", categories: ["carregadores", "municoes"] },
  { key: "acessorios_coletes", label: "Acessórios & Coletes", categories: ["acessorios", "coletes", "acessorios_armas"] },
  { key: "prints", label: "Prints", categories: ["prints"] },
  { key: "corpos", label: "Corpos", categories: ["corpos"] },
  { key: "materiais_craft", label: "Materiais de Fabricação", categories: ["materiais", "reciclagem", "metais", "madeiras", "texteis", "componentes"] },
];

function AdminItemsGrid({
  items,
  isLoading,
  selected,
  toggleSelect,
  onEdit,
  surcharges,
}: {
  items: any[];
  isLoading: boolean;
  selected: Set<number>;
  toggleSelect: (id: number) => void;
  onEdit: (item: any) => void;
  surcharges: Array<{ item_id: number; tier: string; surcharge: number }>;
}) {
  const surchargeMap = useMemo(() => {
    const map = new Map<number, Map<string, number>>();
    for (const s of surcharges) {
      if (!map.has(s.item_id)) map.set(s.item_id, new Map());
      map.get(s.item_id)!.set(s.tier, s.surcharge);
    }
    return map;
  }, [surcharges]);
  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="mx-auto h-10 w-10 opacity-30 mb-3" />
        <p className="text-sm">Nenhum item encontrado</p>
      </div>
    );
  }

  const grouped = new Map<string, any[]>();
  for (const it of items) {
    const sec = ADMIN_SECTIONS.find((s) => s.categories.includes(it.category));
    const key = sec?.key ?? "outros";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(it);
  }

  return (
    <div className="space-y-6">
      {ADMIN_SECTIONS.map((sec) => {
        const list = grouped.get(sec.key) ?? [];
        if (!list.length) return null;
        const cfg = ARMORY_CAT_CONFIG[sec.key as keyof typeof ARMORY_CAT_CONFIG];
        return (
          <section key={sec.key}>
            <CategoryHeader
              category={sec.key}
              label={sec.label}
              right={`${list.length} item${list.length > 1 ? "s" : ""}`}
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-2">
              {list.map((it: any) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  isSelected={selected.has(it.id)}
                  onToggleSelect={() => toggleSelect(it.id)}
                  onEdit={() => onEdit(it)}
                  itemSurcharges={surchargeMap.get(it.id) ?? null}
                />
              ))}
            </div>
          </section>
        );
      })}
      {/* Others — items that don't fit in any section */}
      {(() => {
        const others = grouped.get("outros") ?? [];
        if (!others.length) return null;
        return (
          <section>
            <CategoryHeader category="outros" label="Outros" right={`${others.length} item${others.length > 1 ? "s" : ""}`} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-2">
              {others.map((it: any) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  isSelected={selected.has(it.id)}
                  onToggleSelect={() => toggleSelect(it.id)}
                  onEdit={() => onEdit(it)}
                  itemSurcharges={surchargeMap.get(it.id) ?? null}
                />
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}

function ItemCard({
  item,
  isSelected,
  onToggleSelect,
  onEdit,
  itemSurcharges,
}: {
  item: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  itemSurcharges: Map<string, number> | null;
}) {
  const sideMeta = SIDE_META[item.side ?? "venda"] ?? SIDE_META.venda;
  const catClass = CATEGORY_COLORS[item.category ?? "outros"] ?? CATEGORY_COLORS.outros;

  return (
    <Card className="interactive-card overflow-hidden cursor-pointer" onClick={onEdit}>
      <CardContent className="p-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", catClass)}>
                <Tag className="h-2.5 w-2.5 mr-1" />
                {getCategoryLabel(item.category)}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", sideMeta.color)}>
                {sideMeta.label}
              </Badge>
              {item.xp_points > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-500/30 text-amber-400 bg-amber-500/10">
                  <Star className="h-2.5 w-2.5 mr-1" />
                  {item.xp_points} XP
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Prices */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {item.min_sale_price > 0 && (
            <div className="rounded-md bg-muted/40 p-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Com material</div>
              <div className="font-mono text-sm font-medium text-emerald-400">{fmtPrice(item.min_sale_price)}</div>
            </div>
          )}
          {item.purchase_price > 0 && (
            <div className="rounded-md bg-muted/40 p-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Sem material</div>
              <div className="font-mono text-sm font-medium">{fmtPrice(item.purchase_price)}</div>
            </div>
          )}
          {item.estimated_value > 0 && (
            <div className="rounded-md bg-muted/40 p-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor estimado</div>
              <div className="font-mono text-sm font-medium">{fmtPrice(item.estimated_value)}</div>
            </div>
          )}
          {(() => {
            const tiers = computeTierPrices(item, itemSurcharges ?? undefined);
            const hasDiff = tiers.some((t) => t.price !== tiers[0].price);
            if (!hasDiff || item.min_sale_price <= 0) return null;
            return (
              <>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Bairrista-1</div>
                  <div className="font-mono text-sm font-medium text-emerald-400">{fmtPrice(tiers[0].price)}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Bairrista-3</div>
                  <div className="font-mono text-sm font-medium text-emerald-400">{fmtPrice(tiers[2].price)}</div>
                </div>
              </>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

function EditItemDialog({
  item,
  materials,
  onClose,
  onSave,
  onUpdateRecipe,
  pending,
}: {
  item: any;
  materials: any[];
  onClose: () => void;
  onSave: (data: any) => void;
  onUpdateRecipe: (data: any) => void;
  pending: boolean;
}) {
  const listSurchargesFn = useAuthedServerFn(listItemTierSurcharges);
  const upsertSurchargeFn = useAuthedServerFn(upsertItemTierSurcharge);

  const [form, setForm] = useState({
    item_id: item.id,
    name: item.name,
    category: item.category ?? "",
    side: item.side ?? "venda",
    purchase_price: item.purchase_price ?? 0,
    morador_purchase_price: item.morador_purchase_price ?? 0,
    min_sale_price: item.min_sale_price ?? 0,
    estimated_value: item.estimated_value ?? 0,
    xp_points: item.xp_points ?? 0,
  });

  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{ ingredient_item_id: number; quantity: number; name?: string }>
  >(
    (item.ingredients ?? []).map((ing: any) => ({
      ingredient_item_id: ing.ingredient_item_id,
      quantity: ing.quantity,
      name: ing.ingredient_name,
    }))
  );

  const [newMaterialId, setNewMaterialId] = useState("");
  const [newMaterialQty, setNewMaterialQty] = useState("1");

  // Surcharges state: tier -> value
  const [surcharges, setSurcharges] = useState<Record<string, number>>({});

  // Fetch surcharges on mount
  useEffect(() => {
    listSurchargesFn().then((rows) => {
      const map: Record<string, number> = {};
      for (const row of rows) {
        if (row.item_id === item.id) {
          map[row.tier] = row.surcharge;
        }
      }
      setSurcharges(map);
    });
  }, [item.id]);

  function addMaterial() {
    if (!newMaterialId) return;
    const id = Number(newMaterialId);
    if (recipeIngredients.some((r) => r.ingredient_item_id === id)) return;
    const mat = materials.find((m) => m.id === id);
    setRecipeIngredients([...recipeIngredients, { ingredient_item_id: id, quantity: Number(newMaterialQty) || 1, name: mat?.name }]);
    setNewMaterialId("");
    setNewMaterialQty("1");
  }

  function removeMaterial(id: number) {
    setRecipeIngredients(recipeIngredients.filter((r) => r.ingredient_item_id !== id));
  }

  function updateMaterialQty(id: number, qty: number) {
    setRecipeIngredients(recipeIngredients.map((r) => (r.ingredient_item_id === id ? { ...r, quantity: qty } : r)));
  }

  async function handleSave() {
    onSave(form);
    if (recipeIngredients.length > 0 || (item.ingredients ?? []).length > 0) {
      onUpdateRecipe({
        item_id: item.id,
        ingredients: recipeIngredients.map((r) => ({
          ingredient_item_id: r.ingredient_item_id,
          quantity: r.quantity,
        })),
      });
    }
    // Save surcharges
    for (const tier of TIER_ORDER) {
      const val = surcharges[tier] ?? 0;
      await upsertSurchargeFn({ data: { item_id: item.id, tier, surcharge: val } });
    }
  }

  const availableMaterials = materials.filter((m) => !recipeIngredients.some((r) => r.ingredient_item_id === m.id));

  const surchargeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const tier of TIER_ORDER) {
      const val = surcharges[tier] ?? 0;
      if (val > 0) m.set(tier, val);
    }
    return m;
  }, [surcharges]);

  const tierPrices = useMemo(
    () => computeTierPrices({ ...item, min_sale_price: form.min_sale_price }, surchargeMap),
    [item, form.min_sale_price, surchargeMap]
  );
  const hasTierDiff = tierPrices.some((t) => t.price !== tierPrices[0].price);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Editar {item.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral">
          <TabsList className="mb-3">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="precos">Preços</TabsTrigger>
            <TabsTrigger value="materiais">Materiais ({recipeIngredients.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{getCategoryLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Side</label>
                <select
                  value={form.side}
                  onChange={(e) => setForm({ ...form, side: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="venda">Venda</option>
                  <option value="compra">Compra</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">XP Points</label>
              <Input type="number" value={form.xp_points} onChange={(e) => setForm({ ...form, xp_points: Number(e.target.value) })} />
            </div>
          </TabsContent>

          <TabsContent value="precos" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço com material</label>
                <Input type="number" value={form.min_sale_price} onChange={(e) => setForm({ ...form, min_sale_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço sem material</label>
                <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor estimado (sujo)</label>
                <Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) })} />
              </div>
            </div>

            {/* Acrescimos por cargo */}
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Acréscimos / Decréscimos por cargo (sobre preço com material)
              </div>
              <div className="grid grid-cols-3 gap-3">
                {TIER_ORDER.map((tier) => (
                  <div key={tier}>
                    <label className="text-[10px] text-muted-foreground mb-1 block">{TIER_LABELS[tier]}</label>
                    <Input
                      type="number"
                      value={surcharges[tier] ?? 0}
                      onChange={(e) => setSurcharges((prev) => ({ ...prev, [tier]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Tier prices preview */}
            {hasTierDiff && (
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Preços finais por nível de morador
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-md bg-background border border-border p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">Oficial+</div>
                    <div className="font-mono text-sm font-semibold text-emerald-400">{fmtPrice(form.min_sale_price)}</div>
                  </div>
                  {tierPrices.map((t) => (
                    <div key={t.tier} className="rounded-md bg-background border border-border p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">{t.label}</div>
                      <div className="font-mono text-sm font-semibold text-emerald-400">{fmtPrice(t.price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="materiais" className="space-y-3">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Adicionar material
              </div>
              <div className="flex gap-2">
                <select
                  value={newMaterialId}
                  onChange={(e) => setNewMaterialId(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Selecionar material...</option>
                  {availableMaterials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({getCategoryLabel(m.category)})</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  value={newMaterialQty}
                  onChange={(e) => setNewMaterialQty(e.target.value)}
                  className="w-24"
                />
                <Button size="sm" onClick={addMaterial} disabled={!newMaterialId}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {recipeIngredients.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Sem materiais definidos
              </div>
            )}

            <div className="space-y-2">
              {recipeIngredients.map((ing) => {
                const mat = materials.find((m) => m.id === ing.ingredient_item_id);
                return (
                  <div key={ing.ingredient_item_id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{mat?.name ?? `Material #${ing.ingredient_item_id}`}</div>
                      <div className="text-[11px] text-muted-foreground">{getCategoryLabel(mat?.category)}</div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={ing.quantity}
                      onChange={(e) => updateMaterialQty(ing.ingredient_item_id, Number(e.target.value))}
                      className="w-20 h-8 text-right"
                    />
                    <button
                      className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors"
                      onClick={() => removeMaterial(ing.ingredient_item_id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
