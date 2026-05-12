import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne, withClient } from "./pg.server";
import { enqueueNotification } from "./notifier.server";
import { resolveCurrentMember } from "./pricing.server";

export type UnfinalizedSaida = {
  id: number;
  operation_type: string | null;
  spot: string | null;
  status: string;
  scheduled_at: string | null;
  participants: number;
};

export const listUnfinalizedSaidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<UnfinalizedSaida[]> => {
    return pgQuery<UnfinalizedSaida>(
      `select o.id, o.operation_type, o.spot,
              coalesce(o.status, 'planeada') as status,
              coalesce(o.start_time, (o.date::timestamp + coalesce(o.scheduled_time, '00:00'::time))) as scheduled_at,
              (select count(*)::int from operation_participants p where p.operation_id = o.id) as participants
         from operations o
        where o.deleted_at is null
          and (o.status is null or o.status not in ('finalizada','cancelada'))
        order by coalesce(o.start_time, o.date::timestamp, o.created_at) desc
        limit 100`,
    );
  });

export type SaidaDetail = {
  operation: {
    id: number;
    operation_type: string | null;
    spot: string | null;
    status: string;
    scheduled_at: string | null;
    leader_id: number | null;
    notes: string | null;
    supplied_value: number;
    returned_value: number;
    lost_value: number;
    consumed_value: number;
    gross_value: number;
    net_value: number;
  };
  participants: Array<{
    id: number;
    member_id: number;
    member_name: string | null;
    role_in_op: string | null;
    kills: number;
    deaths_count: number;
    issued_value: number;
    returned_value: number;
    lost_value: number;
    net_material_delta: number;
    settled: boolean;
  }>;
  materials: Array<{
    id: number;
    item_id: number;
    item_name: string | null;
    direction: string;
    quantity: number;
    member_id: number | null;
  }>;
};

export const getSaidaDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => {
    if (!Number.isFinite(d.id)) throw new Error("id inválido");
    return d;
  })
  .handler(async ({ data }): Promise<SaidaDetail | null> => {
    const op = await pgOne<SaidaDetail["operation"]>(
      `select o.id, o.operation_type, o.spot, coalesce(o.status,'planeada') as status,
              coalesce(o.start_time,(o.date::timestamp + coalesce(o.scheduled_time,'00:00'::time))) as scheduled_at,
              o.leader_id, o.notes,
              coalesce(o.supplied_value,0)::float as supplied_value,
              coalesce(o.returned_value,0)::float as returned_value,
              coalesce(o.lost_value,0)::float as lost_value,
              coalesce(o.consumed_value,0)::float as consumed_value,
              coalesce(o.gross_value,0)::float as gross_value,
              coalesce(o.net_value,0)::float as net_value
         from operations o
        where o.id = $1 and o.deleted_at is null`,
      [data.id],
    );
    if (!op) return null;
    const participants = await pgQuery<SaidaDetail["participants"][number]>(
      `select p.id, p.member_id, m.display_name as member_name, p.role_in_op,
              coalesce(p.kills,0) as kills, coalesce(p.deaths_count,0) as deaths_count,
              coalesce(p.issued_value,0)::float as issued_value,
              coalesce(p.returned_value,0)::float as returned_value,
              coalesce(p.lost_value,0)::float as lost_value,
              coalesce(p.net_material_delta,0)::float as net_material_delta,
              coalesce(p.settled, false) as settled
         from operation_participants p
         left join members m on m.id = p.member_id
        where p.operation_id = $1
        order by p.id`,
      [data.id],
    );
    const materials = await pgQuery<SaidaDetail["materials"][number]>(
      `select om.id, om.item_id, i.name as item_name, om.direction, om.quantity, om.member_id
         from operation_materials om
         left join items i on i.id = om.item_id
        where om.operation_id = $1
        order by om.id`,
      [data.id],
    );
    return { operation: op, participants, materials };
  });

/**
 * Liquidação completa de uma saída:
 * - Para cada participante, calcula valores (issued / returned / lost / consumed) a partir de operation_materials
 * - Marca todos os participantes como settled
 * - Atualiza agregados na operation (supplied/returned/lost/consumed, gross e net)
 * - Marca a operação como 'finalizada' com end_time = now()
 * - Enfileira notificação Discord
 * Tudo dentro de uma única transação.
 */
export const liquidateSaida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => {
    if (!Number.isFinite(d.id)) throw new Error("id inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    const result = await withClient(async (c) => {
      await c.query("begin");
      try {
        const op = await c.query(
          `select id, operation_type, spot, status from operations where id = $1 and deleted_at is null for update`,
          [data.id],
        );
        if (!op.rows[0]) throw new Error("Saída não encontrada");
        if (op.rows[0].status === "finalizada")
          throw new Error("Saída já finalizada");

        // Aggregate per participant from operation_materials, joining unit price from items
        const perPart = await c.query(
          `select om.member_id,
                  sum(case when om.direction in ('issued','out') then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as issued_v,
                  sum(case when om.direction in ('returned','in') then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as returned_v,
                  sum(case when om.direction = 'lost' then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as lost_v,
                  sum(case when om.direction = 'consumed' then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as consumed_v
             from operation_materials om
             left join items i on i.id = om.item_id
            where om.operation_id = $1 and om.member_id is not null
            group by om.member_id`,
          [data.id],
        );

        for (const r of perPart.rows) {
          const issued = Number(r.issued_v ?? 0);
          const returned = Number(r.returned_v ?? 0);
          const lost = Number(r.lost_v ?? 0);
          const consumed = Number(r.consumed_v ?? 0);
          const net = returned - issued - lost - consumed;
          await c.query(
            `update operation_participants
                set issued_value = $1,
                    returned_value = $2,
                    lost_value = $3,
                    consumed_value = $4,
                    net_material_delta = $5,
                    settled = true
              where operation_id = $6 and member_id = $7`,
            [issued, returned, lost, consumed, net, data.id, r.member_id],
          );
        }

        // Mark every other participant as settled too
        await c.query(
          `update operation_participants set settled = true
            where operation_id = $1 and (settled is null or settled = false)`,
          [data.id],
        );

        // Aggregate totals on operation
        const tot = await c.query(
          `select coalesce(sum(issued_value),0) as supplied,
                  coalesce(sum(returned_value),0) as returned,
                  coalesce(sum(lost_value),0) as lost,
                  coalesce(sum(consumed_value),0) as consumed
             from operation_participants where operation_id = $1`,
          [data.id],
        );
        const supplied = Number(tot.rows[0].supplied);
        const returnedT = Number(tot.rows[0].returned);
        const lostT = Number(tot.rows[0].lost);
        const consumedT = Number(tot.rows[0].consumed);
        const gross = returnedT;
        const net = returnedT - supplied - lostT - consumedT;

        await c.query(
          `update operations
              set status = 'finalizada',
                  end_time = coalesce(end_time, now()),
                  liquidation_started_at = coalesce(liquidation_started_at, now()),
                  supplied_value = $1,
                  returned_value = $2,
                  lost_value = $3,
                  consumed_value = $4,
                  gross_value = $5,
                  net_value = $6,
                  was_profitable = ($6 > 0),
                  updated_at = now()
            where id = $7`,
          [supplied, returnedT, lostT, consumedT, gross, net, data.id],
        );

        await c.query(
          `insert into audit_logs (action, entity_type, entity_id, actor_id, after_state, created_at)
           values ('liquidate', 'operation', $1::text, $2,
                   jsonb_build_object('supplied', $3, 'returned', $4, 'lost', $5, 'consumed', $6, 'net', $7),
                   now())`,
          [
            data.id,
            `web:${context.userId}`,
            supplied,
            returnedT,
            lostT,
            consumedT,
            net,
          ],
        );

        await c.query("commit");
        return {
          supplied,
          returned: returnedT,
          lost: lostT,
          consumed: consumedT,
          gross,
          net,
          op: op.rows[0],
        };
      } catch (e) {
        await c.query("rollback");
        throw e;
      }
    });

    await enqueueNotification({
      embed: {
        title: `Saída #${data.id} liquidada`,
        description: `${result.op.operation_type ?? "Saída"} · ${result.op.spot ?? "—"}\nNet: ${result.net.toFixed(0)} €`,
        color: result.net >= 0 ? 0x10b981 : 0xef4444,
        fields: [
          {
            name: "Fornecido",
            value: `${result.supplied.toFixed(0)} €`,
            inline: true,
          },
          {
            name: "Retornado",
            value: `${result.returned.toFixed(0)} €`,
            inline: true,
          },
          {
            name: "Perdido",
            value: `${result.lost.toFixed(0)} €`,
            inline: true,
          },
        ],
      },
    }).catch(() => {});

    return result;
  });
