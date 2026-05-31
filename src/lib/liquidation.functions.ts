import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { enqueueNotification } from "./notifier.server";
import { resolveCurrentMember } from "./pricing.server";

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
    was_profitable: boolean | null;
    enemy_name: string | null;
    enemy_faction: string | null;
    had_fight: boolean | null;
    survivors: number | null;
    deaths: number | null;
    our_kills: number | null;
  };
  participants: Array<{
    id: number;
    member_id: number;
    member_name: string | null;
    role_in_op: string | null;
    kills: number;
    deaths_count: number;
    survived: boolean;
    died: boolean;
    issued_value: number;
    returned_value: number;
    lost_value: number;
    net_material_delta: number;
    settled: boolean;
    participant_type: string;
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
    const id = Number(d?.id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("id inválido");
    return { id };
  })
  .handler(async ({ data }): Promise<SaidaDetail | null> => {
    const op = await pgOne<SaidaDetail["operation"]>(
      `select o.id, o.operation_type, o.spot, coalesce(o.status,'criada') as status,
              coalesce(o.start_time,(o.date::timestamp + coalesce(o.scheduled_time,'00:00'::time))) as scheduled_at,
              o.leader_id, o.notes,
              coalesce(o.supplied_value,0)::float as supplied_value,
              coalesce(o.returned_value,0)::float as returned_value,
              coalesce(o.lost_value,0)::float as lost_value,
              coalesce(o.consumed_value,0)::float as consumed_value,
              coalesce(o.gross_value,0)::float as gross_value,
              coalesce(o.net_value,0)::float as net_value,
              o.was_profitable,
              o.enemy_name,
              o.enemy_faction,
              o.had_fight,
              o.survivors,
              o.deaths,
              o.our_kills
         from operations o
        where o.id = $1 and o.deleted_at is null`,
      [data.id],
    );
    if (!op) return null;
    const participants = await pgQuery<SaidaDetail["participants"][number]>(
      `select p.id, p.member_id, m.display_name as member_name, p.role_in_op,
              coalesce(p.kills,0) as kills, coalesce(p.deaths_count,0) as deaths_count,
              coalesce(p.survived, false) as survived, coalesce(p.died, false) as died,
              coalesce(p.issued_value,0)::float as issued_value,
              coalesce(p.returned_value,0)::float as returned_value,
              coalesce(p.lost_value,0)::float as lost_value,
              coalesce(p.net_material_delta,0)::float as net_material_delta,
              coalesce(p.settled, false) as settled,
              coalesce(p.participant_type, 'caracterizado') as participant_type
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
 * Fecho financeiro de uma saída/operação.
 * Mantido porque a página de operações ainda chama esta server function para
 * fechar resultados e atualizar estatísticas da saída.
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
    // Atomic close via stored procedure
    const result = await pgOne<{
      supplied: number;
      returned: number;
      lost: number;
      consumed: number;
      gross: number;
      net: number;
      operation_type: string | null;
      spot: string | null;
    }>(
      `SELECT * FROM public.sp_liquidate_saida($1, $2)`,
      [data.id, `web:${context.userId}`],
    );

    if (!result) throw new Error("Falha na liquidação");

    await enqueueNotification({
      dedupKey: `operation_closed:${data.id}`,
      embed: {
        title: `Saída #${data.id} fechada`,
        description: `${result.operation_type ?? "Saída"} · ${result.spot ?? "—"}\nLíquido: ${result.net.toFixed(0)} €`,
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
