import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type PreviewOrder = {
  id: number;
  member_name: string | null;
  item_name: string | null;
  quantity: number;
  status: string;
  total_price: number | null;
  created_at: string;
  responsavel_name: string | null;
};

export type PreviewDelivery = {
  id: string;
  requester_name: string | null;
  status: string;
  tipo: string;
  total_qty: number;
  total_value: number;
  created_at: string;
};

export type MemberPreview = {
  member: {
    id: number;
    display_name: string | null;
    nick: string | null;
    tier: string | null;
    role: string | null;
    is_manager: boolean;
    is_superadmin: boolean;
  };
  orders: PreviewOrder[];
  deliveries: PreviewDelivery[];
};

export const getMemberPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: number }) => d)
  .handler(async ({ data, context }): Promise<MemberPreview> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_superadmin) throw new Error("Sem permissão — só superadmins podem usar o preview.");

    const targetId = data.member_id;

    // Dados do membro
    const member = await pgOne<{
      id: number;
      display_name: string | null;
      nick: string | null;
      tier: string | null;
      role: string | null;
      is_manager: boolean;
      is_superadmin: boolean;
    }>(
      `select id, display_name, nickname as nick, tier, role,
              ${me.is_manager} as is_manager,
              ${me.is_superadmin} as is_superadmin
       from members where id = $1 and deleted_at is null`,
      [targetId],
    );
    if (!member) throw new Error("Membro não encontrado.");

    // Encomendas do membro (como ele vê no scope "mine")
    const orders = await pgQuery<PreviewOrder>(
      `select o.id, m.display_name as member_name, i.name as item_name,
              o.quantity, o.status, o.total_price::float as total_price,
              o.created_at, mr.display_name as responsavel_name
       from orders o
       left join members m on m.id = o.member_id
       left join members mr on mr.id = o.responsavel_member_id
       left join items i on i.id = o.item_id
       where o.member_id = $1
       order by o.created_at desc
       limit 50`,
      [targetId],
    );

    // Se o membro for manager, também mostra as encomendas onde é responsável
    let managerOrders: PreviewOrder[] = [];
    if (member.is_manager) {
      managerOrders = await pgQuery<PreviewOrder>(
        `select o.id, m.display_name as member_name, i.name as item_name,
                o.quantity, o.status, o.total_price::float as total_price,
                o.created_at, mr.display_name as responsavel_name
         from orders o
         left join members m on m.id = o.member_id
         left join members mr on mr.id = o.responsavel_member_id
         left join items i on i.id = o.item_id
         where o.responsavel_member_id = $1 and o.member_id != $1
         order by o.created_at desc
         limit 50`,
        [targetId],
      );
    }

    // Entregas/vendas do membro (como ele vê no scope "mine")
    const deliveries = await pgQuery<PreviewDelivery>(
      `select r.id, m.display_name as requester_name, r.status,
              coalesce(r.tipo, 'entrega') as tipo, r.total_qty,
              r.total_value::float as total_value, r.created_at
       from inventory_delivery_requests r
       left join members m on m.id = r.requester_member_id
       where r.requester_member_id = $1 and r.tipo in ('entrega','venda')
       order by r.created_at desc
       limit 50`,
      [targetId],
    );

    // Se o membro for manager, também mostra as entregas onde é responsável
    let managerDeliveries: PreviewDelivery[] = [];
    if (member.is_manager) {
      managerDeliveries = await pgQuery<PreviewDelivery>(
        `select r.id, m.display_name as requester_name, r.status,
                coalesce(r.tipo, 'entrega') as tipo, r.total_qty,
                r.total_value::float as total_value, r.created_at
         from inventory_delivery_requests r
         left join members m on m.id = r.requester_member_id
         where r.responsavel_member_id = $1 and r.requester_member_id != $1 and r.tipo in ('entrega','venda')
         order by r.created_at desc
         limit 50`,
        [targetId],
      );
    }

    return {
      member: {
        id: member.id,
        display_name: member.display_name,
        nick: member.nick,
        tier: member.tier,
        role: member.role,
        is_manager: member.is_manager,
        is_superadmin: member.is_superadmin,
      },
      orders: [...orders, ...managerOrders],
      deliveries: [...deliveries, ...managerDeliveries],
    };
  });
