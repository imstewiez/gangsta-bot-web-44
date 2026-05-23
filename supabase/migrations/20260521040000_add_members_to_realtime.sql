-- Adicionar members à publicação realtime para useRealtimeSync funcionar
alter publication supabase_realtime add table public.members;
