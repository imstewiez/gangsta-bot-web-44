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
  console.log("🔍 Verificando membros com nomes parecidos...\n");

  const members = await execSql(`
    SELECT id, display_name, username, nickname, role, status
    FROM members
    WHERE LOWER(display_name) ILIKE '%angel%'
       OR LOWER(username) ILIKE '%angel%'
       OR LOWER(nickname) ILIKE '%angel%'
       OR LOWER(display_name) ILIKE '%power%'
       OR LOWER(username) ILIKE '%power%'
       OR LOWER(nickname) ILIKE '%power%'
    ORDER BY display_name
  `);
  console.log("Possíveis 'Angel Power':");
  console.table(members);

  console.log("\n🔍 Verificando kills do imStewie em outras tabelas...\n");

  const imstewieId = 4;

  const killsOp = await execSql(`
    SELECT COUNT(*)::int as total FROM operation_participants WHERE member_id = ${imstewieId} AND kills > 0
  `);
  console.log("operation_participants kills:", killsOp[0]);

  const killsLog = await execSql(`
    SELECT id, victim_name, spot, notes, date, created_at FROM kill_logs WHERE killer_id = ${imstewieId} ORDER BY created_at DESC
  `);
  console.log("kill_logs:", killsLog.length, "registros");
  if (killsLog.length > 0) console.table(killsLog);

  console.log("\n🔍 Verificando vendas/saídas do imStewie em outras tabelas...\n");

  const movements = await execSql(`
    SELECT movement_type, COUNT(*)::int as total
    FROM inventory_movements
    WHERE member_id = ${imstewieId}
    GROUP BY movement_type
  `);
  console.log("inventory_movements (todos os tipos):");
  console.table(movements);

  const salesAll = await execSql(`
    SELECT id, movement_type, item_id, quantity, created_at, notes
    FROM inventory_movements
    WHERE member_id = ${imstewieId}
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log("\nÚltimos movimentos do imStewie:");
  console.table(salesAll);
}

main().catch(e => {
  console.error("❌ ERRO:", e.message || e);
  process.exit(1);
});
