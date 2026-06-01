import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { fetchGuildMembers, detectMemberRole, pickDisplayName } from "./discord-api.server";
import { logger } from "./logger.server";
import { logAdminAction } from "./logging.functions";

export const syncDiscordMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const guildMembers = await fetchGuildMembers();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let deactivated = 0;
    const errors: string[] = [];
    const detectedDiscordIds = new Set<string>();

    for (const [, gm] of guildMembers) {
      const detected = detectMemberRole(gm.roles);
      if (!detected) continue;
      detectedDiscordIds.add(gm.user.id);

      try {
        const existing = await pgOne<{ id: number; role: string | null; tier: string | null; display_name: string | null; deleted_at: string | null }>(
          `select id, role, tier, display_name, deleted_at from members where discord_id = $1 order by id desc limit 1`,
          [gm.user.id],
        );

        const displayName = pickDisplayName(gm);
        const username = gm.user.username;

        if (!existing) {
          await pgQuery(
            `insert into members
              (discord_id, username, display_name, role, tier, status, joined_at, lifecycle_state, created_at, updated_at)
             values ($1, $2, $3, $4, $5, 'ativo', now(), 'active', now(), now())`,
            [gm.user.id, username, displayName, detected.role, detected.tier || "young_blood"],
          );
          created++;
        } else if (existing.deleted_at != null) {
          await pgQuery(
            `update members
             set deleted_at = null,
                 status = 'ativo',
                 lifecycle_state = 'active',
                 role = $2,
                 tier = $3,
                 display_name = $4,
                 username = $5,
                 updated_at = now()
             where id = $1`,
            [existing.id, detected.role, detected.tier || existing.tier || "young_blood", displayName, username],
          );
          updated++;
        } else {
          const changes: string[] = [];
          if (existing.role !== detected.role) changes.push("role");
          if (existing.tier !== detected.tier && detected.tier) changes.push("tier");
          if (existing.display_name !== displayName) changes.push("display_name");

          if (changes.length > 0) {
            await pgQuery(
              `update members
               set role = $2,
                   tier = coalesce($3, tier),
                   display_name = $4,
                   username = $5,
                   status = 'ativo',
                   lifecycle_state = 'active',
                   updated_at = now()
               where id = $1`,
              [existing.id, detected.role, detected.tier || existing.tier, displayName, username],
            );
            updated++;
          } else {
            unchanged++;
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn("sync_member_failed", { discord_id: gm.user.id, error: msg });
        errors.push(`${gm.user.id}: ${msg}`);
      }
    }

    try {
      const activeRows = await pgQuery<{ id: number; discord_id: string | null; display_name: string | null }>(
        `select id, discord_id, display_name
         from members
         where deleted_at is null
           and discord_id is not null
           and coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')`,
      );

      const idsToDeactivate = activeRows
        .filter((member) => member.discord_id && !detectedDiscordIds.has(member.discord_id))
        .map((member) => member.id);

      if (idsToDeactivate.length > 0) {
        await pgQuery(
          `update members
           set status = 'inativo',
               deleted_at = now(),
               updated_at = now()
           where id = any($1::int[])
             and deleted_at is null`,
          [idsToDeactivate],
        );
        deactivated = idsToDeactivate.length;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("sync_member_deactivate_failed", { error: msg });
      errors.push(`deactivate: ${msg}`);
    }

    await logAdminAction(context.supabase, {
      action: "members_synced",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "system",
      targetId: "discord",
      details: `Sincronização Discord: ${created} criados, ${updated} atualizados, ${unchanged} inalterados, ${deactivated} desativados${errors.length > 0 ? `, ${errors.length} erros` : ""}`,
      afterState: { created, updated, unchanged, deactivated, errors: errors.slice(0, 10) },
    });

    return { created, updated, unchanged, deactivated, errors: errors.slice(0, 10) };
  });
