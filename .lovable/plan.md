
## Reality check first

The repo (`real-gangsta-bot` / "Bot di Zona") is large and mature:
- ~42,000 lines of JS, 90 SQL migrations, 422 tests
- Deeply Discord-coupled: panels, modals, slash commands, role-gated flows
- Domains: onboarding (tag_requests), members & hierarchy, inventory ledger + materialized balance, orders & carts, saídas/PvP with liquidation, cemetery, weekly tops, daily availability, radio, audit, sticky messages, weekly prizes, tasks/reputation/absences, Google Sheets sync, notification queue, sync DLQ.

**Full parity ≠ one build.** I will deliver this in clearly-scoped phases. Each phase ships a usable web app; later phases extend it. This plan describes Phase 0 → Phase 1 in detail and outlines Phases 2–5 so we agree on the trajectory.

## Heads-up on your three choices

1. **Discord OAuth.** Lovable Cloud (Supabase under the hood) doesn't expose Discord as a managed provider. To use Discord login I'll enable Lovable Cloud, then you'll enable the Discord provider in the Supabase dashboard (Auth → Providers → Discord) using a Discord application's Client ID/Secret. I'll wire the rest. If you don't want to create a Discord app, fall back to email/password + linking a Discord ID later.
2. **Connect to existing Railway PG.** Doable: server functions will connect via `pg` using a `DATABASE_URL` secret. Trade-off: that DB is not Supabase, so we **cannot use Supabase RLS** on it. Authorization is enforced in server functions (session + role check) before every query. Lovable Cloud's own DB will only hold the auth users + a small `discord_links` table mapping `auth.users.id` → `members.discord_id`.
3. **Web-first, Discord notifications.** I'll add a small Node "notifier" service (separate process, runs on Railway alongside the existing bot or replaces parts of it) that watches a `pending_notifications` table and posts embeds to Discord. Web app writes notifications by inserting rows; no Discord SDK in the web runtime (Worker can't host a gateway connection anyway).

---

## Phase 0 — Foundation (this build)

Goal: project boots, you can log in with Discord, see your role, and reach a placeholder dashboard pulling live data from Railway PG.

1. Enable Lovable Cloud.
2. Add secrets: `DATABASE_URL` (Railway PG, read/write), `DISCORD_GUILD_ID`.
3. You enable Discord provider in Supabase dashboard (I'll give exact steps + redirect URLs). Required scopes: `identify`, `guilds.members.read`.
4. Create `discord_links` table in Lovable Cloud DB (auth user ↔ discord_id).
5. `pg` pool helper for Railway PG (server-only, `src/lib/pg.server.ts`).
6. Auth context + `_authenticated` route guard. After Discord login, server fn upserts `discord_links` and resolves the matching row in Railway `members` to derive role (chefia / oficial / patrao / bairrista tier).
7. Layout shell: top nav (Dashboard, Membros, Inventário, Operações, Cemitério, Tops, Rádio, Admin), role-aware visibility, PT-PT copy matching the bot's tone.
8. Dashboard page: live KPIs from Railway PG (total bairristas por tier, stock total, saídas em aberto, top 3 da semana).

Design direction: bairro/firma aesthetic — dark, high-contrast, slab display font + clean sans body, red accent (RedWood). I'll generate 3 directions before building if you want — say the word.

---

## Phase 1 — Read-only parity for core domains

Deliver pages that show, but don't yet mutate, the most-used data so the org can start using the web app immediately for visibility:

- **Membros**: list, filter by tier/role, member detail (history, ledger contributions, saídas, kills, weekly score)
- **Inventário**: stock por casa (uses `inventory_balance`), catálogo com preços, ledger com filtros (tipo, membro, data)
- **Operações / Saídas**: lista por estado (planeada / em curso / em_liquidacao / fechada), detalhe com participantes, scoring, MVP
- **Cemitério**: feed de kills com filtros
- **Tops**: semanal + mensal + all-time (rankings tables)
- **Catálogo & preços**: tabela editável só por chefia (read-only nesta fase)
- **Rádio**: estado actual (principal + parceria, history)

---

## Phase 2 — Write flows (the real work)

Replicates bot interactions as web forms, each gated by role:

- Onboarding: novo `tag_request` → aprovação chefia → cria `member` + emite notificação Discord para criar canal/role (notifier handles Discord side)
- Inventário: lançamento de movimentos (entrega_bairrista, venda_bairrista, fornecimento_org, ajuste_manual, perda, apreendido, craftado), com `pg_advisory_xact_lock` por membro
- Carrinho do bairrista: multi-item cart com session store, entrega atómica
- Encomendas (`orders`) com pricing e ingredients_json, history
- Saídas: criar → inscrição → fechar → liquidação (form por participante: sobreviveu, kills, arma devolvida) → finalizar → publica embeds via notifier
- Cemitério: `/kill` equivalente como modal web
- Disponibilidade diária: grelha slots × estados
- Promoções automáticas: job server-side respeitando os thresholds (`PROMO_*` env)

---

## Phase 3 — Admin & ops

- Painel chefia: aprovações pendentes (tags, delivery requests), incidentes, modo manutenção
- Catálogo: editar preços + price_history
- Craft recipes editor
- Stock alerts config
- Weekly prizes
- Tasks / reputação / absences
- Audit log viewer
- Job lease & circuit state visibility
- Notification queue inspector + retries

---

## Phase 4 — Discord notifier service & integrations

- Small Node service (lives in `services/notifier/`, deployable to Railway) that:
  - Subscribes to `pending_notifications` (LISTEN/NOTIFY)
  - Posts the bot's existing embeds (reusing `src/discord/embeds` from the original repo)
  - Handles role mutations (add Bairristas + tier role on approval), channel creation in GUETTO
- Decommission overlapping bot panels (web becomes source of truth)
- Google Sheets sync moved to a server function on a schedule (uses Sheets connector); DLQ visible in admin

---

## Phase 5 — Polish & hardening

- Realtime updates (poll or Postgres LISTEN bridge) so dashboards refresh
- Mobile layout pass for every screen
- Performance: query review using existing indexes, server-side pagination
- Test pass on critical write paths
- Published URL hardening, role-based 403 pages, audit of every server fn

---

## Technical details (for the technical reader)

**Stack**
- TanStack Start (already scaffolded), React 19, Tailwind v4, shadcn
- Lovable Cloud (Supabase) for **auth only** + `discord_links` table
- Existing Railway PostgreSQL accessed via `pg` from server functions (`src/lib/pg.server.ts`, single pool, `process.env.DATABASE_URL`)
- All DB access through `createServerFn` with a `requireRole` middleware that:
  1. validates Supabase session
  2. looks up `discord_links` → `members.discord_id` → role/tier in Railway PG
  3. enforces required role for the call
- No RLS on Railway PG; authorization is centralized in middleware + per-fn checks
- Notifier: separate Node process, NOT in the Worker (Worker can't hold a Discord gateway connection)

**File layout (Phase 0/1)**
```
src/
  lib/
    pg.server.ts              # Railway pg Pool
    auth.ts                   # client auth context
    roles.ts                  # role/tier enums + helpers
    members.functions.ts
    inventory.functions.ts
    saidas.functions.ts
    rankings.functions.ts
  routes/
    __root.tsx
    index.tsx                 # marketing/landing → redirect if logged in
    login.tsx
    _authenticated.tsx        # guard
    _authenticated/
      dashboard.tsx
      membros.tsx
      membros.$id.tsx
      inventario.index.tsx
      inventario.ledger.tsx
      operacoes.index.tsx
      operacoes.$id.tsx
      cemiterio.tsx
      tops.tsx
      radio.tsx
      admin.tsx               # role: chefia
  components/
    layout/{TopNav,Shell}.tsx
    domain/...                # MemberCard, StockTable, SaidaCard, etc.
```

**Secrets needed (Phase 0)**
- `DATABASE_URL` — Railway PG (you provide)
- `DISCORD_GUILD_ID` — to scope the `guilds.members.read` lookup
- Discord OAuth Client ID/Secret — pasted into Supabase dashboard, not as Lovable secrets

**Out of scope for this build**
- Phases 2–5 are described above but will be separate builds.
- I will not modify the existing bot repo. The notifier in Phase 4 will be a new sibling project.

---

## What I need from you to start Phase 0

1. Confirm phased delivery is OK (i.e. Phase 0 + 1 first; not "everything in one go").
2. Confirm you can create a Discord application and paste Client ID/Secret into the Supabase dashboard when prompted.
3. The Railway `DATABASE_URL` (I'll request it as a secret — don't paste it in chat).
4. Your `DISCORD_GUILD_ID` (the server/guild numeric ID).
5. (Optional) Say "yes design directions" if you want me to generate 3 visual directions before I start building Phase 0.
