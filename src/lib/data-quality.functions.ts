import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne, pgQuery } from "./pg.server";
import { resolveActualMember, resolveCurrentMember } from "./pricing.server";

export type DataQualitySeverity = "critical" | "high" | "medium" | "low";
export type DataQualityArea = "membros" | "perfis" | "encomendas" | "entregas" | "saidas" | "inventario" | "precos" | "receitas" | "premios" | "notificacoes" | "sistema";

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

type DeliveryLineRaw = Record<string, unknown>;
type DeliveryLine = { item_id: number; item_name: string; qty: number; unit_value: number };

type RepairResult = { ok: true; scanned: number; repaired: number; rejected: number; dropped_lines: number };

const ACTIVE_MEMBER_EXPR = `coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')`;
const ACTIVE_ITEM_EXPR = `coalesce(active, true) = true and deleted_at is null`;
const NORMALIZED_SQL = (field: string) => `translate(lower(coalesce(${field}, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;

const DELIVERY_LINE_PARSE_SQL = `
  with raw as (
    select r.id, r.created_at, r.status, r.tipo, line
    from inventory_delivery_requests r
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.lines) = 'array' then r.lines else '[]'::jsonb end) line
    where r.status = 'pending'
  ), parsed as (
    select *,
      coalesce(line->>'item_id', line->>'itemId') as raw_item_id,
      coalesce(line->>'qty', line->>'quantity', line->>'amount') as raw_qty,
      coalesce(line->>'item_name', line->>'itemName') as raw_item_name
    from raw
  ), resolved as (
    select p.*, coalesce(by_id.id, by_name.id) as resolved_item_id
    from parsed p
    left join items by_id on p.raw_item_id ~ '^\\d+$' and by_id.id = p.raw_item_id::int and ${ACTIVE_ITEM_EXPR.replaceAll("deleted_at", "by_id.deleted_at").replaceAll("active", "by_id.active")} and coalesce(by_id.org_buy_enabled, true) = true
    left join items by_name on by_id.id is null and ${NORMALIZED_SQL("by_name.name")} = ${NORMALIZED_SQL("p.raw_item_name")} and ${ACTIVE_ITEM_EXPR.replaceAll("deleted_at", "by_name.deleted_at").replaceAll("active", "by_name.active")} and coalesce(by_name.org_buy_enabled, true) = true
  )
`;

async function runCheck(args: {
  id: string;
  area: DataQualityArea;
  severity: DataQualitySeverity;
  title: string;
  countSql: string;
  examplesSql: string;
  summary: (count: number) => string;
  recommendation: string;
  repair_action?: DataQualityCheck["repair_action"];
}): Promise<DataQualityCheck> {
  try {
    const countRow = await pgOne<CountRow>(args.countSql);
    const count = Number(countRow?.count ?? 0);
    const examples = count > 0 ? await pgQuery<ExampleRow>(args.examplesSql) : [];
    return {
      id: args.id,
      area: args.area,
      severity: args.severity,
      title: args.title,
      count,
      ok: count === 0,
      summary: args.summary(count),
      examples: examples.map((r) => String(r.label ?? "—")).filter(Boolean),
      recommendation: args.recommendation,
      repair_action: args.repair_action,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      id: args.id,
      area: args.area,
      severity: "critical",
      title: `${args.title} — falhou a verificação`,
      count: 1,
      ok: false,
      summary: `A auditoria desta área falhou: ${msg}`,
      examples: [msg],
      recommendation: "Confirmar migrations/tabelas/colunas antes de confiar nos dados desta área.",
    };
  }
}

function buildSummary(checks: DataQualityCheck[]): DataQualityReport["summary"] {
  return {
    total_checks: checks.length,
    total_issues: checks.reduce((sum, c) => sum + c.count, 0),
    critical: checks.filter((c) => !c.ok && c.severity === "critical").length,
    high: checks.filter((c) => !c.ok && c.severity === "high").length,
    medium: checks.filter((c) => !c.ok && c.severity === "medium").length,
    low: checks.filter((c) => !c.ok && c.severity === "low").length,
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function positive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function money(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isObject(value: unknown): value is DeliveryLineRaw {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function assertReportAccess(context: any) {
  const me = await resolveCurrentMember(context.supabase, context.userId);
  if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");
  return me;
}

async function assertRepairAccess(context: any) {
  const me = await resolveActualMember(context.supabase, context.userId);
  if (!me?.is_superadmin) throw new Error("Acesso restrito ao Superadmin.");
  return me;
}

export const repairDeliveryLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RepairResult> => {
    await assertRepairAccess(context);

    const requests = await pgQuery<{ id: string; tipo: string | null; lines: unknown }>(
      `select id, tipo, lines
       from inventory_delivery_requests
       where status = 'pending'
         and lines is not null`,
    );
    const items = await pgQuery<{ id: number; name: string; side: string | null; purchase_price: number | null; morador_purchase_price: number | null; min_sale_price: number | null }>(
      `select id, name, side,
              purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price,
              min_sale_price::float as min_sale_price
       from items
       where ${ACTIVE_ITEM_EXPR}
         and coalesce(org_buy_enabled, true) = true`,
    );

    const byId = new Map(items.map((item) => [item.id, item]));
    const byName = new Map(items.map((item) => [normalizeText(item.name), item]));
    let repaired = 0;
    let rejected = 0;
    let droppedLines = 0;

    for (const request of requests) {
      const rawLines = Array.isArray(request.lines) ? request.lines.filter(isObject) : [];
      if (rawLines.length === 0) continue;
      const tipo = request.tipo === "venda" ? "venda" : "entrega";
      const normalized: DeliveryLine[] = [];

      for (const raw of rawLines) {
        const rawId = positive(raw.item_id ?? raw.itemId);
        const rawName = raw.item_name ?? raw.itemName;
        const item = (rawId ? byId.get(rawId) : undefined) ?? (rawName ? byName.get(normalizeText(rawName)) : undefined);
        const qty = positive(raw.qty ?? raw.quantity ?? raw.amount);
        if (!item || !qty) {
          droppedLines += 1;
          continue;
        }
        const explicitUnit = money(raw.unit_value ?? raw.unitValue ?? raw.unitPrice ?? raw.effectivePrice ?? raw.basePrice);
        const lineValue = money(raw.lineValue);
        const unit = tipo === "entrega" ? 0 : (explicitUnit ?? (lineValue != null ? lineValue / qty : null) ?? item.morador_purchase_price ?? item.purchase_price ?? item.min_sale_price ?? 0);
        normalized.push({ item_id: item.id, item_name: item.name, qty, unit_value: unit });
      }

      if (normalized.length === 0) {
        await pgQuery(
          `update inventory_delivery_requests
           set status = 'rejected', decision_reason = 'Reparação automática: pedido sem linhas válidas', decided_at = now(), updated_at = now(), lines = '[]'::jsonb, total_qty = 0, total_value = 0
           where id = $1 and status = 'pending'`,
          [request.id],
        );
        rejected += 1;
        continue;
      }

      const totalQty = normalized.reduce((sum, line) => sum + line.qty, 0);
      const totalValue = tipo === "entrega" ? 0 : normalized.reduce((sum, line) => sum + line.qty * line.unit_value, 0);
      await pgQuery(
        `update inventory_delivery_requests
         set lines = $2::jsonb, total_qty = $3, total_value = $4, updated_at = now()
         where id = $1 and status = 'pending'`,
        [request.id, JSON.stringify(normalized), totalQty, totalValue],
      );
      repaired += 1;
    }

    return { ok: true, scanned: requests.length, repaired, rejected, dropped_lines: droppedLines };
  });

export const getDataQualityReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DataQualityReport> => {
    await assertReportAccess(context);
    const checks: DataQualityCheck[] = [];

    checks.push(await runCheck({
      id: "members_duplicate_discord",
      area: "membros",
      severity: "critical",
      title: "Membros ativos com Discord duplicado",
      countSql: `select count(*)::int as count from (
        select discord_id from members
        where deleted_at is null and discord_id is not null and trim(discord_id) <> '' and ${ACTIVE_MEMBER_EXPR}
        group by discord_id having count(*) > 1
      ) x`,
      examplesSql: `select ('Discord ' || discord_id || ' · ' || string_agg('#' || id::text || ' ' || coalesce(display_name, username, '?'), ', ' order by id)) as label
        from members
        where deleted_at is null and discord_id is not null and trim(discord_id) <> '' and ${ACTIVE_MEMBER_EXPR}
        group by discord_id having count(*) > 1
        limit 10`,
      summary: (count) => count === 0 ? "Sem Discord IDs duplicados em membros ativos." : `${count} Discord ID(s) duplicados em membros ativos.`,
      recommendation: "Fundir/remover duplicados para não atribuir stats, prémios e permissões ao membro errado.",
    }));

    checks.push(await runCheck({
      id: "members_missing_identity",
      area: "membros",
      severity: "high",
      title: "Membros ativos sem nome ou Discord",
      countSql: `select count(*)::int as count from members
        where deleted_at is null and ${ACTIVE_MEMBER_EXPR}
          and (nullif(trim(coalesce(display_name, '')), '') is null or nullif(trim(coalesce(discord_id, '')), '') is null)`,
      examplesSql: `select ('#' || id::text || ' · ' || coalesce(display_name, username, 'sem nome') || ' · discord=' || coalesce(discord_id, '—')) as label
        from members
        where deleted_at is null and ${ACTIVE_MEMBER_EXPR}
          and (nullif(trim(coalesce(display_name, '')), '') is null or nullif(trim(coalesce(discord_id, '')), '') is null)
        order by id desc limit 10`,
      summary: (count) => count === 0 ? "Todos os membros ativos têm identidade mínima." : `${count} membro(s) ativo(s) sem nome ou Discord.`,
      recommendation: "Completar display_name/discord_id via sync Discord ou admin antes de expor rankings/permissões.",
    }));

    checks.push(await runCheck({
      id: "profiles_without_member",
      area: "perfis",
      severity: "high",
      title: "Perfis OAuth sem membro associado",
      countSql: `select count(*)::int as count
        from profiles p
        where p.discord_id is not null
          and not exists (select 1 from members m where m.discord_id = p.discord_id and m.deleted_at is null and ${ACTIVE_MEMBER_EXPR})`,
      examplesSql: `select (coalesce(p.display_name, p.user_id::text) || ' · discord=' || coalesce(p.discord_id, '—')) as label
        from profiles p
        where p.discord_id is not null
          and not exists (select 1 from members m where m.discord_id = p.discord_id and m.deleted_at is null and ${ACTIVE_MEMBER_EXPR})
        order by p.created_at desc limit 10`,
      summary: (count) => count === 0 ? "Todos os perfis Discord têm membro ativo associado." : `${count} perfil/perfis OAuth sem membro ativo associado.`,
      recommendation: "Sincronizar membros do Discord ou criar membro manualmente; caso contrário o utilizador autentica mas não recebe permissões/dados.",
    }));

    checks.push(await runCheck({
      id: "orders_orphan_member_item",
      area: "encomendas",
      severity: "critical",
      title: "Encomendas com membro ou item inexistente",
      countSql: `select count(*)::int as count
        from orders o
        left join members m on m.id = o.member_id
        left join items i on i.id = o.item_id
        where (o.member_id is not null and m.id is null) or (o.item_id is not null and i.id is null)`,
      examplesSql: `select ('#' || o.id::text || ' · membro=' || coalesce(o.member_id::text, '—') || ' · item=' || coalesce(o.item_id::text, '—')) as label
        from orders o
        left join members m on m.id = o.member_id
        left join items i on i.id = o.item_id
        where (o.member_id is not null and m.id is null) or (o.item_id is not null and i.id is null)
        order by o.created_at desc limit 10`,
      summary: (count) => count === 0 ? "Encomendas não têm referências partidas." : `${count} encomenda(s) têm membro ou item inexistente.`,
      recommendation: "Corrigir referências antes de fechar/enviar encomendas; isto afeta histórico, stock e prémios.",
    }));

    checks.push(await runCheck({
      id: "orders_active_without_responsavel",
      area: "encomendas",
      severity: "high",
      title: "Encomendas abertas sem responsável válido",
      countSql: `select count(*)::int as count
        from orders o
        left join members r on r.id = o.responsavel_member_id and r.deleted_at is null
        where o.status in ('pending','approved','in_progress','ready')
          and (o.responsavel_member_id is null or r.id is null)`,
      examplesSql: `select ('#' || o.id::text || ' · status=' || coalesce(o.status, '—') || ' · resp=' || coalesce(o.responsavel_member_id::text, '—')) as label
        from orders o
        left join members r on r.id = o.responsavel_member_id and r.deleted_at is null
        where o.status in ('pending','approved','in_progress','ready')
          and (o.responsavel_member_id is null or r.id is null)
        order by o.created_at desc limit 10`,
      summary: (count) => count === 0 ? "Todas as encomendas abertas têm responsável válido." : `${count} encomenda(s) abertas sem responsável válido.`,
      recommendation: "Atribuir responsável para garantir que só a pessoa certa trata o pedido.",
    }));

    checks.push(await runCheck({
      id: "orders_total_mismatch",
      area: "encomendas",
      severity: "medium",
      title: "Encomendas com total diferente de preço × quantidade",
      countSql: `select count(*)::int as count from orders
        where unit_price is not null and total_price is not null and quantity is not null
          and abs(coalesce(total_price,0) - coalesce(unit_price,0) * coalesce(quantity,0)) > 1`,
      examplesSql: `select ('#' || id::text || ' · total=' || total_price::text || ' · esperado=' || (unit_price * quantity)::text) as label
        from orders
        where unit_price is not null and total_price is not null and quantity is not null
          and abs(coalesce(total_price,0) - coalesce(unit_price,0) * coalesce(quantity,0)) > 1
        order by created_at desc limit 10`,
      summary: (count) => count === 0 ? "Totais das encomendas estão coerentes." : `${count} encomenda(s) têm total incoerente.`,
      recommendation: "Recalcular total_price ou preservar manualmente apenas se houver desconto/ajuste documentado.",
    }));

    checks.push(await runCheck({
      id: "deliveries_broken_lines",
      area: "entregas",
      severity: "critical",
      title: "Entregas pendentes com linhas inválidas ou itens inexistentes",
      countSql: `${DELIVERY_LINE_PARSE_SQL}
        select count(*)::int as count
        from resolved
        where not (raw_qty ~ '^\\d+(\\.\\d+)?$')
           or raw_qty::numeric <= 0
           or resolved_item_id is null`,
      examplesSql: `${DELIVERY_LINE_PARSE_SQL}
        select ('#' || id::text || ' · linha=' || line::text) as label
        from resolved
        where not (raw_qty ~ '^\\d+(\\.\\d+)?$')
           or raw_qty::numeric <= 0
           or resolved_item_id is null
        order by created_at desc limit 10`,
      summary: (count) => count === 0 ? "Entregas pendentes têm linhas válidas." : `${count} linha(s) pendente(s) inválida(s).`,
      recommendation: "Usar Reparar para normalizar linhas legacy por nome/ID e rejeitar pedidos sem linhas válidas.",
      repair_action: "repair_delivery_lines",
    }));

    checks.push(await runCheck({
      id: "deliveries_orphan_requester",
      area: "entregas",
      severity: "high",
      title: "Entregas pendentes com requerente/responsável inexistente",
      countSql: `select count(*)::int as count
        from inventory_delivery_requests r
        left join members requester on requester.id = r.requester_member_id
        left join members resp on resp.id = r.responsavel_member_id
        where r.status = 'pending' and (requester.id is null or r.responsavel_member_id is null or resp.id is null)`,
      examplesSql: `select ('#' || r.id::text || ' · requester=' || coalesce(r.requester_member_id::text, '—') || ' · resp=' || coalesce(r.responsavel_member_id::text, '—')) as label
        from inventory_delivery_requests r
        left join members requester on requester.id = r.requester_member_id
        left join members resp on resp.id = r.responsavel_member_id
        where r.status = 'pending' and (requester.id is null or r.responsavel_member_id is null or resp.id is null)
        order by r.created_at desc limit 10`,
      summary: (count) => count === 0 ? "Entregas pendentes têm membros associados válidos." : `${count} entrega(s) pendente(s) com membro/responsável inválido.`,
      recommendation: "Rejeitar/atribuir responsável antes de conferir a entrega.",
    }));

    checks.push(await runCheck({
      id: "operations_broken_refs",
      area: "saidas",
      severity: "critical",
      title: "Saídas com participantes/materiais órfãos",
      countSql: `select (
          (select count(*) from operation_participants p left join operations o on o.id = p.operation_id left join members m on m.id = p.member_id where o.id is null or m.id is null)
        + (select count(*) from operation_materials om left join operations o on o.id = om.operation_id left join items i on i.id = om.item_id where o.id is null or i.id is null)
        )::int as count`,
      examplesSql: `select label from (
          select ('participante · op=' || p.operation_id::text || ' · membro=' || p.member_id::text) as label
          from operation_participants p left join operations o on o.id = p.operation_id left join members m on m.id = p.member_id
          where o.id is null or m.id is null
          union all
          select ('material · op=' || om.operation_id::text || ' · item=' || om.item_id::text) as label
          from operation_materials om left join operations o on o.id = om.operation_id left join items i on i.id = om.item_id
          where o.id is null or i.id is null
        ) x limit 10`,
      summary: (count) => count === 0 ? "Saídas não têm participantes/materiais órfãos." : `${count} referência(s) partida(s) em saídas.`,
      recommendation: "Corrigir/remover órfãos antes de calcular rankings, K/D e valores líquidos.",
    }));

    checks.push(await runCheck({
      id: "inventory_orphan_or_negative",
      area: "inventario",
      severity: "critical",
      title: "Inventário com movimentos órfãos ou stock negativo",
      countSql: `select (
          (select count(*) from inventory_movements im left join items i on i.id = im.item_id where im.item_id is not null and i.id is null)
        + (select count(*) from inventory_balance ib left join items i on i.id = ib.item_id where i.id is null or coalesce(ib.balance,0) < 0)
        )::int as count`,
      examplesSql: `select label from (
          select ('movimento #' || im.id::text || ' · item=' || coalesce(im.item_id::text, '—')) as label
          from inventory_movements im left join items i on i.id = im.item_id
          where im.item_id is not null and i.id is null
          union all
          select ('stock item=' || ib.item_id::text || ' · qty=' || ib.balance::text) as label
          from inventory_balance ib left join items i on i.id = ib.item_id
          where i.id is null or coalesce(ib.balance,0) < 0
        ) x limit 10`,
      summary: (count) => count === 0 ? "Inventário não tem órfãos nem stock negativo." : `${count} problema(s) crítico(s) no inventário.`,
      recommendation: "Reconciliar movimentos vs balance e confirmar se stock negativo é permitido ou erro operacional.",
    }));

    checks.push(await runCheck({
      id: "items_invalid_price_or_side",
      area: "precos",
      severity: "high",
      title: "Itens ativos com side/preços inválidos",
      countSql: `select count(*)::int as count from items
        where ${ACTIVE_ITEM_EXPR} and (
          coalesce(side, '') not in ('venda','compra','ambos')
          or (side in ('venda','ambos') and coalesce(min_sale_price, purchase_price, 0) <= 0)
          or (side in ('compra','ambos') and coalesce(org_buy_enabled, true) = true and coalesce(purchase_price, morador_purchase_price, 0) <= 0)
        )`,
      examplesSql: `select ('#' || id::text || ' · ' || name || ' · side=' || coalesce(side, '—') || ' · compra=' || coalesce(purchase_price::text, '—') || ' · venda=' || coalesce(min_sale_price::text, '—')) as label
        from items
        where ${ACTIVE_ITEM_EXPR} and (
          coalesce(side, '') not in ('venda','compra','ambos')
          or (side in ('venda','ambos') and coalesce(min_sale_price, purchase_price, 0) <= 0)
          or (side in ('compra','ambos') and coalesce(org_buy_enabled, true) = true and coalesce(purchase_price, morador_purchase_price, 0) <= 0)
        )
        order by category, name limit 10`,
      summary: (count) => count === 0 ? "Itens ativos têm side/preços mínimos coerentes." : `${count} item(ns) ativo(s) com side ou preço inválido.`,
      recommendation: "Corrigir no Admin → Materiais; itens com compra pela org desligada não precisam de preço de compra.",
    }));

    checks.push(await runCheck({
      id: "db_recipes_broken_refs",
      area: "receitas",
      severity: "critical",
      title: "Receitas na DB com referências partidas",
      countSql: `select count(*)::int as count
        from recipe_ingredients ri
        left join craft_recipes cr on cr.id = ri.recipe_id
        left join items ingredient on ingredient.id = ri.ingredient_item_id
        left join items output on output.id = cr.item_id
        where cr.id is null or ingredient.id is null or output.id is null or coalesce(ri.quantity,0) <= 0`,
      examplesSql: `select ('recipe=' || coalesce(ri.recipe_id::text, '—') || ' · ingrediente=' || coalesce(ri.ingredient_item_id::text, '—') || ' · qty=' || coalesce(ri.quantity::text, '—')) as label
        from recipe_ingredients ri
        left join craft_recipes cr on cr.id = ri.recipe_id
        left join items ingredient on ingredient.id = ri.ingredient_item_id
        left join items output on output.id = cr.item_id
        where cr.id is null or ingredient.id is null or output.id is null or coalesce(ri.quantity,0) <= 0
        limit 10`,
      summary: (count) => count === 0 ? "Receitas na DB têm referências válidas." : `${count} ingrediente(s)/receita(s) inválidos na DB.`,
      recommendation: "Corrigir receitas no Admin → Materiais para que custos e materiais pedidos batam certo.",
    }));

    checks.push(await runCheck({
      id: "prizes_broken_state",
      area: "premios",
      severity: "medium",
      title: "Prémios com vencedor ou estado incoerente",
      countSql: `select count(*)::int as count
        from weekly_prizes wp
        left join members m on m.id = wp.winner_member_id
        where (wp.winner_member_id is not null and m.id is null)
           or (wp.prize_status = 'entregue' and wp.delivered_at is null)
           or (wp.prize_status in ('definido','entregue') and nullif(trim(coalesce(wp.prize_description,'')), '') is null)`,
      examplesSql: `select ('#' || wp.id::text || ' · semana=' || wp.week_start::text || ' · status=' || coalesce(wp.prize_status, '—') || ' · vencedor=' || coalesce(wp.winner_member_id::text, '—')) as label
        from weekly_prizes wp
        left join members m on m.id = wp.winner_member_id
        where (wp.winner_member_id is not null and m.id is null)
           or (wp.prize_status = 'entregue' and wp.delivered_at is null)
           or (wp.prize_status in ('definido','entregue') and nullif(trim(coalesce(wp.prize_description,'')), '') is null)
        order by wp.week_start desc limit 10`,
      summary: (count) => count === 0 ? "Prémios têm vencedor/estado coerente." : `${count} prémio(s) com estado incoerente.`,
      recommendation: "Completar descrição/estado ou regenerar prémio para a semana correta.",
    }));

    checks.push(await runCheck({
      id: "notifications_backlog",
      area: "notificacoes",
      severity: "medium",
      title: "Notificações pendentes antigas",
      countSql: `select count(*)::int as count from pending_notifications
        where processed_at is null and failed_at is null and created_at < now() - interval '15 minutes'`,
      examplesSql: `select ('#' || id::text || ' · prioridade=' || coalesce(priority::text, '—') || ' · criado=' || created_at::text) as label
        from pending_notifications
        where processed_at is null and failed_at is null and created_at < now() - interval '15 minutes'
        order by created_at asc limit 10`,
      summary: (count) => count === 0 ? "Fila de notificações não tem backlog antigo." : `${count} notificação/notificações antigas por processar.`,
      recommendation: "Verificar worker/bot de notificações; backlog antigo significa DMs/avisos perdidos ou atrasados.",
    }));

    checks.push(await runCheck({
      id: "required_stored_procedures",
      area: "sistema",
      severity: "critical",
      title: "Stored procedures operacionais ausentes",
      countSql: `select count(*)::int as count from unnest(array['sp_approve_delivery','sp_adjust_stock','sp_create_operation_with_participants','sp_liquidate_saida']) proc(name)
        where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = proc.name)`,
      examplesSql: `select proc.name as label from unnest(array['sp_approve_delivery','sp_adjust_stock','sp_create_operation_with_participants','sp_liquidate_saida']) proc(name)
        where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = proc.name)`,
      summary: (count) => count === 0 ? "Stored procedures ainda usadas existem na DB." : `${count} stored procedure(s) operacional/operacionais em falta na DB.`,
      recommendation: "Aplicar migrations SQL no Supabase ou remover de vez o fluxo dependente dessas procedures.",
    }));

    const order: Record<DataQualitySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    checks.sort((a, b) => Number(a.ok) - Number(b.ok) || order[a.severity] - order[b.severity] || b.count - a.count);
    return { generated_at: new Date().toISOString(), summary: buildSummary(checks), checks };
  });
