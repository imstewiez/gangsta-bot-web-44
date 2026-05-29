# Project Context — gangsta-bot-web-44

> **Última atualização:** 2026-05-29
> **Sessão:** Code audit completo + critical fixes + deploy

---

## 📋 Stack & Arquitetura

| Camada | Tecnologia |
|--------|-----------|
| Framework | TanStack Start (React + Vite) |
| Runtime | Cloudflare Workers |
| Database | Supabase PostgreSQL (via `exec_sql` RPC) |
| Auth | Supabase Auth + Discord OAuth (JWT Bearer, **sem cookies**) |
| Rate Limiting | Upstash Redis (REST API) + fallback em memória |
| Logging | Estruturado JSON (`src/lib/logger.server.ts`) |
| Deploy | Wrangler CLI + GitHub push |

**Path alias:** `@/` → `./src/`

---

## 🏗️ Estrutura de Diretórios Relevante

```
src/
  lib/                          # Server functions + utilitários
    logger.server.ts            # Logger estruturado JSON
    rate-limit.server.ts        # Rate limiting (Redis + memória)
    pg.server.ts                # Client PostgreSQL via exec_sql RPC
    discord.server.ts           # Bridge Discord com retry + fallback
    notifier.server.ts          # Queue de notificações com dedup
    security.ts                 # Zod schemas + escapeSqlParam
    data-recovery.functions.ts  # Cron job recalc weekly_rankings
    orders.functions.ts         # CRUD encomendas + SPs
    liquidation.functions.ts    # Liquidação via sp_liquidate_saida
    members.functions.ts        # Gestão de membros
    leaderboard.functions.ts    # Leaderboard
    deliveries.functions.ts     # Entregas
    inventory.functions.ts      # Inventário
    operations.functions.ts     # Operações/saídas
    recipes.functions.ts        # Receitas/craft
    ...
  integrations/supabase/
    types.ts                    # Types TS gerados (20+ tabelas + SPs)
  server.ts                     # Entry point Worker (fetch + scheduled)
  routes/                       # TanStack routes

supabase/migrations/
  20260529000000_audit_fix_critical_issues.sql   # Migration principal

scripts/
  check-deploy-readiness.ts     # Verifica se está tudo pronto para deploy
  seed-items.ts                 # Seed canónico de items

wrangler.jsonc                  # Config Cloudflare Worker
```

---

## ✅ O que foi implementado nesta sessão (Changelog)

### Critical — Race Conditions & Atomicidade
- **7 Stored Procedures** criadas para operações atómicas:
  - `sp_transition_order` — transição de estado + movimento de inventário + histórico
  - `sp_cancel_orders` — cancelamento batch + histórico
  - `sp_liquidate_saida` — liquidação atómica (participantes + operações + audit_log)
  - `sp_approve_tag_request` — aprovação de tag + criação de membro
  - `sp_create_operation_with_participants` — criação op + participantes
  - `sp_adjust_stock` — ajuste de stock com delta em SQL (sem read-modify-write)
  - `sp_approve_delivery` — batch inventory_movements + stats
- Removidas transações `withClient` falsas (BEGIN/COMMIT via RPC não funcionavam)
- `withClient` marcado como `@deprecated` com `console.warn`

### Critical — DDL fora do request path
- Tabela `order_comments` movida para migration
- `ensureOrderCommentsTable` removido completamente

### High — Cron Job Hardening
- `pg_advisory_lock(424242)` previne execuções concorrentes
- Tabela `job_runs` tracking (start, end, status, error, rows)
- Limite de recálculo: últimas 4 semanas
- Deadline checking: 25s para evitar timeout do Worker
- `ON CONFLICT (member_id, week_start) DO UPDATE`
- `autoCloseStaleOperations` movido do read path para o cron

### High — SQL Injection Hardening
- `escapeSqlParam` reforçado:
  - Limite de tamanho: string 10k chars, array 1k items, query 500k chars
  - Rejeição de objetos, símbolos, datas inválidas
  - Stripping de comentários SQL antes do multi-statement guard

### High — Notificações & Retry
- `pending_notifications`: colunas novas `processed_at`, `failed_at`, `last_error`, `retry_count`, `dedup_key` + índices
- `sync_retries`: colunas `retry_count`, `max_retries`, `next_retry_at`, `dead_lettered`, `dead_lettered_at`
- Discord bridge: retry com backoff (1s, 3s, 5s), timeout 10s, validação HTTPS, fallback para queue

### Medium — Performance
- Batch inserts: `inviteMembers`, `decideDelivery`
- `createOrder`: removido fallback por string matching de mensagens Postgres

### Low — Schema Cleanup
- Renomeações: `cemetery_kills_id_seq` → `kill_logs_id_seq`, `stock_v3_movements` → `stock_movements`, `stock_v3_pricing` → `stock_pricing`
- Types TypeScript expandidos: 20+ tabelas + tipos de retorno dos SPs
- Seed script: `scripts/seed-items.ts`

### Observabilidade & Segurança
- **Rate limiting**: 60 req/min por IP (Redis distribuído ou memória)
- **Health check**: `GET /api/health` → `{ status: "ok", ... }`
- **Structured logging**: `logger.server.ts` com níveis (debug/info/warn/error/fatal)
- **Domain redirect**: `ballasgang.pt` → `ballasgang.eu`
- **Cron secret**: `x-cron-secret` header para `/api/cron/recalc`
- **Input validation**: 20 blocos `inputValidator` com Zod schemas (`IdSchema`, `NicknameSchema`, `DeliveryScopeSchema`, `OrderStatusSchema`, `NotesSchema`, `LeaderboardPeriodSchema`, `LeaderboardSortBySchema`, `SortDirSchema`, `MemberIdSchema`, `PrizeSchema`, `DeliveryDecisionSchema`)

### Traduções & UX
- Pluralização: "1 unidade" / "N unidades" em 37 ficheiros
- Traduções: Kills→Abates, K/D→R/A, Score→Pontos, Win Rate→Taxa de Vitórias, Craft→Fabricação, Leaderboard→Classificação, etc.

---

## 🔧 Configurações Atuais

### Cloudflare Worker Secrets (wrangler)
| Secret | Origem |
|--------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API → service_role |
| `CRON_SECRET` | Gerado localmente (`crypto.randomBytes`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Dashboard → Database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Dashboard → Database → REST API |

### Variáveis Públicas (wrangler.jsonc)
| Var | Valor |
|-----|-------|
| `SUPABASE_URL` | `https://zducvbkozxtacwzvggli.supabase.co` |

### Domínios
- `ballasgang.eu`
- `www.ballasgang.eu`
- `gangsta-bot-web.redoodfirma.workers.dev` (dev)

### Cron
- Schedule: `0 0 * * *` (todos os dias à meia-noite)
- Executa: `doRecalcWeeklyRankings()`

---

## ⚠️ Notas & Decisões Arquiteturais

1. **Sem cookies / CSRF não aplicável** — Auth é JWT Bearer via header `Authorization`, não session cookies.
2. **Transações** — Não há verdadeiras transações BEGIN/COMMIT via `exec_sql` RPC. Toda a atomicidade é feita via Stored Procedures no Postgres.
3. **`withClient` deprecated** — Ainda existe para backward compatibilidade, mas gera `console.warn`. Novo código deve usar SPs.
4. **Rate limiting em memória** — O Map local é ok para single Worker. Em produção com múltiplas instâncias, Redis distribuído garante consistência.
5. **Logger** — Sempre JSON. O Cloudflare Workers dashboard consome JSON lines nativamente.
6. **Migration manual obrigatória** — A migration `20260529000000_audit_fix_critical_issues.sql` DEVE ser executada no Supabase SQL Editor antes de qualquer deploy que dependa das SPs.

---

## 🚀 Workflow de Deploy (atual)

```bash
# 1. Build
npm run build

# 2. Verificar (opcional)
npx tsx scripts/check-deploy-readiness.ts

# 3. Deploy
npx wrangler deploy
```

> Nota: O `check-deploy-readiness.ts` verifica o ambiente **local** (process.env). As secrets configuradas via `wrangler secret put` não aparecem localmente — isso é esperado.

---

## 📁 Ficheiros de Documentação Criados

| Ficheiro | Propósito |
|----------|-----------|
| `PROJECT_CONTEXT.md` | Este ficheiro — contexto para futuras sessões |
| `DEPLOY.md` | Guia passo a passo de deploy |
| `CODE_AUDIT_COMPLETE.md` | Relatório completo do code audit |

---

## 🔮 Próximos Passos Potenciais (ideias futuras)

- [ ] Migrar restantes chamadas `withClient` para Stored Procedures
- [ ] Implementar testes unitários para as SPs (pgTAP ou similar)
- [ ] Adicionar cache com Cloudflare KV para dados pouco mutáveis (ex: items, recipes)
- [ ] Implementar feature flags para rollout gradual
- [ ] Dashboard de métricas (Worker analytics, Redis metrics)
- [ ] Revisar e eliminar pre-existing TypeScript errors em `liquidation.functions.ts` e `server.ts`
- [ ] Automatizar execução de migrations via Supabase CLI no CI/CD
