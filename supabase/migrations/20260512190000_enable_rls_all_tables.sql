-- Enable RLS on ALL public tables that lack it.
-- The web app and bot access data via service-role (pgQuery/exec_sql) and
-- Pooler — both bypass RLS.  The ONLY client-side Supabase queries are to
-- profiles / user_roles (already have policies).  Therefore enabling RLS
-- with NO policies on the other tables is safe: it blocks anonymous and
-- authenticated users from direct REST access while leaving server-side
-- operations untouched.

alter table public.app_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.bot_instances enable row level security;
alter table public.bot_messages enable row level security;
alter table public.bot_state enable row level security;
alter table public.circuit_state enable row level security;
alter table public.craft_recipes enable row level security;
alter table public.delivery_batches enable row level security;
alter table public.inventory_balance enable row level security;
alter table public.item_price_history enable row level security;
alter table public.incidents enable row level security;
alter table public.inventory_delivery_requests enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.kill_logs enable row level security;
alter table public.items enable row level security;
alter table public.job_runs enable row level security;
alter table public.leaderboard_messages enable row level security;
alter table public.member_lifecycle_history enable row level security;
alter table public.member_pvp_ratings enable row level security;
alter table public.member_role_history enable row level security;
alter table public.pending_notifications enable row level security;
alter table public.price_list_messages enable row level security;
alter table public.schema_migrations enable row level security;
alter table public.spot_cooldowns enable row level security;
alter table public.stock_v3_pricing enable row level security;
alter table public.sync_retries enable row level security;
alter table public.all_time_stats enable row level security;
alter table public.availability_slots enable row level security;
alter table public.member_saida_stats enable row level security;
alter table public.monthly_rankings enable row level security;
alter table public.order_status_history enable row level security;
alter table public.saida_countdowns enable row level security;
alter table public.spot_stats enable row level security;
alter table public.weekly_rankings enable row level security;
alter table public.archival_log enable row level security;
alter table public.availability_sessions enable row level security;
alter table public.availability_votes enable row level security;
alter table public.managed_topic_categories enable row level security;
alter table public.member_absences enable row level security;
alter table public.members enable row level security;
alter table public.operation_materials enable row level security;
alter table public.operations enable row level security;
alter table public.orders enable row level security;
alter table public.radio_history enable row level security;
alter table public.radio_state enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.resident_channels enable row level security;
alter table public.session_carts enable row level security;
alter table public.sheet_sync_state enable row level security;
alter table public.sticky_messages enable row level security;
alter table public.stock_v3_movements enable row level security;
alter table public.tag_requests enable row level security;
alter table public.weekly_prizes enable row level security;
alter table public.operation_participants enable row level security;
