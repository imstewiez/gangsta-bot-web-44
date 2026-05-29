# 🔍 Code Audit Completo — Ballas Gang Web App

> Audit realizado sobre `gangsta-bot-web-44-github` após leitura do `PROJECT_CONTEXT.md`.
> Este documento cobre os bugs reportados pelo utilizador **e** problemas críticos novos descobertos durante a análise.

---

## 📋 Sumário Executivo

| Severidade | Quantidade | Categorias |
|------------|-----------|------------|
| **CRITICAL** | 5 | Transações falsas, race conditions, data corruption |
| **HIGH** | 6 | SQL injection vector, cron sem locks, schema drift |
| **MEDIUM** | 9 | RLS vazio, silent failures, DDL no request path, N+1 |
| **LOW** | 5 | Anti-patterns de naming, tipos incompletos, timeouts hardcoded |
| **INFO** | 3 | Boas práticas a adotar no futuro |

---

## 🚨 CRITICAL

### CRIT-1 — `withClient` simula transações que NÃO EXISTEM (`pg.server.ts`)
**Ficheiro:** `src/lib/pg.server.ts` (linhas 69–90)
**Impacto:** Data corruption em praticamente todas as operações de escrita.

```ts
export async function withClient<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T> {
  const client: PgClientLike = {
    query: async (text: string, params?: unknown[]) => {
      const upper = text.trim().toLowerCase();
      if (upper === "begin" || upper.startsWith("begin ") || ...) {
        return { rows: [] };   // ← SILENT NO-OP
      }
      const rows = await pgQuery(text, params ?? []);
      return { rows: rows as unknown[] };
    },
  };
  return await fn(client);
}
```

**O que acontece:** `BEGIN`, `COMMIT`, `ROLLBACK` são ignorados. Cada `c.query(...)` dentro do `withClient` é uma chamada RPC independente à Supabase. Se houver falha a meio, metade dos dados fica persistida e a outra metade não.

**Código afetado:**
- `orders.functions.ts` — `transitionOrder` (linhas 282–355): pode decrementar stock sem atualizar a encomenda, ou vice-versa.
- `orders.functions.ts` — `cancelOwnOrder` (linhas 449–511): pode cancelar a encomenda sem inserir histórico.
- `liquidation.functions.ts` — `liquidateSaida` (linhas 130–245): pode liquidar metade dos participantes e parar, deixando a saída num estado inconsistente.
- `onboarding.functions.ts` — `approveTagRequest` (linhas 51–104): pode criar membro sem marcar o pedido como aprovado.
- `operations.functions.ts` — `createOperationWithParticipants` (linhas 197–229): pode criar saída sem participantes.

**Solução:**
Como `exec_sql` não suporta multi-statement, a única forma segura de transação é:
1. Criar uma stored procedure PostgreSQL (`create or replace function do_liquidate_saida(...)`)
2. Chamar essa função via `exec_sql` com os parâmetros necessários numa única chamada
3. Ou migrar para o Supabase REST nativo (`supabaseAdmin.from(...)`), que suporta operações atómicas em tabelas individuais (mas não cross-table).

Para operações cross-table críticas (encomendas + stock, liquidação + audit_log), **stored procedures são obrigatórias**.

---

### CRIT-2 — Race condition em transições de encomendas (`orders.functions.ts`)
**Ficheiro:** `src/lib/orders.functions.ts` (linhas 282–355)

```ts
const beforeRes = await c.query(`select o.status ... where o.id = $1`, [data.id]);
// ...
if (isFinal && before.status !== "fulfilled" && before.item_id) {
  await c.query(`insert into inventory_movements ...`);  // decrementa stock
}
await c.query(`update orders set status=$2 ...`);
```

**Problema:** `before.status` é lido sem `FOR UPDATE` (e mesmo com `FOR UPDATE` seria inútil porque `withClient` não faz transações). Dois pedidos concorrentes a aprovar a mesma encomenda para `fulfilled` passam ambos o check `before.status !== "fulfilled"` e inserem **duas** linhas de `inventory_movements`, decrementando o stock em dobro.

**Solução:** Usar `UPDATE ... WHERE status = 'approved' RETURNING *` em vez de `SELECT` seguido de `UPDATE`. O PostgreSQL garante atomicidade ao nível da linha.

---

### CRIT-3 — Race condition em `cancelOwnOrder` (`orders.functions.ts`)
**Ficheiro:** `src/lib/orders.functions.ts` (linhas 449–511)

Mesmo padrão que CRIT-2: `select ... where o.id = ANY($1)` sem lock, seguido de `update ... where id = ANY($1)`. Pedidos concorrentes podem duplicar inserções em `order_status_history`.

---

### CRIT-4 — `liquidateSaida` com `FOR UPDATE` inútil (`liquidation.functions.ts`)
**Ficheiro:** `src/lib/liquidation.functions.ts` (linhas 130–245)

```ts
const op = await c.query(`select ... from operations where id = $1 for update`, [data.id]);
```

O `FOR UPDATE` é adquirido e **imediatamente libertado** quando a chamada RPC retorna. As queries seguintes (`update operation_participants`, `update operations`, `insert into audit_logs`) correm sem lock e sem transação. Uma segunda liquidação concorrente pode correr em paralelo e sobrescrever valores inconsistentes.

**Solução:** Stored procedure PostgreSQL que faça toda a liquidação numa única chamada `exec_sql`.

---

### CRIT-5 — DDL em request handlers (`orders.functions.ts`)
**Ficheiro:** `src/lib/orders.functions.ts` (linhas 366–380)

```ts
async function ensureOrderCommentsTable() {
  await pgQuery(`create table if not exists order_comments (...)`);
  await pgQuery(`create index if not exists idx_order_comments_order_id on order_comments(order_id)`);
}
```

Chamado em `listOrderComments` e `addOrderComment` (linhas 390, 408). `CREATE TABLE` e `CREATE INDEX` no caminho do request causam locks e podem falhar sob carga concorrente. Deve estar numa migration.

**Solução:** Mover para `supabase/migrations/` e remover `ensureOrderCommentsTable`.

---

## 🔴 HIGH

### HIGH-1 — `pgQuery` faz client-side interpolation em vez de parameter binding
**Ficheiro:** `src/lib/pg.server.ts` (linhas 20–26)

```ts
for (let i = params.length - 1; i >= 0; i--) {
  const val = escapeSqlParam(params[i]);
  const placeholder = `$${i + 1}`;
  query = query.split(placeholder).join(val);
}
```

**Impacto:** Qualquer bug ou bypass em `escapeSqlParam` é um vetor de SQL injection direto.

**Problemas em `escapeSqlParam` (`security.ts`):**
- Não rejeita objectos/plain objects (só dá throw genérico)
- Não rejeita strings com padrões perigosos (`\x00` é o único check)
- `Date.prototype.toISOString()` pode lançar exceção em datas inválidas
- Não há limites de tamanho para strings/arrays

**Solução:** Passar os parâmetros como array para o RPC `exec_sql` e alterar a stored procedure `exec_sql` para aceitar `params jsonb` e usar `EXECUTE ... USING` com parameter binding nativo do PostgreSQL. Se isso não for possível, pelo menos:
- Adicionar validação de tamanho máximo de strings/arrays em `escapeSqlParam`
- Adicionar `zod` parsing estrito antes de passar dados para `pgQuery`

---

### HIGH-2 — Cron job sem lock e sem idempotência (`server.ts` + `data-recovery.functions.ts`)
**Ficheiro:** `src/server.ts` (linhas 88–100, 121–130) + `src/lib/data-recovery.functions.ts` (linhas 8–165)

```ts
// server.ts
if (url.pathname === "/api/cron/recalc") {
  const result = await doRecalcWeeklyRankings();
}

async scheduled(controller, env, ctx) {
  const result = await doRecalcWeeklyRankings();
}
```

**Problemas:**
1. O endpoint HTTP `/api/cron/recalc` e o trigger `scheduled` podem correr simultaneamente
2. Múltiplos pedidos HTTP podem bater no endpoint ao mesmo tempo
3. `doRecalcWeeklyRankings` faz `delete from weekly_rankings where week_start >= '2026-04-20'` e depois re-insere sem nenhum lock

**Impacto:** Duas instâncias concorrentes → uma faz DELETE, a outra faz DELETE, ambas inserem → dados duplicados ou race condition nos inserts.

**Solução:**
- Usar `pg_advisory_lock` no início do job:
```sql
SELECT pg_try_advisory_lock(42);
```
- Verificar se o lock foi adquirido; se não, abortar imediatamente
- Adicionar `ON CONFLICT (member_id, week_start) DO UPDATE` nos inserts de `weekly_rankings`
- Guardar estado de execução na tabela `job_runs` com `started_at`, `ended_at`, `status`, `error_message`

---

### HIGH-3 — Cron job com runtime ilimitado (`data-recovery.functions.ts`)
**Ficheiro:** `src/lib/data-recovery.functions.ts` (linhas 8–165)

```ts
const weekRows = await pgQuery<{ ws: string }>(
  `select distinct date_trunc('week', d)::date::text as ws
   from generate_series('2026-04-20'::date, current_date, '1 day'::interval) d`
);
for (const row of weekRows) {
  await pgQuery(`INSERT INTO weekly_rankings (...) ...`, [ws]);
}
```

O número de semanas cresce linearmente com o tempo. Cada semana executa uma CTE massiva com joins a `kill_logs`, `operation_participants`, `inventory_movements`, `members`. Em Workers com limite de ~30-50s, **isto vai falhar silenciosamente** quando o histórico crescer.

**Solução:**
- Limitar o recálculo às últimas N semanas (ex: 4 semanas) em vez de desde 2026-04-20
- Ou recalcular só a semana atual + anterior
- Adicionar deadline checking: `if (Date.now() - startTime > 25000) break;`

---

### HIGH-4 — `pending_notifications` sem retry controlado e sem dead-letter
**Ficheiro:** `src/lib/notifier.server.ts` (linhas 16–42)

```ts
await pgQuery(
  `insert into pending_notifications (... attempts, max_attempts, next_retry_at ...)
   values ($1, $2::jsonb, $3, 0, 5, now(), now())`,
  [opts.channelId ?? null, JSON.stringify(payload), opts.priority ?? 5]
);
```

A tabela tem `attempts`, `max_attempts`, `next_retry_at`, mas **não há nenhum código neste repo** que processe esta fila. O worker está noutro serviço (bot Discord). Se o worker parar:
- Notificações acumulam indefinidamente
- Não há alerta
- Não há limite de idade

**Solução:**
- Adicionar colunas `processed_at`, `failed_at`, `last_error`
- Criar uma view ou query de alerta: `select count(*) from pending_notifications where processed_at is null and created_at < now() - interval '10 minutes'`
- Considerar TTL: `delete from pending_notifications where created_at < now() - interval '7 days' and processed_at is not null`

---

### HIGH-5 — `sync_retries` sem limite de retry e sem backoff
**Referência:** `fix-sequences.sql` (linha 42), migrações RLS

A tabela `sync_retries` existe mas não vimos o código que a consome. Se é usada para retry de sync bot→DB, falta:
- `retry_count` com max (ex: 5)
- `last_error` (text)
- Exponential backoff (`next_retry_at = now() + interval '1 minute' * 2^retry_count`)
- Dead-letter queue para itens que excedem o limite

---

### HIGH-6 — Dual-track inventory sem autoridade definida
**Ficheiro:** `fix-sequences.sql` (linhas 40–41), migrações

Existem dois sistemas paralelos:
1. `items` + `inventory_movements` + `inventory_balance` (ledger geral)
2. `stock_v3_movements` + `stock_v3_pricing` (sistema v3)

**Risco:** Queries que leem de um sistema dão valores diferentes do outro. Não está claro qual é a fonte de verdade para "stock atual" e "preço atual".

**Solução:**
- Renomear `stock_v3_*` → `stock_*` numa migration
- Documentar qual sistema é autoritário
- Se um é legado e não usado, fazer backup e dropar

---

## 🟡 MEDIUM

### MED-1 — RLS ativado mas SEM POLÍTICAS na maioria das tabelas
**Ficheiro:** `supabase/migrations/20260512190000_enable_rls_all_tables.sql`

```sql
alter table public.kill_logs enable row level security;
-- ... 60+ tabelas
```

O comentário da migration diz: "enabling RLS with NO policies is safe because service-role bypasses RLS".

**Problema:** Se alguém acidentalmente usar a anon key para fazer `supabase.from('kill_logs').select('*')` em vez de `pgQuery`, a query falha silenciosamente ou retorna 0 rows (dependendo da config). Mas se houver alguma rota que exponha o client anon para queries diretas, os dados ficam inacessíveis.

Mais grave: a tabela `job_runs`, `sync_retries`, `pending_notifications` — se o bot worker usa anon key, está bloqueado.

**Solução:** Auditar `pg_policies` em ambos os projetos Supabase:
```sql
SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
```
Garantir que tabelas acessíveis pelo frontend (`profiles`, `user_roles`, `notifications`) têm policies explícitas. As restantes devem ter uma policy `DENY ALL TO anon, authenticated` documentada.

---

### MED-2 — `autoCloseStaleOperations` corre em todos os `listSaidas`
**Ficheiro:** `src/lib/operations.functions.ts` (linhas 38–52)

```ts
async function autoCloseStaleOperations(): Promise<void> {
  await pgQuery(`update operations set status = 'concluida' where ... < now() - interval '12 hours'`);
}
```

Chamada dentro de `listSaidas` (linha 57). **Cada page load faz um UPDATE massivo.** Sob carga, múltiplos reads concorrentes disparam writes concorrentes no mesmo conjunto de rows.

**Solução:** Mover para o cron diário (`doRecalcWeeklyRankings` ou handler separado), ou para um trigger PostgreSQL `AFTER INSERT OR UPDATE ON operations`.

---

### MED-3 — `adjustStock` com read-modify-write race condition
**Ficheiro:** `src/lib/inventory.functions.ts` (linhas 79–99)

```ts
const current = await pgOne(`select coalesce(balance, 0)::float as balance from inventory_balance where item_id = $1`, [data.item_id]);
const delta = data.new_qty - currentQty;
await pgQuery(`insert into inventory_movements ... values ('ajuste_manual', $1, $2, ...)`, [data.item_id, delta, ...]);
```

Dois managers a ajustar o mesmo item ao mesmo tempo → ambos leem o mesmo `currentQty`, calculam deltas errados, inserem movimentações incorretas.

**Solução:** Calcular o delta em SQL, não em JS:
```sql
INSERT INTO inventory_movements (movement_type, item_id, quantity, ...)
SELECT 'ajuste_manual', $1, $2 - coalesce(ib.balance, 0), ...
FROM (SELECT coalesce(balance, 0) as balance FROM inventory_balance WHERE item_id = $1) ib;
```

---

### MED-4 — `ensureOrderCommentsTable` e schema fallback por string matching
**Ficheiro:** `src/lib/orders.functions.ts` (linhas 239–262)

```ts
catch (insertErr: any) {
  const msg = String(insertErr?.message ?? insertErr);
  if (msg.includes('batch_id') || msg.includes('dirty_money') || ...) {
    // fallback to old schema
  }
}
```

Matching de mensagens de erro do Postgres é frágil (varia com versão/localização). Um erro de integridade que contenha `"batch_id"` vai incorrectly disparar o fallback.

**Solução:** Usar `information_schema.columns` para detetar schema em runtime, ou simplesmente garantir que todas as migrations foram aplicadas antes do deploy.

---

### MED-5 — `discord.server.ts` sem retry e sem validação de URL
**Ficheiro:** `src/lib/discord.server.ts`

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3000);
const res = await fetch(url, { ... signal: controller.signal });
```

- Timeout hardcoded de 3s pode ser agressivo para cold starts
- Sem retry → ação perdida permanentemente (rename, promote, kick)
- Sem validação de `DISCORD_BOT_URL` → possível exfil de secret `x-bot-secret`

**Solução:**
- Retry com backoff (1s, 3s, 5s)
- Validar URL antes do fetch (`new URL(url)` + allowlist de domínios)
- Aumentar timeout para 10s
- Guardar falhas em `pending_notifications` como fallback

---

### MED-6 — `notifier.server.ts` fail-silently
**Ficheiro:** `src/lib/notifier.server.ts` (linhas 38–41)

```ts
catch (e) {
  console.error("[notifier] enqueue failed", e);
}
```

Notificações falham silenciosamente. Sem métrica, sem alerta, sem dead-letter.

**Solução:** Incrementar contador de falhas, e se o DB está down, log estruturado com `console.error(JSON.stringify({...}))` para que um log aggregator possa alertar.

---

### MED-7 — N+1 inserts em `inviteMembers` e `cancelOperation`
**Ficheiro:** `src/lib/operations.functions.ts` (linhas 347–363, 265–274)

```ts
for (const memberId of newIds) {
  await pgQuery(`insert into operation_participants ...`, [data.operation_id, memberId]);
}
for (const memberId of newIds) {
  await enqueueNotification({...});
}
```

Deve ser batch insert:
```sql
INSERT INTO operation_participants (operation_id, member_id, ...) VALUES ($1, $2, ...), ($1, $3, ...), ...;
```

---

### MED-8 — `addKill` com upsert race condition
**Ficheiro:** `src/lib/operations.functions.ts` (linhas 133–139)

```ts
await pgQuery(`insert into kill_logs ...`);
await pgQuery(`insert into all_time_stats ... on conflict ... do update set kills_total = kills_total + 1`);
```

Duas kills concorrentes para o mesmo membro → o `all_time_stats` faz `+1` duas vezes, mas se houver um gap entre o insert e o upsert, o count pode divergir. Deve usar trigger PostgreSQL para manter `all_time_stats` sincronizado, não código JS.

**Nota:** Já existe `scripts/auto-recalc-triggers.sql` que faz isto, mas o código JS ainda faz upserts manuais → duplicação de lógica e risco de divergência.

---

### MED-9 — `decideDelivery` com loop de inserts não atómico
**Ficheiro:** `src/lib/deliveries.functions.ts` (linhas 201–225)

```ts
if (data.approve) {
  for (const l of before.lines) {
    await pgQuery(`insert into inventory_movements ...`, [...]);
  }
}
```

Se a aprovação falhar a meio do loop, a entrega fica half-applied. E não há `withClient` (mesmo que houvesse, seria no-op).

**Solução:** Batch insert numa única query, ou stored procedure.

---

## 🟢 LOW

### LOW-1 — `fix-sequences.sql` não deve existir na raiz
**Ficheiro:** `./fix-sequences.sql`

Post-hoc patch para 35+ tabelas. Indica que as sequences foram criadas com `SERIAL` em vez de `GENERATED ALWAYS AS IDENTITY`. Cada importação/truncation exige correr este script manualmente.

**Solução:**
- Migrar para `GENERATED ALWAYS AS IDENTITY` nas novas tabelas
- Integrar o reset de sequences numa migration automática que corra após imports

---

### LOW-2 — `cemetery_kills_id_seq` → tabela renomeada sem renomear sequence
**Ficheiro:** `./fix-sequences.sql` (linha 14)

```sql
SELECT setval('cemetery_kills_id_seq', COALESCE((SELECT MAX(id) FROM kill_logs), 0) + 1, false);
```

Sinal de que `kill_logs` era `cemetery_kills`. Pode haver views, funções ou código do bot que ainda referenciem o nome antigo.

**Solução:**
```sql
ALTER SEQUENCE cemetery_kills_id_seq RENAME TO kill_logs_id_seq;
```
- Procurar por `"cemetery_kills"` em todos os repos (web + bot)

---

### LOW-3 — Version suffix em tabelas: `stock_v3_*`
**Ficheiro:** `fix-sequences.sql` (linhas 40–41), migrações

Anti-pattern. Implica redesigns anteriores (v1, v2) e ambiguidade sobre qual o sistema autoritário.

**Solução:**
```sql
ALTER TABLE stock_v3_movements RENAME TO stock_movements;
ALTER TABLE stock_v3_pricing RENAME TO stock_pricing;
```
Atualizar todo o código e migrações que referenciem os nomes antigos.

---

### LOW-4 — Integer IDs em vez de UUIDs
Todas as 40+ tabelas usam `id serial primary key`. Supabase best practice recomenda UUIDs (`gen_random_uuid()`) para:
- Não revelar volume de dados (order #1042 → ~1042 encomendas)
- Permitir geração client-side sem round-trip
- Melhor segurança em RLS

**Nota:** Não é urgente, mas deve ser considerado para novas tabelas.

---

### LOW-5 — Tipos TypeScript do Supabase incompletos
**Ficheiro:** `src/integrations/supabase/types.ts`

Apenas define `profiles`, `user_roles`, `notifications`. As 40+ tabelas do jogo (members, orders, operations, etc.) não têm tipos gerados.

**Impacto:** `pgQuery` retorna `any`. Erros de typo em nomes de colunas só são detetados em runtime.

**Solução:**
```bash
npx supabase gen types typescript --project-id zducvbkozxtacwzvggli > src/integrations/supabase/types.ts
```
Adicionar ao CI/CD como pre-build step.

---

## 🔵 INFO

### INFO-1 — `item_price_history` é boa prática
Tabela de histórico de preços existe. Confirmar que o "preço atual" é consistentemente derivado do último registo desta tabela (e não de `stock_v3_pricing` ou `items.min_sale_price`)

### INFO-2 — `archival_log` + `audit_logs` são boas práticas
Confirmar que RLS policies nestas tabelas apenas permitem INSERT (nunca UPDATE/DELETE) para o service role.

### INFO-3 — Discord credentials não estão no `.env` comitted
Correcto — devem estar em Cloudflare Worker secrets (`wrangler secret put`).

---

## 📊 Plano de Ação Prioritizado

### Semana 1 — Segurança & Integridade
1. [ ] **CRIT-1/2/3/4:** Reescrever `transitionOrder`, `cancelOwnOrder`, `liquidateSaida`, `approveTagRequest` usando **stored procedures PostgreSQL** chamadas via `exec_sql`
2. [ ] **CRIT-5:** Mover `order_comments` DDL para migration e eliminar `ensureOrderCommentsTable`
3. [ ] **HIGH-2:** Adicionar `pg_advisory_lock` ao cron job + guardar estado em `job_runs`
4. [ ] **HIGH-3:** Limitar recalc às últimas 4 semanas; adicionar deadline checking

### Semana 2 — Robustez
5. [ ] **HIGH-4:** Adicionar `processed_at`, `failed_at`, `last_error` a `pending_notifications`; criar query de alerta
6. [ ] **HIGH-5:** Adicionar retry limit + backoff + dead-letter a `sync_retries`
7. [ ] **MED-2:** Mover `autoCloseStaleOperations` do `listSaidas` para o cron diário
8. [ ] **MED-3:** Reescrever `adjustStock` com cálculo do delta em SQL

### Semana 3 — Schema & Tipos
9. [ ] **LOW-1/2/3:** Criar migration para renomear sequences, remover `fix-sequences.sql`, renomear `stock_v3_*`
10. [ ] **HIGH-6:** Documentar/decidir qual sistema de inventário é autoritário; dropar o legado
11. [ ] **LOW-5:** Gerar tipos TypeScript completos do Supabase e adicionar ao CI
12. [ ] **MED-1:** Auditar `pg_policies` e adicionar policies explícitas (pelo menos `DENY ALL` documentado)

### Semana 4 — Refinamento
13. [ ] **HIGH-1:** Melhorar `escapeSqlParam` ou migrar para parameter binding nativo no RPC
14. [ ] **MED-5:** Adicionar retry + URL validation a `discord.server.ts`
15. [ ] **MED-4:** Remover fallback por string matching em `createOrder`
16. [ ] Criar `scripts/seed-items.ts` como fonte de verdade canónica para items

---

## 🔗 Ficheiros Auditados

- `src/lib/pg.server.ts`
- `src/lib/security.ts`
- `src/lib/orders.functions.ts`
- `src/lib/inventory.functions.ts`
- `src/lib/operations.functions.ts`
- `src/lib/liquidation.functions.ts`
- `src/lib/deliveries.functions.ts`
- `src/lib/onboarding.functions.ts`
- `src/lib/member-admin.functions.ts`
- `src/lib/data-recovery.functions.ts`
- `src/lib/discord.server.ts`
- `src/lib/notifier.server.ts`
- `src/server.ts`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260512190000_enable_rls_all_tables.sql`
- `fix-sequences.sql`
- `wrangler.jsonc`
- `.env` / `.env.example`
