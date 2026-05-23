const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zducvbkozxtacwzvggli.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY não definida. Correr com: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-data.js");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function execSql(sql) {
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
  if (error) throw error;
  return data;
}

async function main() {
  console.log("🔍 A procurar membros...\n");

  // 1. Encontrar os member_id
  const membersSql = `
    SELECT id, display_name, username, nickname
    FROM members
    WHERE LOWER(display_name) ILIKE '%imstewie%'
       OR LOWER(username) ILIKE '%imstewie%'
       OR LOWER(nickname) ILIKE '%imstewie%'
       OR LOWER(display_name) ILIKE '%angel%power%'
       OR LOWER(username) ILIKE '%angel%power%'
       OR LOWER(nickname) ILIKE '%angel%power%'
       OR LOWER(display_name) ILIKE '%mafarrico%'
       OR LOWER(username) ILIKE '%mafarrico%'
       OR LOWER(nickname) ILIKE '%mafarrico%'
    ORDER BY display_name
  `;

  const members = await execSql(membersSql);
  console.log("Membros encontrados:");
  console.table(members);

  if (!members || members.length === 0) {
    console.log("❌ Nenhum membro encontrado.");
    return;
  }

  const memberIds = members.map(m => m.id).join(",");
  const names = members.map(m => m.display_name || m.username || m.nickname).join(", ");
  console.log(`\n📋 IDs: ${memberIds}\n`);

  // 2. Contar o que vai ser eliminado
  console.log("📊 Contagem antes de eliminar:\n");

  const counts = await execSql(`
    SELECT
      (SELECT COUNT(*)::int FROM orders WHERE member_id IN (${memberIds})) as orders,
      (SELECT COUNT(*)::int FROM inventory_delivery_requests WHERE requester_member_id IN (${memberIds})) as deliveries,
      (SELECT COUNT(*)::int FROM inventory_movements WHERE member_id IN (${memberIds}) AND movement_type IN ('saida','venda','sale')) as sales,
      (SELECT COUNT(*)::int FROM kill_logs WHERE killer_id IN (${memberIds})) as kills
  `);

  console.log(counts[0]);

  // 3. ELIMINAR
  console.log("\n⚠️  A ELIMINAR DADOS...\n");

  // Orders
  if (counts[0].orders > 0) {
    const delOrders = await execSql(`DELETE FROM orders WHERE member_id IN (${memberIds}) RETURNING id`);
    console.log(`✅ orders: ${delOrders.length} eliminados`);
  } else {
    console.log("⏭️  orders: nada para eliminar");
  }

  // Delivery requests
  if (counts[0].deliveries > 0) {
    const delDeliv = await execSql(`DELETE FROM inventory_delivery_requests WHERE requester_member_id IN (${memberIds}) RETURNING id`);
    console.log(`✅ inventory_delivery_requests: ${delDeliv.length} eliminados`);
  } else {
    console.log("⏭️  inventory_delivery_requests: nada para eliminar");
  }

  // Sales/movements
  if (counts[0].sales > 0) {
    const delSales = await execSql(`DELETE FROM inventory_movements WHERE member_id IN (${memberIds}) AND movement_type IN ('saida','venda','sale') RETURNING id`);
    console.log(`✅ inventory_movements (vendas/saídas): ${delSales.length} eliminados`);
  } else {
    console.log("⏭️  inventory_movements (vendas/saídas): nada para eliminar");
  }

  // Kills (imStewie)
  if (counts[0].kills > 0) {
    const delKills = await execSql(`DELETE FROM kill_logs WHERE killer_id IN (${memberIds}) RETURNING id`);
    console.log(`✅ kill_logs: ${delKills.length} eliminados`);
  } else {
    console.log("⏭️  kill_logs: nada para eliminar");
  }

  console.log("\n🎉 LIMPO!");
}

main().catch(e => {
  console.error("❌ ERRO:", e.message || e);
  process.exit(1);
});
