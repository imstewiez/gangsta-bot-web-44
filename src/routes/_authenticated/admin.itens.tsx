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
import { getCategoryLabel } from "@/lib/config.loader";
import { PageHeader } from "@/components/layout/AppShell";
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
import React, { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  Loader2,
  Package,
  Search,
  X,
  Check,
  ChevronDown,
  ChevronUp,
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
    meta: [{ title: "Gestão de Items | Ballas Gang" }],
  }),
  component: AdminItemsPage,
});

const SIDE_META: Record<string, { label: string; color: string }> = {
  venda: { label: "Venda", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  compra: { label: "Compra", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ambos: { label: "Ambos", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

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

  const items = useQuery({ queryKey: ["dbItemsAdmin"], queryFn: () => listFn() });
  const materials = useQuery({ queryKey: ["materialItemsAdmin"], queryFn: () => materialsFn() });

  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [sideFilter, setSideFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<any>({ name: "", category: "armas_orange", side: "venda" });
  const [expandedRecipes, setExpandedRecipes] = useState<Set<number>>(new Set());

  function toggleRecipe(id: number) {
    setExpandedRecipes((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const updateM = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["buyCatalog"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setEditingItem(null);
      toast.success("Item atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createM = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      setShowAdd(false);
      setAddForm({ name: "", category: "armas_orange", side: "venda" });
      toast.success("Item criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteFn({ data: { item_id: id } }),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      setSelected((prev) => { const n = new Set(prev); n.delete(deletedId); return n; });
    },
    onError: (e: Error) => toast.error(e.message),
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
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRecipeM = useMutation({
    mutationFn: (v: any) => updateRecipeFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Receita atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return (items.data ?? []).filter((it: any) => {
      const matchesName = it.name.toLowerCase().includes(filter.toLowerCase());
      const matchesCat = !catFilter || it.category === catFilter;
      const matchesSide = !sideFilter || it.side === sideFilter;
      const matchesStatus = statusFilter === "" ? true : statusFilter === "active" ? it.active : !it.active;
      return matchesName && matchesCat && matchesSide && matchesStatus;
    });
  }, [items.data, filter, catFilter, sideFilter, statusFilter]);

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

  const activeCount = (items.data ?? []).filter((it: any) => it.active).length;
  const inactiveCount = (items.data ?? []).length - activeCount;

  return (
    <>
      <PageHeader
        eyebrow="Direção"
        title="Gestão de Items"
        description="Adicionar, editar e remover items da firma"
      />

      {/* Stats */}
      <Reveal direction="up" delay={50}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{(items.data ?? []).length}</div>
                <div className="text-[11px] text-muted-foreground">Total items</div>
              </div>
            </CardContent>
          </Card>
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Check className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{activeCount}</div>
                <div className="text-[11px] text-muted-foreground">Activos</div>
              </div>
            </CardContent>
          </Card>
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <X className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{inactiveCount}</div>
                <div className="text-[11px] text-muted-foreground">Inactivos</div>
              </div>
            </CardContent>
          </Card>
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Star className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{selected.size}</div>
                <div className="text-[11px] text-muted-foreground">Seleccionados</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Reveal>

      {/* Filters */}
      <Reveal direction="up" delay={100}>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Procurar item..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="mr-1 h-4 w-4" />
              {showAdd ? "Cancelar" : "Novo item"}
            </Button>
            {selected.size > 0 && (
              <Button size="sm" variant="destructive" onClick={() => {
                if (confirm(`Remover ${selected.size} items?`)) bulkDeleteM.mutate(Array.from(selected));
              }}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover {selected.size}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCatFilter("")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                !catFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
              )}
            >
              Todas
            </button>
            {categoriesInUse.map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(catFilter === c ? "" : c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  catFilter === c ? CATEGORY_COLORS[c] ?? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                )}
              >
                {getCategoryLabel(c)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            {(["", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                )}
              >
                {s === "" ? "Todos" : s === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            {(["", "venda", "compra", "ambos"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSideFilter(sideFilter === s ? "" : s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  sideFilter === s ? SIDE_META[s]?.color ?? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                )}
              >
                {s === "" ? "Todos os lados" : SIDE_META[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Add form */}
      {showAdd && (
        <Reveal direction="up" delay={50}>
          <Card className="mb-4 interactive-card border-primary/30">
            <CardHeader>
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Novo Item
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

      {/* Items grid */}
      <Reveal direction="up" delay={150}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 && !items.isLoading && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Package className="mx-auto h-10 w-10 opacity-30 mb-3" />
              <p className="text-sm">Nenhum item encontrado</p>
            </div>
          )}
          {filtered.map((it: any) => (
            <ItemCard
              key={it.id}
              item={it}
              isSelected={selected.has(it.id)}
              onToggleSelect={() => toggleSelect(it.id)}
              onEdit={() => setEditingItem(it)}
              onDelete={() => deleteM.mutate(it.id)}
              isExpanded={expandedRecipes.has(it.id)}
              onToggleRecipe={() => toggleRecipe(it.id)}
            />
          ))}
        </div>
      </Reveal>

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

function ItemCard({
  item,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  isExpanded,
  onToggleRecipe,
}: {
  item: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isExpanded: boolean;
  onToggleRecipe: () => void;
}) {
  const sideMeta = SIDE_META[item.side ?? "venda"] ?? SIDE_META.venda;
  const catClass = CATEGORY_COLORS[item.category ?? "outros"] ?? CATEGORY_COLORS.outros;

  return (
    <Card className={cn("interactive-card overflow-hidden transition-opacity", !item.active && "opacity-60")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="mt-1"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{item.name}</span>
                {!item.active && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-500/30 text-red-400 bg-red-500/10">
                    Inactivo
                  </Badge>
                )}
                {!item.in_config && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-500/30 text-amber-400 bg-amber-500/10">
                    Só DB
                  </Badge>
                )}
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
          <div className="flex items-center gap-1 shrink-0">
            <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Prices */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Base (oficiais)</div>
            <div className="font-mono text-sm font-medium">{fmtPrice(item.purchase_price)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Morador</div>
            <div className="font-mono text-sm font-medium">{fmtPrice(item.morador_purchase_price)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Venda (c/ mat.)</div>
            <div className="font-mono text-sm font-medium text-emerald-400">{fmtPrice(item.min_sale_price)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimado</div>
            <div className="font-mono text-sm font-medium">{fmtPrice(item.estimated_value)}</div>
          </div>
        </div>

        {/* Recipe preview */}
        {item.ingredients && item.ingredients.length > 0 && (
          <button
            onClick={onToggleRecipe}
            className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Package className="h-3 w-3" />
            <span>{item.ingredients.length} material{item.ingredients.length !== 1 ? "is" : ""}</span>
            {isExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
        )}
        {isExpanded && item.ingredients && item.ingredients.length > 0 && (
          <div className="mt-2 rounded-md bg-muted/30 p-2 text-xs space-y-1">
            {item.ingredients.map((ing: any) => (
              <div key={ing.ingredient_item_id} className="flex justify-between items-center">
                <span className="text-muted-foreground">{ing.ingredient_name ?? `Item #${ing.ingredient_item_id}`}</span>
                <span className="font-mono">{ing.quantity} {ing.quantity === 1 ? "unidade" : "unidades"}</span>
              </div>
            ))}
          </div>
        )}
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
  const [form, setForm] = useState({
    item_id: item.id,
    name: item.name,
    category: item.category ?? "",
    subcategory: item.subcategory ?? "",
    side: item.side ?? "venda",
    purchase_price: item.purchase_price ?? 0,
    morador_purchase_price: item.morador_purchase_price ?? 0,
    min_sale_price: item.min_sale_price ?? 0,
    estimated_value: item.estimated_value ?? 0,
    xp_points: item.xp_points ?? 0,
    active: item.active,
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

  function handleSave() {
    onSave(form);
  }

  function handleSaveRecipe() {
    onUpdateRecipe({
      item_id: item.id,
      ingredients: recipeIngredients.map((r) => ({
        ingredient_item_id: r.ingredient_item_id,
        quantity: r.quantity,
      })),
    });
  }

  const availableMaterials = materials.filter((m) => !recipeIngredients.some((r) => r.ingredient_item_id === m.id));

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
                <label className="text-xs text-muted-foreground mb-1 block">Subcategoria</label>
                <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
                <div className="flex items-center gap-2 h-9">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, active: true })}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors",
                      form.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-background border-input hover:bg-muted"
                    )}
                  >
                    Activo
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, active: false })}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors",
                      !form.active ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-background border-input hover:bg-muted"
                    )}
                  >
                    Inactivo
                  </button>
                </div>
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
                <label className="text-xs text-muted-foreground mb-1 block">Preço base (oficiais)</label>
                <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço morador</label>
                <Input type="number" value={form.morador_purchase_price} onChange={(e) => setForm({ ...form, morador_purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço venda (com material)</label>
                <Input type="number" value={form.min_sale_price} onChange={(e) => setForm({ ...form, min_sale_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor estimado</label>
                <Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) })} />
              </div>
            </div>
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
                      <div className="text-sm font-medium truncate">{mat?.name ?? `Item #${ing.ingredient_item_id}`}</div>
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

            <Button
              size="sm"
              onClick={handleSaveRecipe}
              disabled={pending}
              className="w-full"
            >
              {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Guardar receita
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
