import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const tables = [
  "all_time_stats",
  "weekly_rankings",
  "operations",
  "operation_participants",
  "kill_logs",
  "inventory_movements",
  "inventory_balance",
  "orders",
  "order_status_history",
  "order_comments",
  "items",
  "craft_recipes",
  "recipe_ingredients",
  "weekly_prizes",
  "notifications",
  "audit_logs",
  "tag_requests",
  "user_roles",
  "profiles",
];

async function main() {
  for (const t of tables) {
    const { error } = await (supabase as any).rpc("exec_sql", {
      sql_query: `alter publication supabase_realtime add table public.${t}`,
    });
    if (error) {
      if (String(error.message).includes("already")) {
        console.log(`OK (already): ${t}`);
      } else {
        console.log(`ERR: ${t} — ${error.message}`);
      }
    } else {
      console.log(`OK: ${t}`);
    }
  }
}

main();
