-- Unified logging system: app_logs table + audit_logs indexes

-- App logs: technical/system logs (errors, warnings, info)
create table if not exists public.app_logs (
  id bigserial primary key,
  level text not null check (level in ('fatal','error','warn','info','debug')),
  source text not null default 'web',
  category text not null default 'system',
  message text not null,
  metadata jsonb default '{}',
  error_stack text,
  user_id text,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_logs_level on public.app_logs(level);
create index if not exists idx_app_logs_category on public.app_logs(category);
create index if not exists idx_app_logs_source on public.app_logs(source);
create index if not exists idx_app_logs_created_at on public.app_logs(created_at desc);
create index if not exists idx_app_logs_user on public.app_logs(user_id);
create index if not exists idx_app_logs_level_created on public.app_logs(level, created_at desc);

alter table public.app_logs enable row level security;

-- Authenticated users can insert (server functions only)
create policy "Allow authenticated insert on app_logs" on public.app_logs
  for insert to authenticated with check (true);

-- Admin/chefia only can read app logs
create policy "Allow admin read app_logs" on public.app_logs
  for select to authenticated using (
    exists (
      select 1 from members m
      join profiles p on p.discord_id = m.discord_id
      where p.user_id = auth.uid()
        and m.deleted_at is null
        and (
          m.tier in ('kingpin','manda_chuva')
          or coalesce(m.role,'bairrista') in ('kingpin','manda_chuva','chefia')
        )
    )
  );

-- Audit logs indexes (if table exists, which it should)
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- Add realtime for app_logs
alter publication supabase_realtime add table public.app_logs;
