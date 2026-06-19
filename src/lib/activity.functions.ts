import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type ActivityStatusKey = "new" | "extreme" | "active" | "irregular" | "inactive" | "critical";

export type ActivityMember = {
  id: number;
  display_name: string | null;
  nickname: string | null;
  discord_id: string | null;
  tier: string | null;
  joined_at: string | null;
  days_since_joined: number | null;
  is_new_member: boolean;
  portal_created_at: string | null;
  portal_last_seen_at: string | null;
  discord_message_count_7d: number;
  discord_message_count_30d: number;
  discord_active_days_7: number;
  discord_active_days_30: number;
  last_discord_message_at: string | null;
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
    new_members: number;
    extreme: number;
    active: number;
    irregular: number;
    inactive: number;
    critical: number;
    never_portal: number;
    never_order: number;
    never_delivery: number;
    no_discord_7d: number;
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
  discord_message_count_7d: number | string | null;
  discord_message_count_30d: number | string | null;
  discord_active_days_7: number | string | null;
  discord_active_days_30: number | string | null;
  last_discord_message_at: string | null;
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
const NEW_MEMBER_GRACE_DAYS = 7;

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

function isNewMember(row: RawActivityMember): boolean {
  const joinedDays = daysSince(row.joined_at);
  return joinedDays != null && joinedDays < NEW_MEMBER_GRACE_DAYS;
}

function recencyPoints(days: number | null, max: number): number {
  if (days == null) return 0;
  if (days <= 1) return max;
  if (days <= 3) return Math.round(max * 0.85);
  if (days <= 7) return Math.round(max * 0.65);
  if (days <= 14) return Math.round(max * 0.4);
  if (days <= 30) return Math.round(max * 0.15);
  return 0;
}

function hasAnyActivity(row: RawActivityMember): boolean {
  return Boolean(row.portal_created_at)
    || num(row.order_count) > 0
    || num(row.delivery_count) > 0
    || num(row.discord_message_count_30d) > 0;
}

function buildScore(row: RawActivityMember): number {
  const portalDays = daysSince(row.portal_last_seen_at);
  const discordDays = daysSince(row.last_discord_message_at);
  const orderDays = daysSince(row.last_order_at);
  const deliveryDays = daysSince(row.last_delivery_at);
  const activityDays = daysSince(row.last_activity_at);
  const orders = num(row.order_count);
  const deliveries = num(row.delivery_count);
  const active7 = num(row.active_days_7);
  const active30 = num(row.active_days_30);
  const deliveries7 = num(row.delivery_count_7d);
  const orders7 = num(row.order_count_7d);
  const messages7 = num(row.discord_message_count_7d);
  const messages30 = num(row.discord_message_count_30d);
  const discordActive7 = num(row.discord_active_days_7);
  const discordActive30 = num(row.discord_active_days_30);

  if (!hasAnyActivity(row)) return isNewMember(row) ? 50 : 0;

  let score = isNewMember(row) ? 55 : 20;

  // Portal: contexto de uso da webapp. Não bloqueia nem destrói o score sozinho.
  score += row.portal_created_at ? 10 : 0;
  score += recencyPoints(portalDays, 7);

  // Discord: sinal de presença, com peso moderado porque o tracking começou agora.
  score += messages30 > 0 ? 8 : 0;
  score += messages7 > 0 ? 8 : 0;
  score += Math.min(6, Math.floor(messages7 / 10));
  score += Math.min(6, Math.round((discordActive7 / 7) * 6));
  score += Math.min(4, Math.round((discordActive30 / 30) * 4));
  score += recencyPoints(discordDays, 5);

  // Encomendas: atividade económica/operacional.
  score += orders > 0 ? 9 : 0;
  score += orders7 > 0 ? 7 : 0;
  score += recencyPoints(orderDays, 8);

  // Entregas: contribuição direta.
  score += deliveries > 0 ? 12 : 0;
  score += deliveries7 > 0 ? 10 : 0;
  score += Math.min(8, deliveries7 * 2);
  score += recencyPoints(deliveryDays, 10);

  // Regularidade geral.
  score += Math.min(8, Math.round((active7 / 7) * 8));
  score += Math.min(7, Math.round((active30 / 30) * 7));
  score += recencyPoints(activityDays, 6);

  // Penalização leve apenas quando existe abandono claro, e nunca em membros novos.
  if (!isNewMember(row)) {
    if (activityDays != null && activityDays > 14) score -= 10;
    if (activityDays != null && activityDays > 30) score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function classify(score: number, row: RawActivityMember): { key: ActivityStatusKey; label: string } {
  const activityDays = daysSince(row.last_activity_at);
  const anyRecent7 = num(row.discord_message_count_7d) > 0
    || num(row.order_count_7d) > 0
    || num(row.delivery_count_7d) > 0
    || (activityDays != null && activityDays <= 7);

  if (isNewMember(row)) return { key: "new", label: "Novo" };
  if (!hasAnyActivity(row)) return { key: "critical", label: "Sem atividade" };
  if (activityDays != null && activityDays > 30) return { key: "inactive", label: "Parado" };
  if (activityDays != null && activityDays > 14 && score < 55) return { key: "inactive", label: "Parado" };
  if (score >= 80) return { key: "extreme", label: "Muito ativo" };
  if (score >= 55 || anyRecent7) return { key: "active", label: "Ativo / OK" };
  return { key: "irregular", label: "Alguma atividade" };
}

function buildFlags(row: RawActivityMember): { flags: string[]; risk_reasons: string[] } {
  const flags: string[] = [];
  const risk: string[] = [];
  const lastActivity = daysSince(row.last_activity_at);
  const lastDiscord = daysSince(row.last_discord_message_at);
  const lastOrder = daysSince(row.last_order_at);
  const lastDelivery = daysSince(row.last_delivery_at);
  const lastPortal = daysSince(row.portal_last_seen_at);
  const joinedDays = daysSince(row.joined_at);

  if (isNewMember(row)) {
    flags.push(`Novo — entrou há ${joinedDays ?? 0} dias`);
    flags.push("Não conta para inatividade ainda");
    return { flags, risk_reasons: risk };
  }

  if (!hasAnyActivity(row)) {
    flags.push("Sem atividade de todo");
    risk.push("sem portal, Discord, encomendas ou entregas registadas");
    return { flags, risk_reasons: risk };
  }

  if (!row.portal_created_at) flags.push("Nunca entrou no portal");
  else if (lastPortal != null && lastPortal > 14) flags.push(`Portal parado há ${lastPortal} dias`);

  if (!row.last_discord_message_at) flags.push("Sem mensagens registadas");
  else if (lastDiscord != null && lastDiscord > 14) flags.push(`Sem mensagens há ${lastDiscord} dias`);

  if (num(row.order_count) === 0) flags.push("Nunca fez encomenda");
  else if (lastOrder != null && lastOrder > 14) flags.push(`Sem encomendas há ${lastOrder} dias`);

  if (num(row.delivery_count) === 0) flags.push("Nunca fez entrega");
  else if (lastDelivery != null && lastDelivery > 14) flags.push(`Sem entregas há ${lastDelivery} dias`);

  if (lastActivity != null && lastActivity > 7) flags.push(`Última atividade há ${lastActivity} dias`);
  if (num(row.active_days_7) === 0) flags.push("0 dias ativos em 7 dias");

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
       ), discord_agg as (
         select d.discord_id,
                coalesce(sum(d.message_count) filter (where d.activity_date >= current_date - 6), 0)::int as discord_message_count_7d,
                coalesce(sum(d.message_count) filter (where d.activity_date >= current_date - 29), 0)::int as discord_message_count_30d,
                count(distinct d.activity_date) filter (where d.activity_date >= current_date - 6)::int as discord_active_days_7,
                count(distinct d.activity_date) filter (where d.activity_date >= current_date - 29)::int as discord_active_days_30,
                max(d.last_message_at) as last_discord_message_at
         from discord_member_daily_activity d
         group by d.discord_id
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
         select b.id as member_id, da.last_discord_message_at as at
         from bairristas b
         join discord_agg da on da.discord_id = b.discord_id
         where da.last_discord_message_at is not null
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
              coalesce(da.discord_message_count_7d, 0)::int as discord_message_count_7d,
              coalesce(da.discord_message_count_30d, 0)::int as discord_message_count_30d,
              coalesce(da.discord_active_days_7, 0)::int as discord_active_days_7,
              coalesce(da.discord_active_days_30, 0)::int as discord_active_days_30,
              da.last_discord_message_at,
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
       left join discord_agg da on da.discord_id = b.discord_id
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
      const joinedDays = daysSince(row.joined_at);
      return {
        id: row.id,
        display_name: row.display_name,
        nickname: row.nickname,
        discord_id: row.discord_id,
        tier: row.tier,
        joined_at: row.joined_at,
        days_since_joined: joinedDays,
        is_new_member: isNewMember(row),
        portal_created_at: row.portal_created_at,
        portal_last_seen_at: row.portal_last_seen_at,
        discord_message_count_7d: num(row.discord_message_count_7d),
        discord_message_count_30d: num(row.discord_message_count_30d),
        discord_active_days_7: num(row.discord_active_days_7),
        discord_active_days_30: num(row.discord_active_days_30),
        last_discord_message_at: row.last_discord_message_at,
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

    const eligible = members.filter((m) => !m.is_new_member);

    return {
      generated_at: new Date().toISOString(),
      summary: {
        total_bairristas: members.length,
        new_members: members.filter((m) => m.is_new_member).length,
        extreme: eligible.filter((m) => m.status_key === "extreme").length,
        active: eligible.filter((m) => m.status_key === "active").length,
        irregular: eligible.filter((m) => m.status_key === "irregular").length,
        inactive: eligible.filter((m) => m.status_key === "inactive").length,
        critical: eligible.filter((m) => m.status_key === "critical").length,
        never_portal: eligible.filter((m) => !m.portal_created_at).length,
        never_order: eligible.filter((m) => m.order_count === 0).length,
        never_delivery: eligible.filter((m) => m.delivery_count === 0).length,
        no_discord_7d: eligible.filter((m) => !m.last_discord_message_at || daysSince(m.last_discord_message_at) > 7).length,
        no_activity_7d: eligible.filter((m) => m.days_since_activity == null || m.days_since_activity > 7).length,
        no_activity_14d: eligible.filter((m) => m.days_since_activity == null || m.days_since_activity >= 14).length,
      },
      members,
    };
  });
