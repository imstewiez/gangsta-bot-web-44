import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type OrderCycle = {
  cycle_start: string;
  cycle_end: string;
  total_orders: number;
  total_material: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  fulfilled_count: number;
  pending_count: number;
  active_count: number;
  items: {
    item_name: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
  }[];
};

const ACTIVE_ORDER_STATUSES = ["pending", "approved", "in_progress", "ready"];

function orderVisibilitySql() {
  // Incidente: nunca esconder encomendas da chefia no painel.
  // A página de gestão deve mostrar o estado real global, não apenas encomendas atribuídas ao utilizador atual.
  return { sql: "", params: [] as unknown[] };
}

function currentOrderValueSql(alias = "o", itemAlias = "i") {
  return `
    case
      when ${alias}.status in ('pending','approved','in_progress','ready') then
        coalesce(
          nullif(${itemAlias}.min_sale_price, 0),
          nullif(${itemAlias}.purchase_price, 0),
          ${alias}.unit_price,
          0
        ) * ${alias}.quantity
      else coalesce(${alias}.total_price, 0)
    end
  `;
}

export const getChefiaKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à direção.");
    const visibility = orderVisibilitySql();

    const [totalMembers, activeMembers, pendingOrders, pendingDeliveries, lowStock, totalInventoryValue, weeklyRevenue, inactiveMembers] = await Promise.all([
      pgOne<{ count: number }>(`select count(*)::int as count from members where deleted_at is null`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(`select count(*)::int as count from members where deleted_at is null and coalesce(lifecycle_state::text, 'active') in ('active', 'promoted')`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(
        `select count(distinct coalesce(o.batch_id, o.id::text))::int as count
         from orders o
         where o.status = 'pending'
         ${visibility.sql}`,
        visibility.params,
      ).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(
        `select count(*)::int as count
         from inventory_delivery_requests r
         where r.status = 'pending'`,
      ).catch(() => ({ count: 0 })),
      pgQuery<{ name: string; balance: number }>(
        `with visible_items as (
           select i.id, i.name
           from items i
           where coalesce(i.active, true) = true
             and i.deleted_at is null
             and (
               coalesce(i.side, 'venda') in ('venda', 'ambos')
               or exists (
                 select 1
                 from recipe_ingredients ri
                 join craft_recipes cr on cr.id = ri.recipe_id
                 join items out_i on out_i.id = cr.item_id
                 where ri.ingredient_item_id = i.id
                   and coalesce(ri.quantity, 0) > 0
                   and coalesce(out_i.active, true) = true
                   and out_i.deleted_at is null
               )
             )
         )
         select vi.name, coalesce(b.balance, 0)::int as balance
         from visible_items vi
         left join inventory_balance b on b.item_id = vi.id
         where coalesce(b.balance, 0) < 5
         order by coalesce(b.balance, 0) asc
         limit 10`,
      ).catch(() => []),
      pgOne<{ total: number }>(
        `select coalesce(sum(coalesce(b.balance, 0) * coalesce(i.estimated_value, 0)), 0)::float as total
         from items i
         left join inventory_balance b on b.item_id = i.id
         where coalesce(i.active, true) = true
           and i.deleted_at is null`,
      ).catch(() => ({ total: 0 })),
      pgOne<{ total: number }>(
        `select coalesce(sum(${currentOrderValueSql("o", "i")}), 0)::float as total
         from orders o
         left join items i on i.id = o.item_id
         where o.status = 'fulfilled'
           and o.created_at >= now() - interval '7 days'
           ${visibility.sql}`,
        visibility.params,
      ).catch(() => ({ total: 0 })),
      pgQuery<{ display_name: string | null; days: number }>(
        `WITH member_activity AS (
           SELECT
             m.id,
             m.display_name,
             GREATEST(
               COALESCE((SELECT MAX(COALESCE(o.end_time, o.start_time, o.date::timestamp, o.created_at))
                         FROM operations o
                         JOIN operation_participants op ON op.operation_id = o.id
                         WHERE op.member_id = m.id AND o.deleted_at IS NULL), m.joined_at),
               COALESCE((SELECT MAX(r.created_at)
                         FROM inventory_delivery_requests r
                         WHERE r.requester_member_id = m.id), m.joined_at),
               COALESCE((SELECT MAX(ord.created_at)
                         FROM orders ord
                         WHERE ord.member_id = m.id), m.joined_at),
               m.joined_at,
               m.created_at
             ) as last_active
           FROM members m
           WHERE m.deleted_at IS NULL
             AND COALESCE(m.lifecycle_state::text, 'active') IN ('active', 'promoted')
         )
         SELECT display_name, EXTRACT(day FROM now() - last_active)::int as days
         FROM member_activity
         WHERE last_active < now() - interval '14 days'
         ORDER BY last_active ASC
         LIMIT 10`,
      ).catch(() => []),
    ]);

    return {
      totalMembers: totalMembers?.count ?? 0,
      activeMembers: activeMembers?.count ?? 0,
      pendingOrders: pendingOrders?.count ?? 0,
      pendingDeliveries: pendingDeliveries?.count ?? 0,
      lowStock,
      totalInventoryValue: totalInventoryValue?.total ?? 0,
      weeklyRevenue: weeklyRevenue?.total ?? 0,
      inactiveMembers,
    };
  });

export const getOrderCycles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrderCycle[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const isChefia = me?.tier === "kingpin" || me?.tier === "manda_chuva" || me?.is_superadmin || me?.role_label === "kingpin" || me?.role_label === "manda_chuva";
    if (!isChefia || !me) throw new Error("Acesso restrito. Apenas Kingpin e Manda-Chuva.");
    const visibility = orderVisibilitySql();
    const statusParamIndex = visibility.params.length + 1;

    const baseVisibleOrdersSql = `
      select
        o.id,
        o.batch_id,
        o.created_at,
        date_trunc('week', o.created_at)::date as cycle_start,
        (date_trunc('week', o.created_at)::date + interval '6 days')::date as cycle_end,
        coalesce(o.batch_id, o.id::text) as order_key,
        o.status,
        o.quantity,
        i.name as item_name,
        ${currentOrderValueSql("o", "i")} as total_price,
        coalesce(i.estimated_value, 0) as unit_cost
      from orders o
      join items i on i.id = o.item_id
      where o.status = any($${statusParamIndex}::text[])
      ${visibility.sql}
      order by o.created_at desc
      limit 200
    `;

    const cycles = await pgQuery<{
      cycle_start: string;
      cycle_end: string;
      total_orders: number;
      total_material: number;
      total_revenue: number;
      total_cost: number;
      total_profit: number;
      fulfilled_count: number;
      pending_count: number;
      active_count: number;
    }>(
      `with visible_orders as (${baseVisibleOrdersSql})
       select
         cycle_start,
         cycle_end,
         count(distinct order_key)::int as total_orders,
         sum(quantity)::int as total_material,
         sum(total_price)::float as total_revenue,
         sum(quantity * unit_cost)::float as total_cost,
         sum(total_price - quantity * unit_cost)::float as total_profit,
         0::int as fulfilled_count,
         count(distinct order_key) filter (where status = 'pending')::int as pending_count,
         count(distinct order_key) filter (where status in ('approved','in_progress','ready'))::int as active_count
       from visible_orders
       group by cycle_start, cycle_end
       order by cycle_start desc
       limit 8`,
      [...visibility.params, ACTIVE_ORDER_STATUSES],
    ).catch(() => []);

    const items = await pgQuery<{ cycle_start: string; item_name: string; quantity: number; revenue: number; cost: number; profit: number }>(
      `with visible_orders as (${baseVisibleOrdersSql})
       select
         cycle_start,
         item_name,
         sum(quantity)::int as quantity,
         sum(total_price)::float as revenue,
         sum(quantity * unit_cost)::float as cost,
         sum(total_price - quantity * unit_cost)::float as profit
       from visible_orders
       group by cycle_start, item_name
       order by cycle_start desc, profit desc`,
      [...visibility.params, ACTIVE_ORDER_STATUSES],
    ).catch(() => []);

    return cycles.map((cycle) => ({
      ...cycle,
      items: items.filter((item) => item.cycle_start === cycle.cycle_start).map((item) => ({
        item_name: item.item_name,
        quantity: item.quantity,
        revenue: item.revenue,
        cost: item.cost,
        profit: item.profit,
      })),
    }));
  });
