# PROJECT CONTEXT — Ballas Gang Web App

> **Para sessões limpas:** Quando iniciares uma nova sessão, lê este ficheiro inteiro antes de executar qualquer tarefa. Contém todo o contexto necessário para trabalhar no projeto sem re-exploração.

---

## 1. Visão Geral

Aplicação web de gestão de gang/facção ("Ballas Gang"). Serve como dashboard interno para membros gerirem:
- **Encomendas** de armas, munições, coletes, etc.
- **Receitas** de fabrico (craft) de armas Orange e carregadores
- **Armazém / Inventário** — stock de materiais e movimentações
- **Saídas / Operações** — missões da gang com kills, mortes, liquidação
- **Membros & Tiers** — hierarquia, promoções, estatísticas
- **Leaderboard & Prémios** — rankings semanais/mensais
- **Chefia** — dashboard administrativo com KPIs, auditoria, gestão de preços

---

## 2. Tech Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Framework** | TanStack Start (React Router + SSR) | ^1.167.50 |
| **UI** | React | ^19.2.0 |
| **Estilos** | Tailwind CSS v4 + shadcn/ui | ^4.2.1 |
| **Build** | Vite | ^7.3.1 |
| **Deploy** | Cloudflare Workers (wrangler) | ^4.14.0 |
| **Auth** | Supabase Auth + Discord OAuth | ^2.105.4 |
| **DB** | PostgreSQL via Supabase `exec_sql` RPC | — |
| **Real-time** | Supabase Realtime (postgres_changes) | — |
| **Query Client** | TanStack React Query | ^5.83.0 |
| **Validação** | Zod | ^3.24.2 |
| **Ícones** | lucide-react | ^0.575.0 |
| **Config Vite** | @lovable.dev/vite-tanstack-config | ^1.5.1 |

**NÃO usa:** Next.js, tRPC, Prisma, Drizzle, REST API próprio, WebSockets.

---

## 3. Arquitetura

```
Browser
  └── Cloudflare Worker (src/server.ts)
        ├── TanStack Start Router (SSR/SSG)
        ├── Server Functions (createServerFn)
        │     └── requireSupabaseAuth middleware
        │     └── pg.server.ts → supabaseAdmin.rpc("exec_sql")
        └── Client Assets (dist/client)

Database (PostgreSQL @ Supabase)
  ├── Auth tables (auth.users, profiles, user_roles, notifications)
  └── Game tables (members, items, orders, craft_recipes, inventory_movements,
                   operations, operation_participants, weekly_rankings, etc.)

Discord Bot (externo)
  └── Receives webhooks via discord.server.ts + notifier.server.ts
```

### Request Lifecycle
```
Browser Request
  └── Cloudflare Worker (server.ts fetch)
        ├── /api/cron/recalc ? → handle cron
        ├── old domain ? → 308 redirect
        ├── set globalThis.__cloudflareEnv
        └── TanStack Start Server Entry (SSR)
              ├── Router matches route
              ├── Server functions execute (if any)
              │     └── authedFetch attaches Bearer token
              │     └── requireSupabaseAuth validates JWT
              │     └── supabaseAdmin / pg.server.ts queries DB
              ├── React renders page
              └── Returns HTML + hydrated JS
```

---

## 4. Estrutura de Diretórios

```
src/
├── components/
│   ├── domain/           # RoleBadge, TierIcon, ItemIcon
│   ├── layout/           # AppShell, AppSidebar, GlobalSearch, PageErrorBoundary
│   ├── operations/       # SaidaWizard, SaidaTimeline, SaidaCard, SaidaStats, etc.
│   └── ui/               # shadcn/ui components (button, card, dialog, table, etc.)
├── hooks/
│   ├── useIsMobile.ts
│   ├── useKeyboardShortcuts.ts
│   └── useRealtimeSync.ts
├── integrations/
│   └── supabase/
│       ├── auth-middleware.ts   # requireSupabaseAuth
│       ├── client.ts            # Browser client
│       ├── client.server.ts     # Admin/service-role client
│       └── types.ts             # Database types (profiles, user_roles, notifications)
├── lib/
│   ├── armory.catalog.ts        # Whitelists, categorização de itens
│   ├── pricing.catalog.ts       # REAL_UNIT_COST, getTierPrice, getWeaponSalePrice
│   ├── pricing.functions.ts     # getCatalog, getCurrentMember
│   ├── pricing.server.ts        # resolveCurrentMember
│   ├── pricing.shared.ts        # isSuperAdmin, isAdmin, isManager, CurrentMember, CatalogItem
│   ├── orders.functions.ts      # CRUD + transições de estado
│   ├── recipes.functions.ts     # listRecipes, computeCraftFeasibility, computeCraftFeasibilityBatch
│   ├── inventory.functions.ts   # getStock, getLedger, adjustStock
│   ├── deliveries.functions.ts  # listDeliveries, createDelivery, decideDelivery
│   ├── operations.functions.ts  # listSaidas, createOperation, cancelOperation, inviteMembers
│   ├── liquidation.functions.ts # getSaidaDetail, liquidateSaida
│   ├── leaderboard.functions.ts # getLeaderboard
│   ├── prizes.functions.ts      # listPrizes, setPrize, generatePrizeForCurrentWeek
│   ├── members.functions.ts     # listMembers, getMember, updateMyProfile
│   ├── member-admin.functions.ts # adminRenameMember, adminSetTier, adminKickMember, adminAdjustStats
│   ├── admin.functions.ts       # assertAdmin, assertSuperAdmin, listAppUsers, setUserRole
│   ├── admin.dashboard.functions.ts # getChefiaKpis, getOrderCycles
│   ├── dashboard.functions.ts   # getHomeKpis
│   ├── data-recovery.functions.ts # doRecalcWeeklyRankings, recalcWeeklyRankings
│   ├── onboarding.functions.ts  # listTagRequests, approveTagRequest, denyTagRequest
│   ├── xp.functions.ts          # getMemberXP, getCurrentMemberXP
│   ├── auth-profile.functions.ts # ensureMemberFromProfile, getAuthProfile
│   ├── access-check.functions.ts # checkMemberAccess, checkManagerAccess, checkChefiaAccess
│   ├── pg.server.ts             # pgQuery, pgOne, withClient
│   ├── security.ts              # escapeSqlParam, IdSchema, StatusSchema
│   ├── discord.server.ts        # notifyBot
│   ├── notifier.server.ts       # enqueueNotification
│   ├── domain.ts                # TIER_LABELS, tierColor, fmtNum, fmtDate, fmtPrice
│   ├── leaderboard.config.ts    # MEDAL_ICONS
│   ├── authed-server-fn.ts      # useAuthedServerFn hook
│   ├── auth-helpers.ts          # isServer
│   ├── auth.tsx                 # AuthProvider context
│   ├── utils.ts                 # cn (tailwind-merge + clsx)
│   └── error-capture.ts         # consumeLastCapturedError
├── routes/
│   ├── __root.tsx
│   ├── index.tsx               # Landing page
│   ├── login.tsx               # Discord OAuth login
│   ├── auth.callback.tsx       # OAuth callback + ensureMemberFromProfile
│   ├── _authenticated.tsx      # Layout protegido (verifica membro ativo)
│   └── _authenticated/
│       ├── dashboard.tsx
│       ├── membros.index.tsx
│       ├── membros.$id.tsx
│       ├── operacoes.index.tsx
│       ├── operacoes.$id.tsx
│       ├── encomendas.tsx
│       ├── entregas.tsx
│       ├── inventario.tsx
│       ├── premios.tsx
│       ├── tops.tsx
│       ├── precario.tsx
│       ├── receitas.tsx
│       ├── onboarding.tsx
│       ├── auditoria.tsx
│       ├── admin.tsx             # Layout admin (verifica manager)
│       └── admin/
│           ├── dashboard.tsx
│           ├── index.tsx
│           ├── precos.tsx
│           └── receitas.tsx
├── server.ts                   # Cloudflare Worker entry (fetch + scheduled)
├── start.ts                    # TanStack Start client entry
└── styles.css                  # Global styles, CSS variables, animations
```

---

## 5. Configs Importantes

### vite.config.ts
```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: {
    build: { rollupOptions: { external: [] } },
  },
});
```
**Nota:** `@lovable.dev/vite-tanstack-config` já inclui tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare plugin, etc. NÃO adicionar manualmente.

### wrangler.jsonc
```json
{
  "name": "gangsta-bot-web",
  "compatibility_date": "2026-05-12",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/server.ts",
  "assets": { "directory": "dist/client" },
  "vars": { "SUPABASE_URL": "https://zducvbkozxtacwzvggli.supabase.co" },
  "workers_dev": true,
  "routes": [
    { "pattern": "ballasgang.eu", "custom_domain": true },
    { "pattern": "www.ballasgang.eu", "custom_domain": true }
  ],
  "triggers": { "crons": ["0 0 * * *"] }
}
```

### tsconfig.json
- Path alias: `@/` → `./src/`
- Strict mode ativo

---

## 6. Scripts (package.json)

| Script | Comando | Quando usar |
|--------|---------|-------------|
| `dev` | `vite dev` | Local development (localhost:3000) |
| `build` | `vite build` | Build para produção (dist/client + dist/server) |
| `deploy` | `vite build && wrangler deploy` | Deploy completo |
| `preview` | `wrangler dev` | Preview local com simulador Cloudflare |
| `cf-typegen` | `wrangler types` | Gerar tipos Cloudflare |
| `lint` | `eslint .` | Linting |
| `format` | `prettier --write .` | Formatação |

**Pipeline de deploy:**
```bash
npm run build    # Vite build client + server
npm run deploy   # wrangler deploy (usa dist/server/wrangler.json)
```

---

## 7. Variáveis de Ambiente

### Client-side (prefixo `VITE_`)
| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim | Anon key (browser) |

### Server-side (secrets no Cloudflare)
| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Sim | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role key (bypass RLS) |
| `CRON_SECRET` | Sim | Protege endpoint /api/cron/recalc |
| `DISCORD_BOT_URL` | Não | URL do bot Discord |
| `DISCORD_BOT_SECRET` | Não | Secret do bot |
| `DISCORD_GUILD_ID` | Não | ID do servidor Discord |

**Nota:** `DATABASE_URL` existe em `.env.example` mas NÃO é usado na aplicação. Toda a DB access é via `exec_sql` RPC.

**Como definir secrets no Cloudflare:**
```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CRON_SECRET
```

---

## 8. Autenticação & Autorização

### Fluxo de Login
1. Utilizador clica "Entrar com Discord" → `supabase.auth.signInWithOAuth({ provider: "discord" })`
2. Discord OAuth → redirect para `/auth/callback`
3. `auth.callback.tsx` chama `exchangeCodeForSession(code)`
4. Chama `ensureMemberFromProfile()` para criar `members` row se não existir
5. Redirect para `/dashboard`

### Middleware `requireSupabaseAuth`
- Valida JWT do header `Authorization: Bearer <token>`
- Injeta `{ supabase, userId, claims }` no contexto das server functions
- NÃO usa cookies nem refresh tokens

### Hierarquia de Permissões
| Tier/Role | `is_superadmin` | `is_admin` | `is_manager` | `can_see_inventory` |
|-----------|-----------------|------------|--------------|---------------------|
| `manda_chuva` | ✅ | ✅ | ✅ | ✅ |
| `kingpin` | ❌ | ✅ | ✅ | ✅ |
| `og` | ❌ | ❌ | ❌ | ✅ |
| `patrao_di_zona` | ❌ | ❌ | ✅ | ✅ |
| `real_gangster` | ❌ | ❌ | ❌ | ❌ |
| `gangster_fodido` | ❌ | ❌ | ❌ | ❌ |
| `o_gunao` | ❌ | ❌ | ❌ | ❌ |
| `young_blood` | ❌ | ❌ | ❌ | ❌ |

### Route Guards
- `/_authenticated` → verifica sessão + membro ativo
- `/admin` → verifica `is_manager`
- Páginas específicas → `checkChefiaAccess` (kingpin+) ou `checkSuperAdminAccess`

### Sincronização Discord
Quando um manager altera tier (`adminSetTier`):
- Atualiza `members.tier` e `members.role`
- Sincroniza `user_roles` (superadmin/admin)
- Envia evento para bot Discord (`promote`/`demote`/`kick`/`rename`)

---

## 9. Database Access Pattern

### `pgQuery<T>` / `pgOne<T>` (src/lib/pg.server.ts)
```ts
const rows = await pgQuery<{ id: number; name: string }>(
  `select id, name from items where active = true and category = $1`,
  [category]
);
```

**Como funciona:**
1. Recebe SQL com placeholders `$1`, `$2`, ...
2. Escapa parâmetros via `escapeSqlParam()` (security.ts)
3. Substitui placeholders de trás para frente (evita `$10` → `$1`)
4. Valida que é single-statement (split em `;` fora de strings)
5. Executa via `supabaseAdmin.rpc("exec_sql", { sql_query: query })`

**Segurança:**
- NUNCA concatenar input do utilizador diretamente no SQL
- `escapeSqlParam` rejeita null bytes, escapa quotes, valida números finitos

### `withClient`
- Interface falsa tipo `pg.Client` para código legacy
- `BEGIN`/`COMMIT`/`ROLLBACK` são no-ops (exec_sql não suporta multi-statement)

---

## 10. Lógica de Negócio Core

### Items & Catalog
- Categorias display: `armas_orange`, `armas_red`, `carregadores`, `corpos`, `prints`, `coletes`, `acessorios`
- Whitelist rigorosa em `armory.catalog.ts` — só nomes exactos aparecem
- Preços: base + surcharge por tier (armas) / preço fixo por tier (carregadores)

### Orders (Encomendas)
```
pending → approved → in_progress → ready → fulfilled
   ↘ denied         ↘ cancelled
```
- Stock decrementa em `fulfilled` (movement `venda_bairrista`)
- Batch ID agrada linhas do mesmo carrinho
- Ingredientes em `ingredients_json` (filtrados para Orange: só "Peças")

### Recipes (Receitas)
- `craft_recipes` + `recipe_ingredients`
- Orange weapons: só mostra ingredientes com "peça" no nome
- Red weapons: mostra todos os ingredientes
- `computeCraftFeasibilityBatch` agrega materiais de múltiplos items

### Inventory (Armazém)
- **Event sourcing:** `inventory_movements` (ledger imutável) → `inventory_balance` (view derivada)
- Movement types: `entrega_bairrista`, `entrega_oficial`, `venda_bairrista`, `ajuste_manual`

### Operations (Saídas)
- Estados: `criada` → `trancagem` → `em_preparacao` → `em_curso` → `em_liquidacao` → `concluida`
- Auto-close: ops com >12h em estado não-final → `concluida`
- `liquidateSaida`: calcula `fornecido`, `devolvido`, `perdido`, `consumido`, determina `was_profitable`

### Leaderboard
- Score: `material_points + sales_points + ops*5 + wins*10 + kills*3 - deaths*5`
- `weekly_rankings` recalculado diariamente via cron
- `weekly_prizes` gerado automaticamente para o #1 da semana

---

## 11. Realtime Sync

Hook `useRealtimeSync(tables)` cria canais Supabase Realtime que invalidam React Query keys quando há mudanças.

**Tabelas observadas por route:**
- `dashboard` → `members`, `orders`, `inventory_balance`
- `encomendas` → `orders`, `inventory_balance`, `inventory_delivery_requests`
- `operacoes` → `operations`
- `inventario` → `inventory` (stock/ledger)
- `tops` → `weekly_rankings`, `members`
- `receitas` → `recipes`, `recipe_items`
- `premios` → `weekly_prizes`
- `admin.dashboard` → `orders`, `inventory_balance`, `members`

---

## 12. Discord Integration

### `notifyBot` (src/lib/discord.server.ts)
POST para `DISCORD_BOT_URL` com:
- Header `x-bot-secret: DISCORD_BOT_SECRET`
- Body: evento + `guild_id` + timestamp
- Timeout: 3s

**Eventos:** `rename`, `promote`, `demote`, `kick`, `prize_defined`, `prize_delivered`

### `enqueueNotification` (src/lib/notifier.server.ts)
Insere na tabela `pending_notifications` (DB). Bot externo faz polling.

---

## 13. Cron Jobs

**Trigger:** Diário à meia-noite (`0 0 * * *`)
**Handler:** `src/server.ts` → `doRecalcWeeklyRankings()`
**Ação:**
1. Recalcula `weekly_rankings` para semanas recentes
2. Gera `weekly_prizes` para o #1 da semana mais recente (status `por_definir`)

**Endpoint manual:** `POST /api/cron/recalc` com header `x-cron-secret`

---

## 14. Convenções de Código

### Server Functions
- Todas as funções server usam `createServerFn` com `.middleware([requireSupabaseAuth])`
- Nomes em camelCase: `listOrders`, `createOrder`, `transitionOrder`
- Ficheiros `.functions.ts` para lógica server, `.tsx` para rotas

### Database Queries
- Usar sempre `pgQuery` / `pgOne` com placeholders `$1, $2`
- Nunca concatenar input do utilizador no SQL
- Usar `::float` / `::int` nos casts do PostgreSQL

### Tipos
- Tipos compartilhados em `pricing.shared.ts`: `CurrentMember`, `CatalogItem`
- Tipos locais (não exportados) quando só usados no mesmo ficheiro

### Componentes
- shadcn/ui components em `src/components/ui/`
- Componentes de domínio em `src/components/domain/`
- Layout em `src/components/layout/`

### Estilos
- Tailwind classes em JSX
- Variáveis CSS custom em `styles.css` (tema dark/violet)
- Animações em `styles.css` (glow-pulse, shine, etc.)

---

## 15. Checklist: Como Fazer Alterações

### Antes de alterar
1. Ler este ficheiro (PROJECT_CONTEXT.md)
2. Verificar se há `AGENTS.md` no diretório alvo
3. Identificar os ficheiros que precisam mudar (server function + route + types)

### Durante
4. Fazer alterações mínimas
5. Manter consistência com `armory.catalog.ts` para categorização de items
6. Se alterar DB schema, criar migration em `supabase/migrations/`

### Depois
7. `npm run build` — deve passar sem erros
8. `npm run deploy` — para enviar para produção
9. `git add -A && git commit -m "..." && git push origin main` — para sincronizar com GitHub

---

## 16. Pontos de Atenção / Armadilhas

| Problema | Solução |
|----------|---------|
| **exec_sql não suporta multi-statement** | Não usar `;` dentro de queries. `withClient` BEGIN/COMMIT são no-ops. |
| **Tier pricing duplicado** | Sempre usar `getTierPrice()` de `pricing.catalog.ts`. Não hardcode lógica de surcharge. |
| **Weapon whitelist** | `armory.catalog.ts` é a única fonte de verdade. Nunca replicar regexes de filtro noutros sítios. |
| **Discord bot offline** | `notifyBot` falha silenciosamente após 3s. `enqueueNotification` é mais robusto (persiste no DB). |
| **Realtime não funciona** | Verificar se a tabela está na publicação `supabase_realtime`. Migrations em `supabase/migrations/` configuram isto. |
| **SSR errors** | `server.ts` captura erros h3 e renderiza página HTML. `error-capture.ts` guarda o último erro. |
| **Cloudflare env vars** | `wrangler.jsonc` vars são públicas. Secrets (keys, tokens) devem ser definidas com `wrangler secret put`. |
| **Build quebra com duplicate plugins** | `@lovable.dev/vite-tanstack-config` já inclui todos os plugins. Não adicionar manualmente. |

---

## 17. Links Úteis

- **Production:** `https://ballasgang.eu`
- **Workers dev:** `https://gangsta-bot-web.redoodfirma.workers.dev`
- **Repo:** `https://github.com/imstewiez/gangsta-bot-web-44`
- **Supabase project:** `https://zducvbkozxtacwzvggli.supabase.co`
