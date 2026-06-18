import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne, pgQuery } from "./pg.server";
import { resolveActualMember, resolveCurrentMember } from "./pricing.server";

export type DataQualitySeverity = "critical" | "high" | "medium" | "low";
export type DataQualityArea = "membros" | "encomendas" | "entregas" | "saidas" | "inventario" | "precos" | "receitas" | "premios" | "notificacoes" | "sistema";

export type DataQualityCheck = {
  id: string;
  area: DataQualityArea;
  severity: DataQualitySeverity;
  title: string;
  count: number;
  ok: boolean;
  summary: string;
  examples: string[];
  recommendation: string;
  repair_action?: "repair_delivery_lines";
};

export type DataQualityReport = {
  generated_at: string;
  summary: { total_checks: number; total_issues: number; critical: number; high: number; medium: number; low: number };
  checks: DataQualityCheck[];
};

type CountRow = { count: number };
type ExampleRow = { label: string | null };
type RawLine = Record<string, unknown>;
type RepairResult = { ok: true; scanned: number; repaired: number; rejected: number; dropped_lines: number; assigned_responsibles: number };

const ACTIVE_MEMBER = `coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')`;
const ACTIVE_ITEM = `coalesce(active, true) = true and deleted_at is null`;
const SALE_PRICE = `coalesce(nullif(min_sale_price, 0), nullif(purchase_price, 0), 0)`;
const BUY_PRICE = `coalesce(nullif(purchase_price, 0), nullif(morador_purchase_price, 0), nullif(min_sale_price, 0), 0)`;
const normSql = (field: string) => `translate(lower(coalesce(${field}, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;

async function check(args: Omit<DataQualityCheck, "ok" | "count" | "examples"> & { countSql: string; examplesSql: string; summary: (count: number) => string }): Promise<DataQualityCheck> {
  try {
    const row = await pgOne<CountRow>(args.countSql);
    const count = Number(row?.count ?? 0);
    const examples = count > 0 ? await pgQuery<ExampleRow>(args.examplesSql) : [];
    return { ...args, count, ok: count === 0, summary: args.summary(count), examples: examples.map((e) => String(e.label ?? "—")) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: args.id, area: args.area, severity: "critical", title: `${args.title} — falhou`, count: 1, ok: false, summary: msg, examples: [msg], recommendation: "Corrigir schema/migration desta área antes de confiar na auditoria." };
  }
}

function summary(checks: DataQualityCheck[]): DataQualityReport["summary"] {
  const failing = checks.filter((c) => !c.ok);
  return {
    total_checks: checks.length,
    total_issues: failing.reduce((s, c) => s + c.count, 0),
    critical: failing.filter((c) => c.severity === "critical").length,
    high: failing.filter((c) => c.severity === "high").length,
    medium: failing.filter((c) => c.severity === "medium").length,
    low: failing.filter((c) => c.severity === "low").length,
  };
}

function normalizeText(value: unknown): string { return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function positive(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }
function money(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }
function isObject(value: unknown): value is RawLine { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }

async function assertChefia(context: any) { const me = await resolveCurrentMember(context.supabase, context.userId); if (!me?.is_manager) throw new Error("Acesso restrito à chefia."); }
async function assertSuperadmin(context: any) { const me = await resolveActualMember(context.supabase, context.userId); if (!me?.is_superadmin) throw new Error("Acesso restrito ao Superadmin."); }

export const repairDeliveryLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RepairResult> => {
    await assertSuperadmin(context);
    const requests = await pgQuery<{ id: string; tipo: string | null; lines: unknown }>(`select id, tipo, lines from inventory_delivery_requests where status = 'pending' and lines is not null`);
    const items = await pgQuery<{ id: number; name: string; purchase_price: number | null; morador_purchase_price: number | null; min_sale_price: number | null }>(`select id, name, purchase_price::float as purchase_price, morador_purchase_price::float as morador_purchase_price, min_sale_price::float as min_sale_price from items where ${ACTIVE_ITEM}`);
    const byId = new Map(items.map((item) => [item.id, item]));
    const byName = new Map(items.map((item) => [normalizeText(item.name), item]));
    let repaired = 0;
    let rejected = 0;
    let dropped_lines = 0;

    for (const request of requests) {
      const lines = Array.isArray(request.lines) ? request.lines.filter(isObject) : [];
      if (!lines.length) continue;
      const tipo = request.tipo === "venda" ? "venda" : "entrega";
      const normalized: Array<{ item_id: number; item_name: string; qty: number; unit_value: number }> = [];
      for (const raw of lines) {
        const itemId = positive(raw.item_id ?? raw.itemId);
        const itemName = raw.item_name ?? raw.itemName;
        const item = (itemId ? byId.get(itemId) : undefined) ?? (itemName ? byName.get(normalizeText(itemName)) : undefined);
        const qty = positive(raw.qty ?? raw.quantity ?? raw.amount);
        if (!item || !qty) { dropped_lines += 1; continue; }
        const explicitUnit = money(raw.unit_value ?? raw.unitValue ?? raw.unitPrice ?? raw.effectivePrice ?? raw.basePrice);
        const lineValue = money(raw.lineValue);
        const unit = tipo === "entrega" ? 0 : (explicitUnit ?? (lineValue != null ? lineValue / qty : null) ?? item.morador_purchase_price ?? item.purchase_price ?? item.min_sale_price ?? 0);
        normalized.push({ item_id: item.id, item_name: item.name, qty, unit_value: unit });
      }
      if (!normalized.length) {
        await pgQuery(`update inventory_delivery_requests set status='rejected', decision_reason='Reparação automática: pedido sem linhas válidas', decided_at=now(), updated_at=now(), lines='[]'::jsonb, total_qty=0, total_value=0 where id=$1 and status='pending'`, [request.id]);
        rejected += 1;
        continue;
      }
      const totalQty = normalized.reduce((s, line) => s + line.qty, 0);
      const totalValue = tipo === "entrega" ? 0 : normalized.reduce((s, line) => s + line.qty * line.unit_value, 0);
      await pgQuery(`update inventory_delivery_requests set lines=$2::jsonb, total_qty=$3, total_value=$4, updated_at=now() where id=$1 and status='pending'`, [request.id, JSON.stringify(normalized), totalQty, totalValue]);
      repaired += 1;
    }

    const assigned = await pgOne<{ count: number }>(
      `with fixed as (
         update inventory_delivery_requests r
         set responsavel_member_id = r.requester_member_id, updated_at = now()
         from members m
         where r.status = 'pending'
           and r.responsavel_member_id is null
           and r.requester_member_id = m.id
           and m.deleted_at is null
         returning r.id
       ) select count(*)::int as count from fixed`,
    );

    return { ok: true, scanned: requests.length, repaired, rejected, dropped_lines, assigned_responsibles: assigned?.count ?? 0 };
  });

const deliveryLineSql = `
  with raw as (
    select r.id, r.created_at, line
    from inventory_delivery_requests r
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.lines) = 'array' then r.lines else '[]'::jsonb end) line
    where r.status = 'pending'
  ), parsed as (
    select *, coalesce(line->>'item_id', line->>'itemId') as raw_item_id, coalesce(line->>'qty', line->>'quantity', line->>'amount') as raw_qty, coalesce(line->>'item_name', line->>'itemName') as raw_item_name
    from raw
  ), resolved as (
    select p.*, coalesce(by_id.id, by_name.id) as resolved_item_id
    from parsed p
    left join items by_id on p.raw_item_id ~ '^\\d+$' and by_id.id = p.raw_item_id::int and coalesce(by_id.active,true)=true and by_id.deleted_at is null
    left join items by_name on by_id.id is null and ${normSql("by_name.name")} = ${normSql("p.raw_item_name")} and coalesce(by_name.active,true)=true and by_name.deleted_at is null
  )`;

export const getDataQualityReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DataQualityReport> => {
    await assertChefia(context);
    const checks: DataQualityCheck[] = [];

    checks.push(await check({ id: "members_duplicate_discord", area: "membros", severity: "critical", title: "Membros ativos com Discord duplicado", countSql: `select count(*)::int as count from (select discord_id from members where deleted_at is null and discord_id is not null and trim(discord_id) <> '' and ${ACTIVE_MEMBER} group by discord_id having count(*) > 1) x`, examplesSql: `select ('Discord ' || discord_id || ' · ' || string_agg('#' || id::text || ' ' || coalesce(display_name, username, '?'), ', ' order by id)) as label from members where deleted_at is null and discord_id is not null and trim(discord_id) <> '' and ${ACTIVE_MEMBER} group by discord_id having count(*) > 1 limit 10`, summary: (n) => n ? `${n} Discord ID(s) duplicados em membros ativos.` : "Sem Discord IDs duplicados em membros ativos.", recommendation: "Fundir/remover duplicados para não atribuir stats, prémios e permissões ao membro errado." }));
    checks.push(await check({ id: "members_missing_identity", area: "membros", severity: "high", title: "Membros ativos sem nome ou Discord", countSql: `select count(*)::int as count from members where deleted_at is null and ${ACTIVE_MEMBER} and (nullif(trim(coalesce(display_name, '')), '') is null or nullif(trim(coalesce(discord_id, '')), '') is null)`, examplesSql: `select ('#' || id::text || ' · ' || coalesce(display_name, username, 'sem nome') || ' · discord=' || coalesce(discord_id, '—')) as label from members where deleted_at is null and ${ACTIVE_MEMBER} and (nullif(trim(coalesce(display_name, '')), '') is null or nullif(trim(coalesce(discord_id, '')), '') is null) order by id desc limit 10`, summary: (n) => n ? `${n} membro(s) ativo(s) sem nome ou Discord.` : "Todos os membros ativos têm identidade mínima.", recommendation: "Completar display_name/discord_id via sync Discord ou admin." }));
    checks.push(await check({ id: "profiles_without_active_member", area: "membros", severity: "high", title: "Logins Discord sem membro ativo", countSql: `select count(*)::int as count from profiles p where p.discord_id is not null and not exists (select 1 from members m where m.discord_id = p.discord_id and m.deleted_at is null and ${ACTIVE_MEMBER})`, examplesSql: `select (coalesce(p.display_name, p.user_id::text) || ' · discord=' || coalesce(p.discord_id, '—')) as label from profiles p where p.discord_id is not null and not exists (select 1 from members m where m.discord_id = p.discord_id and m.deleted_at is null and ${ACTIVE_MEMBER}) order by p.created_at desc limit 10`, summary: (n) => n ? `${n} login(s) Discord sem membro ativo associado.` : "Todos os logins Discord têm membro ativo associado.", recommendation: "Confirmar se a pessoa está no Discord com tag operacional e se members.discord_id bate com profiles.discord_id. Caso contrário, sincronizar membros no bot ou corrigir o Discord ID no membro." }));
    checks.push(await check({ id: "orders_active_without_responsavel", area: "encomendas", severity: "high", title: "Encomendas abertas sem responsável válido", countSql: `select count(*)::int as count from orders o left join members r on r.id = o.responsavel_member_id and r.deleted_at is null where o.status in ('pending','approved','in_progress','ready') and (o.responsavel_member_id is null or r.id is null)`, examplesSql: `select ('#' || o.id::text || ' · status=' || coalesce(o.status, '—') || ' · resp=' || coalesce(o.responsavel_member_id::text, '—')) as label from orders o left join members r on r.id = o.responsavel_member_id and r.deleted_at is null where o.status in ('pending','approved','in_progress','ready') and (o.responsavel_member_id is null or r.id is null) order by o.created_at desc limit 10`, summary: (n) => n ? `${n} encomenda(s) abertas sem responsável válido.` : "Todas as encomendas abertas têm responsável válido.", recommendation: "Atribuir responsável para garantir que só a pessoa certa trata o pedido." }));
    checks.push(await check({ id: "orders_total_mismatch", area: "encomendas", severity: "medium", title: "Encomendas com total diferente de preço × quantidade", countSql: `select count(*)::int as count from orders where unit_price is not null and total_price is not null and quantity is not null and abs(coalesce(total_price,0) - coalesce(unit_price,0) * coalesce(quantity,0)) > 1`, examplesSql: `select ('#' || id::text || ' · total=' || total_price::text || ' · esperado=' || (unit_price * quantity)::text) as label from orders where unit_price is not null and total_price is not null and quantity is not null and abs(coalesce(total_price,0) - coalesce(unit_price,0) * coalesce(quantity,0)) > 1 order by created_at desc limit 10`, summary: (n) => n ? `${n} encomenda(s) têm total incoerente.` : "Totais das encomendas estão coerentes.", recommendation: "Recalcular total_price ou documentar ajuste/desconto." }));
    checks.push(await check({ id: "deliveries_broken_lines", area: "entregas", severity: "critical", title: "Entregas pendentes com linhas inválidas ou itens inexistentes", countSql: `${deliveryLineSql} select count(*)::int as count from resolved where not (raw_qty ~ '^\\d+(\\.\\d+)?$') or raw_qty::numeric <= 0 or resolved_item_id is null`, examplesSql: `${deliveryLineSql} select ('#' || id::text || ' · linha=' || line::text) as label from resolved where not (raw_qty ~ '^\\d+(\\.\\d+)?$') or raw_qty::numeric <= 0 or resolved_item_id is null order by created_at desc limit 10`, summary: (n) => n ? `${n} linha(s) pendente(s) inválida(s).` : "Entregas pendentes têm linhas válidas.", recommendation: "Usar Reparar para normalizar linhas legacy e rejeitar pedidos sem linhas válidas.", repair_action: "repair_delivery_lines" }));
    checks.push(await check({ id: "deliveries_orphan_requester", area: "entregas", severity: "high", title: "Entregas pendentes com requerente/responsável inexistente", countSql: `select count(*)::int as count from inventory_delivery_requests r left join members requester on requester.id = r.requester_member_id left join members resp on resp.id = r.responsavel_member_id where r.status = 'pending' and (requester.id is null or r.responsavel_member_id is null or resp.id is null)`, examplesSql: `select ('#' || r.id::text || ' · requester=' || coalesce(r.requester_member_id::text, '—') || ' · resp=' || coalesce(r.responsavel_member_id::text, '—')) as label from inventory_delivery_requests r left join members requester on requester.id = r.requester_member_id left join members resp on resp.id = r.responsavel_member_id where r.status = 'pending' and (requester.id is null or r.responsavel_member_id is null or resp.id is null) order by r.created_at desc limit 10`, summary: (n) => n ? `${n} entrega(s) pendente(s) com membro/responsável inválido.` : "Entregas pendentes têm membros associados válidos.", recommendation: "Usar Reparar para atribuir responsável aos pedidos legacy e rejeitar linhas inválidas.", repair_action: "repair_delivery_lines" }));
    checks.push(await check({ id: "items_invalid_price_or_side", area: "precos", severity: "high", title: "Itens ativos com side/preços inválidos", countSql: `select count(*)::int as count from items where ${ACTIVE_ITEM} and (coalesce(side, '') not in ('venda','compra','ambos') or (side in ('venda','ambos') and ${SALE_PRICE} <= 0) or (side in ('compra','ambos') and ${BUY_PRICE} <= 0))`, examplesSql: `select ('#' || id::text || ' · ' || name || ' · side=' || coalesce(side, '—') || ' · civil=' || coalesce(purchase_price::text, '—') || ' · org=' || coalesce(morador_purchase_price::text, '—') || ' · definido=' || coalesce(min_sale_price::text, '—')) as label from items where ${ACTIVE_ITEM} and (coalesce(side, '') not in ('venda','compra','ambos') or (side in ('venda','ambos') and ${SALE_PRICE} <= 0) or (side in ('compra','ambos') and ${BUY_PRICE} <= 0)) order by category, name limit 10`, summary: (n) => n ? `${n} item(ns) ativo(s) com side ou preço inválido.` : "Itens ativos têm side/preços mínimos coerentes.", recommendation: "Para venda basta preço com material OU sem material; para compra basta preço civil OU organização/definido." }));
    checks.push(await check({ id: "db_recipes_broken_refs", area: "receitas", severity: "critical", title: "Receitas na DB com referências partidas", countSql: `select count(*)::int as count from recipe_ingredients ri left join craft_recipes cr on cr.id = ri.recipe_id left join items ingredient on ingredient.id = ri.ingredient_item_id left join items output on output.id = cr.item_id where cr.id is null or ingredient.id is null or output.id is null or coalesce(ri.quantity,0) <= 0`, examplesSql: `select ('recipe=' || coalesce(ri.recipe_id::text, '—') || ' · ingrediente=' || coalesce(ri.ingredient_item_id::text, '—') || ' · qty=' || coalesce(ri.quantity::text, '—')) as label from recipe_ingredients ri left join craft_recipes cr on cr.id = ri.recipe_id left join items ingredient on ingredient.id = ri.ingredient_item_id left join items output on output.id = cr.item_id where cr.id is null or ingredient.id is null or output.id is null or coalesce(ri.quantity,0) <= 0 limit 10`, summary: (n) => n ? `${n} ingrediente(s)/receita(s) inválidos na DB.` : "Receitas na DB têm referências válidas.", recommendation: "Corrigir receitas no Admin → Materiais." }));
    checks.push(await check({ id: "inventory_orphan_or_negative", area: "inventario", severity: "critical", title: "Inventário com movimentos órfãos ou stock negativo", countSql: `select ((select count(*) from inventory_movements im left join items i on i.id = im.item_id where im.item_id is not null and i.id is null) + (select count(*) from inventory_balance ib left join items i on i.id = ib.item_id where i.id is null or coalesce(ib.balance,0) < 0))::int as count`, examplesSql: `select label from (select ('movimento #' || im.id::text || ' · item=' || coalesce(im.item_id::text, '—')) as label from inventory_movements im left join items i on i.id = im.item_id where im.item_id is not null and i.id is null union all select ('stock item=' || ib.item_id::text || ' · qty=' || ib.balance::text) as label from inventory_balance ib left join items i on i.id = ib.item_id where i.id is null or coalesce(ib.balance,0) < 0) x limit 10`, summary: (n) => n ? `${n} problema(s) crítico(s) no inventário.` : "Inventário não tem órfãos nem stock negativo.", recommendation: "Reconciliar movimentos vs balance." }));
    checks.push(await check({ id: "notifications_backlog", area: "notificacoes", severity: "medium", title: "Notificações pendentes antigas", countSql: `select count(*)::int as count from pending_notifications where processed_at is null and failed_at is null and created_at < now() - interval '15 minutes'`, examplesSql: `select ('#' || id::text || ' · prioridade=' || coalesce(priority::text, '—') || ' · criado=' || created_at::text) as label from pending_notifications where processed_at is null and failed_at is null and created_at < now() - interval '15 minutes' order by created_at asc limit 10`, summary: (n) => n ? `${n} notificação/notificações antigas por processar.` : "Fila de notificações não tem backlog antigo.", recommendation: "Verificar worker/bot de notificações." }));

    const severityOrder: Record<DataQualitySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    checks.sort((a, b) => Number(a.ok) - Number(b.ok) || severityOrder[a.severity] - severityOrder[b.severity] || b.count - a.count);
    return { generated_at: new Date().toISOString(), summary: summary(checks), checks };
  });
