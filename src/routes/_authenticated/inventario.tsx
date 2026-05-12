import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStock, getLedger } from "@/lib/inventory.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { fmtNum, fmtDate } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair, Package, History } from "lucide-react";
import { CategoryIcon, ItemIcon } from "@/components/domain/ItemIcon";

export const Route = createFileRoute("/_authenticated/inventario")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: Page,
});

type CatMeta = { label: string; tone: string; order: number };

// O bairro só guarda o que vende ou material p/ craftar o que vende.
const GROUPS: Record<string, CatMeta> = {
  armas_red:        { label: "Armas Red",          tone: "destructive", order: 1 },
  armas_orange:     { label: "Armas Orange",       tone: "warning",     order: 2 },
  carregadores:     { label: "Carregadores",       tone: "primary",     order: 3 },
  acessorios_armas: { label: "Acessórios de armas",tone: "info",        order: 4 },
  coletes:          { label: "Coletes",            tone: "warning",     order: 5 },
  drogas:           { label: "Drogas",             tone: "success",     order: 6 },
  craft_armas:      { label: "Craft de armas (corpos, peças, prints, ferro)", tone: "primary", order: 7 },
  craft_carregadores: { label: "Craft de carregadores (cobre, pólvora)",      tone: "muted",   order: 8 },
};

// Listas explícitas — baseadas nos itens reais da BD.
const ORANGE_GUN_NAMES = new Set([
  "drako", "sns pistol", "sns pistol mk2", "pistol xm3", "compact rifle",
  "ap pistol", "tec pistol", "tec-9", "pistol", "pistola", "pistol mk2",
  "ceramic pistol", "vintage pistol", "vintage estragada", "sns estragada",
  "machine pistol", "micro smg", "mini smg", "revolver", "gadget pistol",
  "pistola gadget", "pistola tec", "pistola xm3",
]);

// Devolve a chave do grupo, ou null se o item não interessa ao armazém.
function classifyRow(r: { category: string | null; item_name: string }): string | null {
  const c = (r.category ?? "").toLowerCase();
  const nRaw = (r.item_name ?? "").trim();
  const n = nRaw.toLowerCase();

  // Armas brancas / melee — fora do armazém
  if (c === "armas_brancas") return null;
  if (/\b(faca|adaga|canivete|machete|machado|martelo|cacetete|bast[aã]o|barra|p[eé] de cabra|crowbar|lanterna(?!\s*\d)|garrafa|chave de (cano|tubo)|punhal|soco|soqueira|taco|clube|battle axe|arma de choque)\b/.test(n)) {
    return null;
  }

  // Drogas (categoria "droga" no DB)
  if (c === "droga") return "drogas";

  // Coletes — só padrão, leve, pesado, tático (categoria equipamento)
  if (c === "equipamento" && /colete/.test(n)) return "coletes";

  // Carregadores — categoria "municoes"
  if (c === "municoes") {
    // "Silenciador 1" foi mal-classificado em municoes — vai para acessórios
    if (/silenciador|supressor|mira|red\s*dot|holo|grip|punho|lanterna\s*\d/.test(n)) {
      return "acessorios_armas";
    }
    return "carregadores";
  }

  // Acessórios — silenciador, mira, mag expandido, grip, lanterna numerada, etc.
  if (c === "acessorios") return "acessorios_armas";

  // Craft de armas — componentes que servem para fabricar armas
  if (c === "componentes") {
    if (/\bcobre\b|\bp[oó]lvora\b/.test(n)) return "craft_carregadores";
    if (/corpo|pe[çc]a|print|molde|ferro|kevlar|nylon|borracha|couro|saco|tecido|papel|embalagem|latex/.test(n)) {
      return "craft_armas";
    }
    return null;
  }

  // Armas — categoria "armas_fogo" (e algumas em "armas")
  if (c === "armas_fogo" || c === "armas") {
    if (ORANGE_GUN_NAMES.has(n)) return "armas_orange";
    // Tudo o resto que seja arma de fogo é Red (rifles, snipers, shotguns, heavy, etc.)
    if (/rifle|ak\b|sniper|shotgun|espingarda|cano serrado|heavy|combat|tactical|bullpup|carabina|gusenberg|military|musket|p90|pdw|smg|marksman|\.50|deagle|desert|double-action|revolver dourado/.test(n)) {
      return "armas_red";
    }
    // Pistolas curtas/básicas que não estejam na orange list — também Orange
    if (/pistol|pistola/.test(n)) return "armas_orange";
    return "armas_red";
  }

  return null;
}

const TONE_BG: Record<string, string> = {
  warning: "bg-warning/15 border-warning/40 text-warning",
  destructive: "bg-destructive/15 border-destructive/40 text-destructive",
  info: "bg-info/15 border-info/40 text-info",
  primary: "bg-primary/15 border-primary/40 text-primary",
  success: "bg-success/15 border-success/40 text-success",
  muted: "bg-muted/40 border-border text-muted-foreground",
};

const MOV_LABEL: Record<string, string> = {
  saldo_inicial: "Saldo inicial",
  entrega_bairrista: "Entrega",
  venda_bairrista: "Venda",
  entrega_oficial: "Entrega oficial",
  fornecimento_org: "Fornecimento",
  consumo_saida: "Saída",
  devolucao_saida: "Devolução",
  ajuste_manual: "Ajuste",
  perda_saida: "Perdido",
  apreendido: "Apreendido",
  craftado: "Crafte",
};

function Page() {
  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  if (me.isLoading) {
    return <p className="text-muted-foreground">A abrir o armazém…</p>;
  }
  if (!me.data?.can_see_inventory) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
          <Crosshair className="h-5 w-5 text-destructive" />
        </div>
        <h2 className="text-display text-lg">Sem chave para esta porta.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O armazém é assunto da chefia e do Patrão di Zona.
        </p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Armazém"
        title="Inventário"
        description="Armas e carregadores que a firma tem em casa. Movimentos automáticos via entregas e encomendas."
        icon={Package}
      />
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">
            <Package className="mr-1.5 h-3.5 w-3.5" /> Stock
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <History className="mr-1.5 h-3.5 w-3.5" /> Movimentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <StockTable />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTable />
        </TabsContent>
      </Tabs>
    </>
  );
}

function StockTable() {
  const fn = useServerFn(getStock);
  const q = useQuery({ queryKey: ["stock"], queryFn: () => fn() });
  const rows = q.data ?? [];

  // group by visual category, dropping items that don't belong in the warehouse
  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const k = classifyRow(r);
    if (!k) return acc;
    (acc[k] ||= []).push(r);
    return acc;
  }, {});
  const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0);

  if (q.isLoading) return <p className="text-muted-foreground">A contar…</p>;
  if (!total)
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Armazém vazio. Mete-te a trabalhar.
      </Card>
    );

  const ordered = Object.entries(groups).sort(
    (a, b) => (GROUPS[a[0]]?.order ?? 50) - (GROUPS[b[0]]?.order ?? 50)
  );

  return (
    <div className="space-y-6">
      {ordered.map(([cat, items]) => {
        const meta = GROUPS[cat] ?? { label: cat, tone: "muted", order: 99 };
        const total = items.reduce((s, r) => s + (r.qty ?? 0), 0);
        const value = items.reduce((s, r) => s + (r.qty ?? 0) * (r.unit_price ?? 0), 0);
        return (
          <section key={cat} className="overflow-hidden rounded-sm border border-border bg-card">
            <header
              className={
                "flex items-center justify-between gap-3 border-b px-4 py-2.5 " +
                TONE_BG[meta.tone]
              }
            >
              <div className="flex items-center gap-2">
                <CategoryIcon category={cat} tone={meta.tone} size={18} />
                <h2 className="text-display text-sm uppercase tracking-widest">
                  {meta.label}
                </h2>
              </div>
              <span className="text-display text-[11px] tracking-wider opacity-90">
                {items.length} refs · {fmtNum(total)} em casa · {fmtNum(Math.round(value))} €
              </span>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-display text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Em casa</th>
                  <th className="px-3 py-2 text-right">Preço unid.</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .slice()
                  .sort((a, b) => (b.unit_price ?? 0) - (a.unit_price ?? 0) || (b.qty ?? 0) - (a.qty ?? 0))
                  .map((r) => {
                    const low = r.qty <= 0;
                    const warn = r.qty > 0 && r.qty < 5;
                    return (
                      <tr key={r.item_id} className="border-t border-border hover:bg-accent/30">
                        <td className="px-3 py-2 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <ItemIcon name={r.item_name} category={r.category} size={14} />
                            {r.item_name}
                          </span>
                        </td>
                        <td
                          className={
                            "px-3 py-2 text-right font-mono " +
                            (low ? "text-destructive" : warn ? "text-warning" : "")
                          }
                        >
                          {fmtNum(r.qty)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {r.unit_price != null ? fmtNum(r.unit_price) : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function LedgerTable() {
  const fn = useServerFn(getLedger);
  const q = useQuery({ queryKey: ["ledger"], queryFn: () => fn({ data: { limit: 150 } }) });
  return (
    <div className="overflow-hidden rounded-sm border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-display text-xs">
          <tr>
            <th className="px-3 py-2 text-left">Quando</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-left">Quem</th>
            <th className="px-3 py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {q.isLoading && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted-foreground">
                A puxar histórico…
              </td>
            </tr>
          )}
          {(q.data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {fmtDate(r.created_at)}
              </td>
              <td className="px-3 py-2">{MOV_LABEL[r.type] ?? r.type}</td>
              <td className="px-3 py-2 font-medium">
                {r.item_name ? (
                  <span className="inline-flex items-center gap-2">
                    <ItemIcon name={r.item_name} size={14} />
                    {r.item_name}
                  </span>
                ) : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.member_name ?? "—"}</td>
              <td
                className={
                  "px-3 py-2 text-right font-mono " +
                  (r.qty < 0 ? "text-destructive" : "text-success")
                }
              >
                {r.qty > 0 ? "+" : ""}
                {fmtNum(r.qty)}
              </td>
            </tr>
          ))}
          {!q.isLoading && !q.data?.length && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted-foreground">
                Sem movimentos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
