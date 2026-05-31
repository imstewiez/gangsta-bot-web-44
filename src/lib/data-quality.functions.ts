import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne, pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { getAllItems, getAllRecipes } from "./config.loader";

export type DataQualitySeverity = "critical" | "high" | "medium" | "low";
export type DataQualityArea =
  | "membros"
  | "perfis"
  | "encomendas"
  | "entregas"
  | "saidas"
  | "inventario"
  | "precos"
  | "receitas"
  | "premios"
  | "notificacoes"
  | "sistema";

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
};

export type DataQualityReport = {
  generated_at: string;
  summary: {
    total_checks: number;
    total_issues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  checks: DataQualityCheck[];
};

type CountRow = { count: number };
type ExampleRow = { label: string | null };

const ACTIVE_MEMBER_EXPR = `coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')`;

async function runCheck(args: {
  id: string;
  area: DataQualityArea;
  severity: DataQualitySeverity;
  title: string;
  countSql: string;
  examplesSql: string;
  summary: (count: number) => string;
  recommendation: string;
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

async function configDriftChecks(): Promise<DataQualityCheck[]> {
  const configItems = getAllItems();
  const configRecipes = getAllRecipes();
  const dbItems = await pgQuery<{ id: number; name: string; active: boolean; deleted_at: string | null }>(
    `select id, name, coalesce(active, true) as active, deleted_at from items`,
  );
  const activeNames = new Set(dbItems.filter((i) => i.active !== false && !i.deleted_at).map((i) => i.name));
  const configNames = new Set(Object.values(configItems).map((i) => i.name));

  const missingInDb = Object.values(configItems).map((i) => i.name).filter((name) => !activeNames.has(name));
  const dbNotInConfig = dbItems
    .filter((i) => i.active !== false && !i.deleted_at && !configNames.has(i.name))
    .map((i) => `#${i.id} · ${i.name}`);

  const badRecipes: string[] = [];
  for (const [recipeId, recipe] of Object.entries(configRecipes)) {
    if (!configItems[recipe.output]) badRecipes.push(`${recipeId}: output inexistente (${recipe.output})`);
    for (const [ingredientId, qty] of Object.entries(recipe.inputs)) {
      if (!configItems[ingredientId]) badRecipes.push(`${recipeId}: ingrediente inexistente (${ingredientId})`);
      if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) badRecipes.push(`${recipeId}: quantidade inválida em ${ingredientId}`);
    }
  }

  return [
    {
      id: "config_items_missing_in_db",
      area: "precos",
      severity: "high",
      title: "Itens do config ausentes/inativos na base de dados",
      count: missingInDb.length,
      ok: missingInDb.length === 0,
      summary: missingInDb.length === 0 ? "Todos os itens do config têm correspondência ativa na DB." : `${missingInDb.length} item(ns) do config não aparecem ativos na DB.`,
      examples: missingInDb.slice(0, 10),
      recommendation: "Sincronizar/reativar itens canónicos ou migrar de vez esses itens para gestão DB.",
    },
    {
      id: "db_items_not_in_config",
      area: "precos",
      severity: "low",
      title: "Itens ativos na DB fora do config",
      count: dbNotInConfig.length,
      ok: true,
      summary: dbNotInConfig.length === 0 ? "Não há itens ativos fora do config." : `${dbNotInConfig.length} item(ns) ativo(s) existem só na DB — isto é aceitável se foram criados no admin.`,
      examples: dbNotInConfig.slice(0, 10),
      recommendation: "Manter se forem materiais criados pelo admin; desativar apenas itens obsoletos.",
    },
    {
      id: "config_recipe_integrity",
      area: "receitas",
      severity: "critical",
      title: "Receitas do config com referências inválidas",
      count: badRecipes.length,
      ok: badRecipes.length === 0,
      summary: badRecipes.length === 0 ? "Receitas do config estão consistentes." : `${badRecipes.length} problema(s) encontrado(s) nas receitas do config.`,
      examples: badRecipes.slice(0, 10),
      recommendation: "Corrigir config.json antes de expor receitas/preços derivados.",
    },
  ];
}

export const getDataQualityReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DataQualityReport> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");
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
      title: "Entregas com linhas inválidas ou itens inexistentes",
      countSql: `select count(*)::int as count
        from inventory_delivery_requests r
        cross join lateral jsonb_array_elements(coalesce(r.lines, '[]'::jsonb)) line
        left join items i on (line->>'item_id') ~ '^\\d+$' and i.id = (line->>'item_id')::int
        where not ((line->>'item_id') ~ '^\\d+$')
           or not ((line->>'qty') ~ '^\\d+(\\.\\d+)?$')
           or case when (line->>'qty') ~ '^\\d+(\\.\\d+)?$' then (line->>'qty')::numeric <= 0 else true end
           or i.id is null`,
      examplesSql: `select ('#' || r.id::text || ' · linha=' || line::text) as label
        from inventory_delivery_requests r
        cross join lateral jsonb_array_elements(coalesce(r.lines, '[]'::jsonb)) line
        left join items i on (line->>'item_id') ~ '^\\d+$' and i.id = (line->>'item_id')::int
        where not ((line->>'item_id') ~ '^\\d+$')
           or not ((line->>'qty') ~ '^\\d+(\\.\\d+)?$')
           or case when (line->>'qty') ~ '^\\d+(\\.\\d+)?$' then (line->>'qty')::numeric <= 0 else true end
           or i.id is null
        order by r.created_at desc limit 10`,
      summary: (count) => count === 0 ? "Linhas das entregas estão válidas." : `${count} linha(s) de entrega inválida(s).`,
      recommendation: "Corrigir linhas antes de aprovar para evitar movimentos de stock errados.",
    }));

    checks.push(await runCheck({
      id: "deliveries_orphan_requester",
      area: "entregas",
      severity: "high",
      title: "Entregas com requerente/responsável inexistente",
      countSql: `select count(*)::int as count
        from inventory_delivery_requests r
        left join members requester on requester.id = r.requester_member_id
        left join members resp on resp.id = r.responsavel_member_id
        where requester.id is null or (r.responsavel_member_id is not null and resp.id is null)`,
      examplesSql: `select ('#' || r.id::text || ' · requester=' || coalesce(r.requester_member_id::text, '—') || ' · resp=' || coalesce(r.responsavel_member_id::text, '—')) as label
        from inventory_delivery_requests r
        left join members requester on requester.id = r.requester_member_id
        left join members resp on resp.id = r.responsavel_member_id
        where requester.id is null or (r.responsavel_member_id is not null and resp.id is null)
        order by r.created_at desc limit 10`,
      summary: (count) => count === 0 ? "Entregas têm membros associados válidos." : `${count} entrega(s) têm membro inexistente.`,
      recommendation: "Corrigir requester/responsável para não perder histórico de pontos e autorização.",
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
        where coalesce(active, true) = true and deleted_at is null and (
          coalesce(side, '') not in ('venda','compra','ambos')
          or (side in ('venda','ambos') and coalesce(min_sale_price, estimated_value, purchase_price, 0) <= 0)
          or (side in ('compra','ambos') and coalesce(purchase_price, morador_purchase_price, estimated_value, 0) <= 0)
        )`,
      examplesSql: `select ('#' || id::text || ' · ' || name || ' · side=' || coalesce(side, '—') || ' · compra=' || coalesce(purchase_price::text, '—') || ' · venda=' || coalesce(min_sale_price::text, '—')) as label
        from items
        where coalesce(active, true) = true and deleted_at is null and (
          coalesce(side, '') not in ('venda','compra','ambos')
          or (side in ('venda','ambos') and coalesce(min_sale_price, estimated_value, purchase_price, 0) <= 0)
          or (side in ('compra','ambos') and coalesce(purchase_price, morador_purchase_price, estimated_value, 0) <= 0)
        )
        order by category, name limit 10`,
      summary: (count) => count === 0 ? "Itens ativos têm side/preços mínimos coerentes." : `${count} item(ns) ativo(s) com side ou preço inválido.`,
      recommendation: "Corrigir no Admin → Materiais, senão preçário/encomendas/entregas ficam incoerentes.",
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
      title: "Stored procedures obrigatórias ausentes",
      countSql: `select count(*)::int as count from unnest(array['sp_approve_delivery','sp_transition_order','sp_cancel_orders','sp_adjust_stock','sp_create_operation_with_participants','sp_liquidate_saida']) proc(name)
        where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = proc.name)`,
      examplesSql: `select proc.name as label from unnest(array['sp_approve_delivery','sp_transition_order','sp_cancel_orders','sp_adjust_stock','sp_create_operation_with_participants','sp_liquidate_saida']) proc(name)
        where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = proc.name)`,
      summary: (count) => count === 0 ? "Stored procedures críticas existem na DB." : `${count} stored procedure(s) crítica(s) em falta na DB.`,
      recommendation: "Aplicar migrations SQL no Supabase antes de usar entregas, encomendas, stock e saídas.",
    }));

    try {
      checks.push(...await configDriftChecks());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({
        id: "config_drift_failed",
        area: "precos",
        severity: "critical",
        title: "Falha ao comparar config vs DB",
        count: 1,
        ok: false,
        summary: `Não foi possível comparar config.json com a DB: ${msg}`,
        examples: [msg],
        recommendation: "Corrigir acesso a items/config antes de confiar no preçário e receitas.",
      });
    }

    const order: Record<DataQualitySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    checks.sort((a, b) => order[a.severity] - order[b.severity] || Number(a.ok) - Number(b.ok) || b.count - a.count);
    return { generated_at: new Date().toISOString(), summary: buildSummary(checks), checks };
  });
