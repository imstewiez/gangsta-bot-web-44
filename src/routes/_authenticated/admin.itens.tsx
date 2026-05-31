import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useMemo, useState } from "react";
import {
  createItemAdmin,
  deleteItemsAdmin,
  getMaterialItemsAdmin,
  listDbItemsAdmin,
  updateItemAdmin,
  updateItemRecipeAdmin,
} from "@/lib/recipes.admin.functions";
import { listItemTierSurcharges, upsertItemTierSurcharge } from "@/lib/tier-pricing.functions";
import { getCategoryLabel } from "@/lib/config.loader";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtPrice } from "@/lib/domain";
import { toast } from "sonner";
import { beautifyError } from "@/lib/messages";
import { Loader2, Package, Pencil, Plus, Save, Search, Star, Tag, Trash2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/itens")({
  errorComponent: PageErrorBoundary,
  head: () => ({ meta: [{ title: "Gestão de Materiais | Ballas Gang" }] }),
  component: AdminItemsPage,
});

const SIDE_META: Record<string, { label: string; color: string }> = {
  venda: { label: "Venda", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  compra: { label: "Compra", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ambos: { label: "Compra & Venda", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

const TIER_LABELS: Record<string, string> = {
  young_blood: "Bairrista-1",
  o_gunao: "Bairrista-2",
  gangster_fodido: "Bairrista-3",
};
const TIER_ORDER = ["young_blood", "o_gunao", "gangster_fodido"] as const;

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

type AdminItem = any;
type SurchargeRow = { item_id: number; tier: string; surcharge: number };

function canBuy(item: Pick<AdminItem, "side">) {
  return item.side === "compra" || item.side === "ambos";
}
function canSell(item: Pick<AdminItem, "side">) {
  return item.side === "venda" || item.side === "ambos";
}
function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function tierFinalPrice(base: number, surcharge?: number) {
  return n(base) + Number(surcharge ?? 0);
}
function tierDelta(base: number, finalValue: number) {
  return Math.round(n(finalValue) - n(base));
}
function surchargeMapFor(rows: SurchargeRow[], itemId: number) {
  const map = new Map<string, number>();
  for (const row of rows) if (row.item_id === itemId) map.set(row.tier, Number(row.surcharge) || 0);
  return map;
}

function AdminItemsPage() {
  useRealtimeSync([
    { table: "items", queryKeys: [["dbItemsAdmin"], ["catalog"], ["buyCatalog"], ["recipes"]] },
    { table: "item_tier_surcharges", queryKeys: [["tierSurcharges"], ["catalog"]] },
    { table: "recipe_ingredients", queryKeys: [["dbItemsAdmin"], ["recipes"]] },
  ]);

  const qc = useQueryClient();
  const listFn = useAuthedServerFn(listDbItemsAdmin);
  const createFn = useAuthedServerFn(createItemAdmin);
  const updateFn = useAuthedServerFn(updateItemAdmin);
  const bulkDeleteFn = useAuthedServerFn(deleteItemsAdmin);
  const materialsFn = useAuthedServerFn(getMaterialItemsAdmin);
  const recipeFn = useAuthedServerFn(updateItemRecipeAdmin);
  const listSurchargesFn = useAuthedServerFn(listItemTierSurcharges);

  const items = useQuery({ queryKey: ["dbItemsAdmin"], queryFn: () => listFn() });
  const materials = useQuery({ queryKey: ["materialItemsAdmin"], queryFn: () => materialsFn() });
  const surcharges = useQuery({ queryKey: ["tierSurcharges"], queryFn: () => listSurchargesFn() });

  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [sideFilter, setSideFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AdminItem>({ name: "", category: "materiais", side: "compra", purchase_price: 0, morador_purchase_price: 0, min_sale_price: 0, estimated_value: 0, xp_points: 0 });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
    qc.invalidateQueries({ queryKey: ["tierSurcharges"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
    qc.invalidateQueries({ queryKey: ["buyCatalog"] });
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["recipes"] });
  };

  const createM = useMutation({
    mutationFn: (data: AdminItem) => createFn({ data }),
    onSuccess: () => {
      refresh();
      setShowAdd(false);
      setAddForm({ name: "", category: "materiais", side: "compra", purchase_price: 0, morador_purchase_price: 0, min_sale_price: 0, estimated_value: 0, xp_points: 0 });
      toast.success("Item criado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const updateM = useMutation({
    mutationFn: (data: AdminItem) => updateFn({ data }),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast.success("Item atualizado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const recipeM = useMutation({
    mutationFn: (data: AdminItem) => recipeFn({ data }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const deleteM = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteFn({ data: { item_ids: ids } }),
    onSuccess: () => {
      refresh();
      setSelected(new Set());
      toast.success("Item(ns) removidos");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const filtered = useMemo(() => {
    return (items.data ?? []).filter((item: AdminItem) => {
      const q = filter.trim().toLowerCase();
      return (!q || item.name.toLowerCase().includes(q)) && (!catFilter || item.category === catFilter) && (!sideFilter || item.side === sideFilter);
    });
  }, [items.data, filter, catFilter, sideFilter]);

  const categoriesInUse = useMemo(() => Array.from(new Set((items.data ?? []).map((i: AdminItem) => i.category).filter(Boolean))).sort(), [items.data]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <>
      <PageHeader eyebrow="Direção" title="Gestão de Materiais" description="Centro único para itens, preços, compra, venda e receitas" />

      <Reveal direction="up" delay={50}>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <FilterChip label="Total" value={(items.data ?? []).length} active={!catFilter} onClick={() => setCatFilter("")} />
          {categoriesInUse.map((category) => <FilterChip key={category} label={getCategoryLabel(category)} value={(items.data ?? []).filter((i: AdminItem) => i.category === category).length} active={catFilter === category} onClick={() => setCatFilter(catFilter === category ? "" : category)} />)}
          {selected.size > 0 && <FilterChip label="Selecionados" value={selected.size} active />}
        </div>
      </Reveal>

      <Reveal direction="up" delay={100}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Procurar item..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="">Todas as categorias</option>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
          </select>
          <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="">Todos os lados</option>
            <option value="compra">Compra</option>
            <option value="venda">Venda</option>
            <option value="ambos">Compra & Venda</option>
          </select>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}><Plus className="mr-1 h-4 w-4" />{showAdd ? "Cancelar" : "Novo item"}</Button>
          {selected.size > 0 && <Button size="sm" variant="destructive" onClick={() => confirm(`Remover ${selected.size} item(ns)?`) && deleteM.mutate(Array.from(selected))}><Trash2 className="mr-1 h-4 w-4" />Remover {selected.size}</Button>}
        </div>
      </Reveal>

      {showAdd && <NewItemCard form={addForm} setForm={setAddForm} onCreate={() => createM.mutate(addForm)} pending={createM.isPending} />}

      {items.isLoading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <ItemsGrid items={filtered} selected={selected} toggleSelect={toggleSelect} onEdit={setEditing} surcharges={surcharges.data ?? []} />
      )}

      {editing && <EditItemDialog item={editing} materials={materials.data ?? []} surchargeRows={surcharges.data ?? []} onClose={() => setEditing(null)} onSave={(data) => updateM.mutate(data)} onRecipe={(data) => recipeM.mutate(data)} pending={updateM.isPending || recipeM.isPending} />}
    </>
  );
}

function FilterChip({ label, value, active, onClick }: { label: string; value: number; active?: boolean; onClick?: () => void }) {
  return <Card className={cn("interactive-card shrink-0 cursor-pointer", active && "ring-1 ring-primary/40")} onClick={onClick}><CardContent className="flex items-center gap-2 px-3 py-2"><Package className="h-3.5 w-3.5 text-primary" /><div className="text-sm font-bold leading-none">{value}</div><div className="whitespace-nowrap text-[10px] text-muted-foreground">{label}</div></CardContent></Card>;
}

function NewItemCard({ form, setForm, onCreate, pending }: { form: AdminItem; setForm: (f: AdminItem) => void; onCreate: () => void; pending: boolean }) {
  return (
    <Reveal direction="up" delay={50}>
      <Card className="interactive-card mb-4 border-primary/30">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}</select>
          <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="compra">Compra</option><option value="venda">Venda</option><option value="ambos">Compra & Venda</option></select>
          {canBuy(form) && <><Input type="number" placeholder="Preço civil" value={form.purchase_price ?? ""} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} /><Input type="number" placeholder="Preço organização" value={form.morador_purchase_price ?? ""} onChange={(e) => setForm({ ...form, morador_purchase_price: Number(e.target.value) })} /></>}
          {canSell(form) && <><Input type="number" placeholder="Preço com material" value={form.min_sale_price ?? ""} onChange={(e) => setForm({ ...form, min_sale_price: Number(e.target.value) })} /><Input type="number" placeholder="Preço sem material" value={form.purchase_price ?? ""} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} /><Input type="number" placeholder="Custo" value={form.estimated_value ?? ""} onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) })} /></>}
          <Input type="number" placeholder="XP" value={form.xp_points ?? ""} onChange={(e) => setForm({ ...form, xp_points: Number(e.target.value) })} />
          <Button size="sm" onClick={onCreate} disabled={pending || !form.name}>{pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Criar</Button>
        </CardContent>
      </Card>
    </Reveal>
  );
}

function ItemsGrid({ items, selected, toggleSelect, onEdit, surcharges }: { items: AdminItem[]; selected: Set<number>; toggleSelect: (id: number) => void; onEdit: (item: AdminItem) => void; surcharges: SurchargeRow[] }) {
  if (!items.length) return <div className="py-12 text-center text-sm text-muted-foreground"><Package className="mx-auto mb-3 h-10 w-10 opacity-30" />Nenhum item encontrado</div>;
  const grouped = new Map<string, AdminItem[]>();
  for (const item of items) {
    const key = item.category ?? "outros";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return <div className="space-y-6">{Array.from(grouped.entries()).map(([category, list]) => <section key={category}><div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2"><div className="text-display text-sm font-semibold uppercase tracking-wider">{getCategoryLabel(category)}</div><div className="text-xs text-muted-foreground">{list.length} item{list.length !== 1 ? "s" : ""}</div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((item) => <ItemCard key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggleSelect(item.id)} onEdit={() => onEdit(item)} surcharges={surchargeMapFor(surcharges, item.id)} />)}</div></section>)}</div>;
}

function PriceBox({ label, value, tone = "" }: { label: string; value: number | null | undefined; tone?: string }) {
  if (!n(value)) return null;
  return <div className="rounded-md bg-muted/40 p-2"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={cn("font-mono text-sm font-medium", tone)}>{fmtPrice(n(value))}</div></div>;
}

function ItemCard({ item, selected, onToggle, onEdit, surcharges }: { item: AdminItem; selected: boolean; onToggle: () => void; onEdit: () => void; surcharges: Map<string, number> }) {
  const sideMeta = SIDE_META[item.side ?? "venda"] ?? SIDE_META.venda;
  const catClass = CATEGORY_COLORS[item.category ?? "outros"] ?? CATEGORY_COLORS.outros;
  const tierPrices = TIER_ORDER.map((tier) => ({ tier, label: TIER_LABELS[tier], price: tierFinalPrice(item.min_sale_price, surcharges.get(tier)) }));
  const showTiers = canSell(item) && tierPrices.some((tier) => tier.price !== n(item.min_sale_price));
  return (
    <Card className="interactive-card cursor-pointer overflow-hidden" onClick={onEdit}>
      <CardContent className="p-4">
        <div className="flex items-start gap-2.5">
          <input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); onToggle(); }} onClick={(e) => e.stopPropagation()} className="mt-1" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{item.name}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", catClass)}><Tag className="mr-1 h-2.5 w-2.5" />{getCategoryLabel(item.category)}</Badge>
              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", sideMeta.color)}>{sideMeta.label}</Badge>
              {item.xp_points > 0 && <Badge variant="outline" className="h-5 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-400"><Star className="mr-1 h-2.5 w-2.5" />{item.xp_points} XP</Badge>}
            </div>
          </div>
          <Pencil className="mt-1 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {canBuy(item) && <><PriceBox label="Preço civil" value={item.purchase_price} tone="text-blue-400" /><PriceBox label="Preço organização" value={item.morador_purchase_price} tone="text-blue-300" /></>}
          {canSell(item) && <><PriceBox label="Com material" value={item.min_sale_price} tone="text-emerald-400" /><PriceBox label="Sem material" value={item.purchase_price} /><PriceBox label="Custo" value={item.estimated_value} /></>}
          {showTiers && tierPrices.map((tier) => <PriceBox key={tier.tier} label={tier.label} value={tier.price} tone="text-emerald-400" />)}
        </div>
        {canSell(item) && <div className="mt-3 rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">{(item.ingredients ?? []).length > 0 ? `Receita: ${item.ingredients.length} material/is definido(s)` : "Sem receita — só aparece como dinheiro"}</div>}
      </CardContent>
    </Card>
  );
}

function EditItemDialog({ item, materials, surchargeRows, onClose, onSave, onRecipe, pending }: { item: AdminItem; materials: AdminItem[]; surchargeRows: SurchargeRow[]; onClose: () => void; onSave: (data: AdminItem) => void; onRecipe: (data: AdminItem) => void; pending: boolean }) {
  const upsertSurchargeFn = useAuthedServerFn(upsertItemTierSurcharge);
  const baseSurcharges = surchargeMapFor(surchargeRows, item.id);
  const [form, setForm] = useState<AdminItem>({ item_id: item.id, name: item.name, category: item.category ?? "outros", side: item.side ?? "venda", purchase_price: item.purchase_price ?? 0, morador_purchase_price: item.morador_purchase_price ?? 0, min_sale_price: item.min_sale_price ?? 0, estimated_value: item.estimated_value ?? 0, xp_points: item.xp_points ?? 0 });
  const [tierPrices, setTierPrices] = useState<Record<string, number>>(() => Object.fromEntries(TIER_ORDER.map((tier) => [tier, tierFinalPrice(item.min_sale_price, baseSurcharges.get(tier))])));
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ ingredient_item_id: number; quantity: number; name?: string }>>((item.ingredients ?? []).map((ing: any) => ({ ingredient_item_id: ing.ingredient_item_id, quantity: ing.quantity, name: ing.ingredient_name })));
  const [newMaterialId, setNewMaterialId] = useState("");
  const [newMaterialQty, setNewMaterialQty] = useState("1");

  const availableMaterials = materials.filter((material) => material.id !== item.id && !recipeIngredients.some((r) => r.ingredient_item_id === material.id));
  const showRecipeTab = canSell(form);

  function addMaterial() {
    const id = Number(newMaterialId);
    if (!id) return;
    const material = materials.find((m) => m.id === id);
    setRecipeIngredients((current) => [...current, { ingredient_item_id: id, quantity: Number(newMaterialQty) || 1, name: material?.name }]);
    setNewMaterialId("");
    setNewMaterialQty("1");
  }

  async function handleSave() {
    if (canSell(form)) {
      for (const tier of TIER_ORDER) {
        await upsertSurchargeFn({ data: { item_id: item.id, tier, surcharge: tierDelta(form.min_sale_price, tierPrices[tier]) } });
      }
    } else {
      for (const tier of TIER_ORDER) await upsertSurchargeFn({ data: { item_id: item.id, tier, surcharge: 0 } });
    }
    onSave(form);
    if (showRecipeTab && (recipeIngredients.length > 0 || (item.ingredients ?? []).length > 0)) {
      onRecipe({ item_id: item.id, ingredients: recipeIngredients.map((ing) => ({ ingredient_item_id: ing.ingredient_item_id, quantity: ing.quantity })) });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" />Editar {item.name}</DialogTitle></DialogHeader>
        <Tabs defaultValue="geral">
          <TabsList className="mb-3"><TabsTrigger value="geral">Geral</TabsTrigger><TabsTrigger value="precos">Preços</TabsTrigger>{showRecipeTab && <TabsTrigger value="receita">Receita ({recipeIngredients.length})</TabsTrigger>}</TabsList>

          <TabsContent value="geral" className="space-y-3">
            <div><label className="mb-1 block text-xs text-muted-foreground">Nome</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs text-muted-foreground">Categoria</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}</select></div><div><label className="mb-1 block text-xs text-muted-foreground">Tipo</label><select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="compra">Compra</option><option value="venda">Venda</option><option value="ambos">Compra & Venda</option></select></div></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">XP</label><Input type="number" value={form.xp_points} onChange={(e) => setForm({ ...form, xp_points: Number(e.target.value) })} /></div>
          </TabsContent>

          <TabsContent value="precos" className="space-y-4">
            {canBuy(form) && <section className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3"><div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-blue-300">Compra pela organização</div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs text-muted-foreground">Preço civil</label><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} /></div><div><label className="mb-1 block text-xs text-muted-foreground">Preço organização</label><Input type="number" value={form.morador_purchase_price} onChange={(e) => setForm({ ...form, morador_purchase_price: Number(e.target.value) })} /></div></div><p className="mt-2 text-[11px] text-muted-foreground">Entregas de stock feitas por bairristas entram a custo 0; estes valores servem para aquisições pagas.</p></section>}
            {canSell(form) && <section className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Venda pela organização</div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs text-muted-foreground">Preço com material</label><Input type="number" value={form.min_sale_price} onChange={(e) => { const next = Number(e.target.value); const old = n(form.min_sale_price); setForm({ ...form, min_sale_price: next }); setTierPrices((current) => Object.fromEntries(TIER_ORDER.map((tier) => [tier, current[tier] === old ? next : current[tier]]))); }} /></div><div><label className="mb-1 block text-xs text-muted-foreground">Preço sem material</label><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} /></div><div><label className="mb-1 block text-xs text-muted-foreground">Custo</label><Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) })} /></div></div><div className="mt-4 rounded-md border border-border bg-background/60 p-3"><div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preços finais por cargo</div><div className="grid grid-cols-3 gap-3">{TIER_ORDER.map((tier) => <div key={tier}><label className="mb-1 block text-[10px] text-muted-foreground">{TIER_LABELS[tier]}</label><Input type="number" value={tierPrices[tier] ?? 0} onChange={(e) => setTierPrices((current) => ({ ...current, [tier]: Number(e.target.value) }))} /></div>)}</div><p className="mt-2 text-[11px] text-muted-foreground">Aqui defines o valor final. O sistema guarda internamente a diferença para manter compatibilidade com o preçário.</p></div></section>}
          </TabsContent>

          {showRecipeTab && <TabsContent value="receita" className="space-y-3"><div className="rounded-md border border-border bg-muted/20 p-3"><div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Materiais necessários para comprar com materiais</div><div className="flex gap-2"><select value={newMaterialId} onChange={(e) => setNewMaterialId(e.target.value)} className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Selecionar material...</option>{availableMaterials.map((m) => <option key={m.id} value={m.id}>{m.name} ({getCategoryLabel(m.category)})</option>)}</select><Input type="number" min={1} value={newMaterialQty} onChange={(e) => setNewMaterialQty(e.target.value)} className="w-24" /><Button size="sm" onClick={addMaterial} disabled={!newMaterialId}><Plus className="h-4 w-4" /></Button></div></div>{recipeIngredients.length === 0 ? <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4 text-center text-sm text-muted-foreground">Sem receita definida. Este item não vai aparecer como compra com materiais.</div> : <div className="space-y-2">{recipeIngredients.map((ing) => { const material = materials.find((m) => m.id === ing.ingredient_item_id); return <div key={ing.ingredient_item_id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{material?.name ?? ing.name ?? `Material #${ing.ingredient_item_id}`}</div><div className="text-[11px] text-muted-foreground">{getCategoryLabel(material?.category)}</div></div><Input type="number" min={0} value={ing.quantity} onChange={(e) => setRecipeIngredients((current) => current.map((r) => r.ingredient_item_id === ing.ingredient_item_id ? { ...r, quantity: Number(e.target.value) } : r))} className="h-8 w-20 text-right" /><button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" onClick={() => setRecipeIngredients((current) => current.filter((r) => r.ingredient_item_id !== ing.ingredient_item_id))}><Trash2 className="h-3.5 w-3.5" /></button></div>; })}</div>}</TabsContent>}
        </Tabs>
        <DialogFooter className="mt-4"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={handleSave} disabled={pending}>{pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
