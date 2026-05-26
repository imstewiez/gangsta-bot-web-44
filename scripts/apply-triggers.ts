import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const sql = readFileSync("scripts/auto-recalc-triggers.sql", "utf-8");
  const { error } = await (supabase as any).rpc("exec_sql", { sql_query: sql });
  if (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
  console.log("✅ Triggers aplicados com sucesso!");
}

main();
