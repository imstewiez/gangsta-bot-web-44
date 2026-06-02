-- Remove da listagem ativa qualquer registo antigo que já não tenha tier/cargo operacional da Ballas.
-- Não apaga histórico; apenas marca como inativo/removido para deixar de aparecer na webapp.

UPDATE public.members
SET role = 'inativo',
    status = 'inativo',
    lifecycle_state = 'removed',
    lifecycle_changed_at = now(),
    lifecycle_changed_by = 'system:non-org-repair',
    lifecycle_notes = 'Removido automaticamente: sem cargo operacional da Ballas',
    deleted_at = now(),
    channel_id = null,
    updated_at = now()
WHERE deleted_at IS NULL
  AND coalesce(lifecycle_state::text, status, 'active') IN ('active','ativo','promoted')
  AND coalesce(tier, role, '') NOT IN (
    'young_blood',
    'o_gunao',
    'gangster_fodido',
    'patrao_di_zona',
    'real_gangster',
    'og',
    'kingpin',
    'manda_chuva'
  );
