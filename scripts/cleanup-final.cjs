const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zducvbkozxtacwzvggli.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function execSql(sql) {
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
  if (error) throw error;
  return data;
}

async function main() {
  const imStewieId = 4;
  const mafarricoId = 22;
  const angelId = 15;
  const allIds = [imStewieId, mafarricoId, angelId];
  const idList = allIds.join(",");

  console.log("📊 Verificação antes de eliminar:\n");

  // 1. Orders
  const orders = await execSql(`SELECT id, member_id, (SELECT display_name FROM members WHERE id = member_id) as name FROM orders WHERE member_id IN (${idList})`);
  console.log(`orders: ${orders.length} registros`);
  if (orders.length) console.table(orders);

  // 2. Delivery requests
  const deliv = await execSql(`SELECT id, requester_member_id as member_id, (SELECT display_name FROM members WHERE id = requester_member_id) as name FROM inventory_delivery_requests WHERE requester_member_id IN (${idList})`);
  console.log(`\ninventory_delivery_requests: ${deliv.length} registros`);
  if (deliv.length) console.table(deliv);

  // 3. Movements (vendas/saidas + entrega_bairrista)
  const movs = await execSql(`
    SELECT id, member_id, movement_type, quantity, notes, created_at,
           (SELECT display_name FROM members WHERE id = member_id) as name
    FROM inventory_movements
    WHERE member_id IN (${idList})
      AND movement_type IN ('saida','venda','sale','entrega_bairrista')
    ORDER BY created_at DESC
  `);
  console.log(`\ninventory_movements (vendas/saídas/entregas): ${movs.length} registros`);
  if (movs.length) console.table(movs);

  // 4. Kills (operation_participants)
  const opKills = await execSql(`
    SELECT op.id, op.operation_id, op.member_id, op.kills, op.deaths_count, op.role_in_op,
           (SELECT display_name FROM members WHERE id = op.member_id) as name
    FROM operation_participants op
    WHERE op.member_id = ${imStewieId} AND (op.kills > 0 OR op.deaths_count > 0)
  `);
  console.log(`\noperation_participants (kills/deaths imStewie): ${opKills.length} registros`);
  if (opKills.length) console.table(opKills);

  // 5. Kill logs
  const killLogs = await execSql(`
    SELECT id, killer_id, victim_name, spot, notes, date
    FROM kill_logs WHERE killer_id IN (${idList})
  `);
  console.log(`\nkill_logs: ${killLogs.length} registros`);
  if (killLogs.length) console.table(killLogs);

  console.log("\n⚠️  A ELIMINAR DADOS...\n");

  // DELETE orders
  if (orders.length > 0) {
    const r = await execSql(`DELETE FROM orders WHERE member_id IN (${idList}) RETURNING id`);
    console.log(`✅ orders: ${r.length} eliminados`);
  } else {
    console.log("⏭️  orders: nada para eliminar");
  }

  // DELETE delivery requests
  if (deliv.length > 0) {
    const r = await execSql(`DELETE FROM inventory_delivery_requests WHERE requester_member_id IN (${idList}) RETURNING id`);
    console.log(`✅ inventory_delivery_requests: ${r.length} eliminados`);
  } else {
    console.log("⏭️  inventory_delivery_requests: nada para eliminar");
  }

  // DELETE movements (vendas/saidas/entrega_bairrista)
  if (movs.length > 0) {
    const r = await execSql(`DELETE FROM inventory_movements WHERE member_id IN (${idList}) AND movement_type IN ('saida','venda','sale','entrega_bairrista') RETURNING id`);
    console.log(`✅ inventory_movements: ${r.length} eliminados`);
  } else {
    console.log("⏭️  inventory_movements: nada para eliminar");
  }

  // RESET kills/deaths in operation_participants (imStewie)
  if (opKills.length > 0) {
    const r = await execSql(`
      UPDATE operation_participants
      SET kills = 0, deaths_count = 0, downs = 0, died = false, survived = true
      WHERE member_id = ${imStewieId} AND (kills > 0 OR deaths_count > 0)
      RETURNING id
    `);
    console.log(`✅ operation_participants: ${r.length} registros de kills/deaths zerados para imStewie`);
  } else {
    console.log("⏭️  operation_participants: nada para zerar");
  }

  // DELETE kill_logs
  if (killLogs.length > 0) {
    const r = await execSql(`DELETE FROM kill_logs WHERE killer_id IN (${idList}) RETURNING id`);
    console.log(`✅ kill_logs: ${r.length} eliminados`);
  } else {
    console.log("⏭️  kill_logs: nada para eliminar");
  }

  console.log("\n🎉 TUDO LIMPO!");
}

main().catch(e => {
  console.error("❌ ERRO:", e.message || e);
  process.exit(1);
});
