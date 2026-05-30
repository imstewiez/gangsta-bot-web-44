import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { getAllRecipes, getItemById, getAllItems } from "./config.loader";
import { resolveItemPrices } from "./pricing.resolver";

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
  items: {
    item_name: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
  }[];
};

export const getChefiaKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à direção.");

    const [
      totalMembers,
      activeMembers,
      pendingOrders,
      pendingDeliveries,
      lowStock,
      totalInventoryValue,
      weeklyRevenue,
      inactiveMembers,
    ] = await Promise.all([
      pgOne<{ count: number }>(`select count(*)::int as count from members where deleted_at is null`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(`select count(*)::int as count from members where deleted_at is null and coalesce(lifecycle_state::text, 'active') in ('active', 'promoted')`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(`select count(*)::int as count from orders where status in ('pending', 'approved', 'in_progress', 'ready')`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(`select count(*)::int as count from inventory_delivery_requests where status = 'pending'`).catch(() => ({ count: 0 })),
      (async () => {
        const recipes = getAllRecipes();
        const recipeIngredientNames = new Set<string>();
        for (const recipe of Object.values(recipes)) {
          for (const ingId of Object.keys(recipe.inputs)) {
            const item = getItemById(ingId);
            if (item) recipeIngredientNames.add(item.name);
          }
        }
        const ingredientNames = Array.from(recipeIngredientNames);
        return pgQuery<{ name: string; balance: number }>(
          `select i.name, coalesce(b.balance, 0)::int as balance
           from items i
           left join inventory_balance b on b.item_id = i.id
           where i.active = true
             and (i.side in ('venda', 'ambos') or i.name = any($1::text[]))
             and coalesce(b.balance, 0) < 5
           order by coalesce(b.balance, 0) asc
           limit 10`,
          [ingredientNames],
        ).catch(() => []);
      })(),
      pgOne<{ total: number }>(
        `select coalesce(sum(coalesce(b.balance, 0) * coalesce(i.min_sale_price, 0)), 0)::float as total
         from items i
         left join inventory_balance b on b.item_id = i.id
         where i.active = true`
      ).catch(() => ({ total: 0 })),
      pgOne<{ total: number }>(
        `select coalesce(sum(total_price), 0)::float as total
         from orders
         where status = 'fulfilled'
           and created_at >= now() - interval '7 days'`
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
         LIMIT 10`
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
    const isChefia = me?.tier === "kingpin" || me?.tier === "manda_chuva" || me?.role_label === "kingpin" || me?.role_label === "manda_chuva";
    if (!isChefia) throw new Error("Acesso restrito. Apenas Kingpin e Manda-Chuva.");

    // Build resolved unit costs from DB + config
    const configItems = getAllItems();
    const dbItems = await pgQuery<{
      id: number;
      name: string;
      purchase_price: number | null;
      estimated_value: number | null;
    }>(
      `select id, name, purchase_price::float as purchase_price, estimated_value::float as estimated_value from items where active = true`
    );
    const costs: { id: number; unit_cost: number }[] = [];
    for (const db of dbItems) {
      const configItem = configItems[Object.keys(configItems).find(k => configItems[k].name === db.name) ?? ""];
      const prices = resolveItemPrices(db, configItem);
      costs.push({ id: db.id, unit_cost: prices.purchase_price ?? prices.estimated_value ?? 0 });
    }

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
    }>(
      `WITH real_costs AS (
        SELECT * FROM unnest($1::int[], $2::float[]) AS t(id, unit_cost)
      ),
      cycle_orders AS (
        SELECT
          date_trunc('week', o.created_at)::date as cycle_start,
          (date_trunc('week', o.created_at)::date + interval '6 days')::date as cycle_end,
          o.id,
          o.status,
          o.quantity,
          COALESCE(o.total_price, 0) as total_price,
          COALESCE(rc.unit_cost, 0) as unit_cost
        FROM orders o
        JOIN items i ON i.id = o.item_id
        LEFT JOIN real_costs rc ON rc.id = i.id
        WHERE o.status NOT IN ('cancelled', 'denied')
      )
      SELECT
        cycle_start,
        cycle_end,
        COUNT(DISTINCT id)::int as total_orders,
        SUM(quantity)::int as total_material,
        SUM(total_price)::float as total_revenue,
        SUM(quantity * unit_cost)::float as total_cost,
        SUM(total_price - quantity * unit_cost)::float as total_profit,
        COUNT(*) FILTER (WHERE status = 'fulfilled')::int as fulfilled_count,
        COUNT(*) FILTER (WHERE status IN ('pending', 'approved', 'in_progress', 'ready'))::int as pending_count
      FROM cycle_orders
      GROUP BY cycle_start, cycle_end
      ORDER BY cycle_start DESC
      LIMIT 8`,
      [costs.map(c => c.id), costs.map(c => c.unit_cost)]
    ).catch(() => []);

    const items = await pgQuery<{
      cycle_start: string;
      item_name: string;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
    }>(
      `WITH real_costs AS (
        SELECT * FROM unnest($1::int[], $2::float[]) AS t(id, unit_cost)
      )
      SELECT
        date_trunc('week', o.created_at)::date as cycle_start,
        i.name as item_name,
        SUM(o.quantity)::int as quantity,
        SUM(COALESCE(o.total_price, 0))::float as revenue,
        SUM(o.quantity * COALESCE(rc.unit_cost, 0))::float as cost,
        SUM(COALESCE(o.total_price, 0) - o.quantity * COALESCE(rc.unit_cost, 0))::float as profit
      FROM orders o
      JOIN items i ON i.id = o.item_id
      LEFT JOIN real_costs rc ON rc.id = i.id
      WHERE o.status NOT IN ('cancelled', 'denied')
      GROUP BY date_trunc('week', o.created_at)::date, i.name
      ORDER BY cycle_start DESC, profit DESC`,
      [costs.map(c => c.id), costs.map(c => c.unit_cost)]
    ).catch(() => []);

    return cycles.map((c) => ({
      ...c,
      items: items.filter((i) => i.cycle_start === c.cycle_start).map((i) => ({
        item_name: i.item_name,
        quantity: i.quantity,
        revenue: i.revenue,
        cost: i.cost,
        profit: i.profit,
      })),
    }));
  });
