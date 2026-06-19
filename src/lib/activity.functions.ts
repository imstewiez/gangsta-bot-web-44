import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type ActivityStatusKey = "extreme" | "active" | "irregular" | "inactive" | "critical";

export type ActivityMember = {
  id: number;
  display_name: string | null;
  nickname: string | null;
  discord_id: string | null;
  tier: string | null;
  joined_at: string | null;
  portal_created_at: string | null;
  portal_last_seen_at: string | null;
  order_count: number;
  order_count_7d: number;
  last_order_at: string | null;
  delivery_count: number;
  delivery_count_7d: number;
  last_delivery_at: string | null;
  active_days_7: number;
  active_days_30: number;
  last_activity_at: string | null;
  days_since_activity: number | null;
  score: number;
  status_key: ActivityStatusKey;
  status_label: string;
  flags: string[];
  risk_reasons: string[];
};

export type ActivityReport = {
  generated_at: string;
  summary: {
    total_bairristas: number;
    extreme: number;
    active: number;
    irregular: number;
    inactive: number;
    critical: number;
    never_portal: number;
    never_order: number;
    never_delivery: number;
    no_activity_7d: number;
    no_activity_14d: number;
  };
  members: ActivityMember[];
};

type RawActivityMember = {
  id: number;
  display_name: string | null;
  nickname: string | null;
  discord_id: string | null;
  tier: string | null;
  joined_at: string | null;
  portal_created_at: string | null;
  portal_last_seen_at: string | null;
  order_count: number | string | null;
  order_count_7d: number | string | null;
  last_order_at: string | null;
  delivery_count: number | string | null;
  delivery_count_7d: number | string | null;
  last_delivery_at: string | null;
  active_days_7: number | string | null;
  active_days_30: number | string | null;
  last_activity_at: string | null;
};

const BAIRRISTA_TIERS = ["young_blood", "o_gunao", "gangster_fodido"];

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function recencyPoints(days: number | null, max: number): number {
  if (days == null) return 0;
  if (days <= 1) return max;
  if (days <= 3) return Math.round(max * 0.8);
  if (days <= 7) return Math.round(max * 0.55);
  if (days <= 14) return Math.round(max * 0.25);
  return 0;
}

function buildScore(row: RawActivityMember): number {
  const portalDays = daysSince(row.portal_last_seen_at);
  const orderDays = daysSince(row.last_order_at);
  const deliveryDays = daysSince(row.last_delivery_at);
  const activityDays = daysSince(row.last_activity_at);
  const orders = num(row.order_count);
  const deliveries = num(row.delivery_count);
  const active7 = num(row.active_days_7);
  const active30 = num(row.active_days_30);
  const deliveries7 = num(row.delivery_count_7d);
  const orders7 = num(row.order_count_7d);

  let score = 0;

  // Portal: importante, mas não suficiente.
  score += row.portal_created_at ? 8 : 0;
  score += recencyPoints(portalDays, 7);

  // Encomendas: sinal de uso real da app.
  score += orders > 0 ? 8 : 0;
  score += recencyPoints(orderDays, 12);
  score += Math.min(5, orders7 * 2);

  // Entregas: contribuição direta para o bairro.
  score += deliveries > 0 ? 10 : 0;
  score += recencyPoints(deliveryDays, 15);
  score += Math.min(10, deliveries7 * 3);

  // Regularidade: dias diferentes com ações nos últimos 7/30 dias.
  score += Math.min(15, Math.round((active7 / 7) * 15));
  score += Math.min(10, Math.round((active30 / 30) * 10));

  // Recência geral.
  score += recencyPoints(activityDays, 10);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function classify(score: number, row: RawActivityMember): { key: ActivityStatusKey; label: string } {
  const hasNothing = !row.portal_created_at && num(row.order_count) === 0 && num(row.delivery_count) === 0;
  const activityDays = daysSince(row.last_activity_at);
  if (hasNothing || activityDays == null || activityDays >= 14) return { key: "critical", label: "Crítico" };
  if (score >= 85) return { key: "extreme", label: "Extremamente ativo" };
  if (score >= 65) return { key: "active", label: "Ativo" };
  if (score >= 40) return { key: "irregular", label: "Irregular" };
  return { key: "inactive", label: "Inativo" };
}

function buildFlags(row: RawActivityMember): { flags: string[]; risk_reasons: string[] } {
  const flags: string[] = [];
  const risk: string[] = [];
  const lastActivity = daysSince(row.last_activity_at);
  const lastOrder = daysSince(row.last_order_at);
  const lastDelivery = daysSince(row.last_delivery_at);
  const lastPortal = daysSince(row.portal_last_seen_at);

  if (!row.portal_created_at) {
    flags.push("Nunca entrou no portal");
    risk.push("sem acesso/uso do site");
  } else if (lastPortal != null && lastPortal > 7) {
    flags.push(`Portal parado há ${lastPortal} dias`);
  }

  if (num(row.order_count) === 0) {
    flags.push("Nunca fez encomenda");
    risk.push("sem encomendas");
  } else if (lastOrder != null && lastOrder > 7) {
    flags.push(`Sem encomendas há ${lastOrder} dias`);
  }

  if (num(row.delivery_count) === 0) {
    flags.push("Nunca fez entrega");
    risk.push("sem entregas");
  } else if (lastDelivery != null && lastDelivery > 7) {
    flags.push(`Sem entregas há ${lastDelivery} dias`);
  }

  if (lastActivity == null) {
    flags.push("Sem atividade registada");
  } else if (lastActivity > 7) {
    flags.push(`Nada registado há ${lastActivity} dias`);
  }

  if (num(row.active_days_7) === 0) flags.push("0 dias ativos nos últimos 7 dias");

  return { flags, risk_reasons: risk };
}

export const getActivityReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActivityReport> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à direção.");

    const rows = await pgQuery<RawActivityMember>(
      `with bairristas as (
         select m.id, m.display_name, m.nickname, m.discord_id, m.tier, m.joined_at
         from members m
         where m.deleted_at is null
           and m.role = 'bairrista'
           and m.tier = any($1::text[])
           and coalesce(m.lifecycle_state::text, m.status, 'active') in ('active','ativo','promoted')
       ), portal as (
         select p.discord_id,
                min(p.created_at) as portal_created_at,
                max(p.updated_at) as portal_last_seen_at
         from profiles p
         where p.discord_id is not null
         group by p.discord_id
       ), orders_agg as (
         select o.member_id,
                count(distinct coalesce(nullif(o.batch_id, ''), o.id::text))::int as order_count,
                count(distinct coalesce(nullif(o.batch_id, ''), o.id::text)) filter (where o.created_at >= now() - interval '7 days')::int as order_count_7d,
                max(o.created_at) as last_order_at
         from orders o
         where o.member_id is not null
         group by o.member_id
       ), delivery_movements as (
         select im.member_id,
                im.created_at,
                case
                  when coalesce(im.notes, '') ~ '^delivery:' then regexp_replace(im.notes, '^delivery:', '')
                  else im.id::text
                end as source_key
         from inventory_movements im
         where im.member_id is not null
           and im.quantity > 0
           and im.movement_type in ('entrega_bairrista','entrega_oficial')
       ), deliveries_agg as (
         select dm.member_id,
                count(distinct dm.source_key)::int as delivery_count,
                count(distinct dm.source_key) filter (where dm.created_at >= now() - interval '7 days')::int as delivery_count_7d,
                max(dm.created_at) as last_delivery_at
         from delivery_movements dm
         group by dm.member_id
       ), activity_events as (
         select b.id as member_id, p.portal_last_seen_at as at
         from bairristas b
         join portal p on p.discord_id = b.discord_id
         where p.portal_last_seen_at is not null
         union all
         select member_id, created_at as at from orders where member_id is not null
         union all
         select member_id, created_at as at from delivery_movements
       ), activity_agg as (
         select member_id,
                max(at) as last_activity_at,
                count(distinct date_trunc('day', at)) filter (where at >= now() - interval '7 days')::int as active_days_7,
                count(distinct date_trunc('day', at)) filter (where at >= now() - interval '30 days')::int as active_days_30
         from activity_events
         group by member_id
       )
       select b.id, b.display_name, b.nickname, b.discord_id, b.tier, b.joined_at,
              p.portal_created_at,
              p.portal_last_seen_at,
              coalesce(o.order_count, 0)::int as order_count,
              coalesce(o.order_count_7d, 0)::int as order_count_7d,
              o.last_order_at,
              coalesce(d.delivery_count, 0)::int as delivery_count,
              coalesce(d.delivery_count_7d, 0)::int as delivery_count_7d,
              d.last_delivery_at,
              coalesce(a.active_days_7, 0)::int as active_days_7,
              coalesce(a.active_days_30, 0)::int as active_days_30,
              a.last_activity_at
       from bairristas b
       left join portal p on p.discord_id = b.discord_id
       left join orders_agg o on o.member_id = b.id
       left join deliveries_agg d on d.member_id = b.id
       left join activity_agg a on a.member_id = b.id
       order by a.last_activity_at asc nulls first, b.display_name asc`,
      [BAIRRISTA_TIERS],
    );

    const members = rows.map((row): ActivityMember => {
      const score = buildScore(row);
      const status = classify(score, row);
      const flags = buildFlags(row);
      return {
        id: row.id,
        display_name: row.display_name,
        nickname: row.nickname,
        discord_id: row.discord_id,
        tier: row.tier,
        joined_at: row.joined_at,
        portal_created_at: row.portal_created_at,
        portal_last_seen_at: row.portal_last_seen_at,
        order_count: num(row.order_count),
        order_count_7d: num(row.order_count_7d),
        last_order_at: row.last_order_at,
        delivery_count: num(row.delivery_count),
        delivery_count_7d: num(row.delivery_count_7d),
        last_delivery_at: row.last_delivery_at,
        active_days_7: num(row.active_days_7),
        active_days_30: num(row.active_days_30),
        last_activity_at: row.last_activity_at,
        days_since_activity: daysSince(row.last_activity_at),
        score,
        status_key: status.key,
        status_label: status.label,
        flags: flags.flags,
        risk_reasons: flags.risk_reasons,
      };
    });

    return {
      generated_at: new Date().toISOString(),
      summary: {
        total_bairristas: members.length,
        extreme: members.filter((m) => m.status_key === "extreme").length,
        active: members.filter((m) => m.status_key === "active").length,
        irregular: members.filter((m) => m.status_key === "irregular").length,
        inactive: members.filter((m) => m.status_key === "inactive").length,
        critical: members.filter((m) => m.status_key === "critical").length,
        never_portal: members.filter((m) => !m.portal_created_at).length,
        never_order: members.filter((m) => m.order_count === 0).length,
        never_delivery: members.filter((m) => m.delivery_count === 0).length,
        no_activity_7d: members.filter((m) => m.days_since_activity == null || m.days_since_activity > 7).length,
        no_activity_14d: members.filter((m) => m.days_since_activity == null || m.days_since_activity >= 14).length,
      },
      members,
    };
  });
