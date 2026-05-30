import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import {
  listDbItemsAdmin,
  updateItemAdmin,
  createItemAdmin,
  deleteItemAdmin,
  deleteItemsAdmin,
} from "@/lib/recipes.admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPrice } from "@/lib/domain";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Save, Loader2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/_authenticated/admin/itens")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Gestão de Items | Ballas Gang" }],
  }),
  component: AdminItemsPage,
});

const CATEGORIES = [
  "armas_orange",
  "armas_red",
  "municoes",
  "acessorios",
  "outros",
  "materiais",
  "corpos",
  "coletes",
  "prints",
  "reciclagem",
  "madeiras",
  "metais",
  "texteis",
  "componentes",
  "droga",
  "equipamento",
  "dinheiro",
];

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

  const items = useQuery({ queryKey: ["dbItemsAdmin"], queryFn: () => listFn() });
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [orphanFilter, setOrphanFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
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
      setEditingId(null);
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dbItemsAdmin"] });
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
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

  const filtered = (items.data ?? []).filter((it: any) => {
    const matchesName = it.name.toLowerCase().includes(filter.toLowerCase());
    const matchesCat = !catFilter || it.category === catFilter;
    const matchesOrphan = orphanFilter === "" ? true :
      orphanFilter === "orphan" ? !it.in_config : it.in_config;
    return matchesName && matchesCat && matchesOrphan;
  });

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

  function startEdit(it: any) {
    setEditingId(it.id);
    setEditForm({
      name: it.name,
      category: it.category ?? "",
      subcategory: it.subcategory ?? "",
      side: it.side ?? "venda",
      purchase_price: it.purchase_price ?? 0,
      min_sale_price: it.min_sale_price ?? 0,
      estimated_value: it.estimated_value ?? 0,
      xp_points: it.xp_points ?? 0,
      active: it.active,
      orderable: it.orderable ?? true,
      counts_for_stock: it.counts_for_stock ?? true,
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Direção"
        title="Gestão de Items"
        description="Adicionar, editar e remover items da firma"
      />

      <Reveal direction="up" delay={100}>
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="Filtrar por nome..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64"
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={orphanFilter}
            onChange={(e) => setOrphanFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Todos</option>
            <option value="config">No config.json</option>
            <option value="orphan">Órfãos (não no config)</option>
          </select>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            {showAdd ? "Cancelar" : "Novo item"}
          </Button>
        </div>
      </Reveal>

      <div className="text-xs text-muted-foreground mb-2 flex justify-between items-center">
        <span>Total: {(items.data ?? []).length} | Filtrados: {filtered.length} | Seleccionados: {selected.size}</span>
        {selected.size > 0 && (
          <Button size="sm" variant="destructive" onClick={() => {
            if (confirm(`Remover ${selected.size} items?`)) bulkDeleteM.mutate(Array.from(selected));
          }}>
            <Trash2 className="mr-1 h-4 w-4" /> Remover {selected.size}
          </Button>
        )}
      </div>

      {showAdd && (
        <Reveal direction="up" delay={50}>
          <Card className="mb-4 interactive-card">
            <CardHeader>
              <CardTitle className="text-display text-sm">Novo Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input placeholder="Nome" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
                <select value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={addForm.side} onChange={(e) => setAddForm({ ...addForm, side: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="venda">venda</option>
                  <option value="compra">compra</option>
                  <option value="ambos">ambos</option>
                </select>
                <Input type="number" placeholder="Preço sem material" value={addForm.purchase_price ?? ""} onChange={(e) => setAddForm({ ...addForm, purchase_price: Number(e.target.value) })} />
                <Input type="number" placeholder="Preço com material" value={addForm.min_sale_price ?? ""} onChange={(e) => setAddForm({ ...addForm, min_sale_price: Number(e.target.value) })} />
                <Input type="number" placeholder="XP" value={addForm.xp_points ?? ""} onChange={(e) => setAddForm({ ...addForm, xp_points: Number(e.target.value) })} />
                <Button size="sm" onClick={() => createM.mutate(addForm)} disabled={createM.isPending}>
                  <Save className="mr-1 h-4 w-4" /> Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      )}

      <Reveal direction="up" delay={150}>
        <Card className="interactive-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-display text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-2 py-2 text-center w-8">
                      <input type="checkbox" onChange={selectAll} checked={filtered.length > 0 && filtered.every((it: any) => selected.has(it.id))} />
                    </th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Categoria</th>
                    <th className="px-3 py-2 text-right">Sem mat.</th>
                    <th className="px-3 py-2 text-right">Com mat.</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2 text-center">XP</th>
                    <th className="px-3 py-2 text-center">Side</th>
                    <th className="px-3 py-2 text-center">Ativo</th>
                    <th className="px-3 py-2 text-center">Config</th>
                    <th className="px-3 py-2 text-center w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && !items.isLoading && (
                    <tr><td colSpan={11} className="px-3 py-4 text-center text-muted-foreground">Nenhum item encontrado</td></tr>
                  )}
                  {filtered.map((it: any) => (
                    <tr key={it.id} className={`border-t border-border interactive-row ${!it.in_config ? "opacity-60" : ""}`}>
                      {editingId === it.id ? (
                        <>
                          <td className="px-2 py-2 text-center"><input type="checkbox" disabled /></td>
                          <td className="px-3 py-2"><Input className="h-7 text-xs" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                          <td className="px-3 py-2">
                            <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="h-7 rounded border border-input bg-background px-1 text-xs text-foreground">
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2"><Input type="number" className="h-7 text-xs text-right" value={editForm.purchase_price} onChange={(e) => setEditForm({ ...editForm, purchase_price: Number(e.target.value) })} /></td>
                          <td className="px-3 py-2"><Input type="number" className="h-7 text-xs text-right" value={editForm.min_sale_price} onChange={(e) => setEditForm({ ...editForm, min_sale_price: Number(e.target.value) })} /></td>
                          <td className="px-3 py-2"><Input type="number" className="h-7 text-xs text-right" value={editForm.estimated_value} onChange={(e) => setEditForm({ ...editForm, estimated_value: Number(e.target.value) })} /></td>
                          <td className="px-3 py-2"><Input type="number" className="h-7 text-xs text-center" value={editForm.xp_points} onChange={(e) => setEditForm({ ...editForm, xp_points: Number(e.target.value) })} /></td>
                          <td className="px-3 py-2">
                            <select value={editForm.side} onChange={(e) => setEditForm({ ...editForm, side: e.target.value })} className="h-7 rounded border border-input bg-background px-1 text-xs text-foreground w-full">
                              <option value="venda">venda</option>
                              <option value="compra">compra</option>
                              <option value="ambos">ambos</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
                          </td>
                          <td className="px-3 py-2 text-center">{it.in_config ? "✓" : "✗"}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex justify-center gap-1">
                              <button className="text-emerald-400" disabled={updateM.isPending} onClick={() => updateM.mutate({ item_id: it.id, ...editForm })}>
                                {updateM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button className="text-muted-foreground" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)} />
                          </td>
                          <td className="px-3 py-2 font-medium">{it.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{it.category}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtPrice(it.purchase_price)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtPrice(it.min_sale_price)}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtPrice(it.estimated_value)}</td>
                          <td className="px-3 py-2 text-center">{it.xp_points}</td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">{it.side}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${it.active ? "bg-emerald-400" : "bg-red-400"}`} />
                          </td>
                          <td className="px-3 py-2 text-center text-xs">{it.in_config ? "✓" : <span className="text-red-400">✗</span>}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex justify-center gap-1">
                              <button className="text-muted-foreground hover:text-foreground" onClick={() => startEdit(it)}><Pencil className="h-3.5 w-3.5" /></button>
                              <button className="text-muted-foreground hover:text-destructive" onClick={() => deleteM.mutate(it.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}
