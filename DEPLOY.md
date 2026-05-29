# 🚀 Guia de Deploy

## 1. Executar a Migration no Supabase (OBRIGATÓRIO antes do deploy)

Sem isto, as stored procedures não existem e o site vai falhar.

### Passo a passo:
1. Vai ao [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleciona o projeto **`zducvbkozxtacwzvggli`**
3. No menu lateral, clica em **"SQL Editor"**
4. Clica em **"New query"** (ou "New snippet")
5. Abre o ficheiro local: `supabase/migrations/20260529000000_audit_fix_critical_issues.sql`
6. Copia TODO o conteúdo e cola no editor
7. Clica no botão **"Run"** (▶️)

> ✅ Verificação: A query deve mostrar "Success" sem erros. Se der erro, não continues — corrige primeiro.

---

## 2. Configurar Secrets no Cloudflare Workers

O worker precisa de variáveis de ambiente para funcionar. Há dois tipos:

### A) Variáveis Públicas (já no `wrangler.jsonc`)
- `SUPABASE_URL` — já configurado no `wrangler.jsonc`

### B) Secrets (não podem ir para o repo)
Tens de configurar estas no dashboard do Cloudflare ou via CLI:

| Secret | Onde arranjar | Para que serve |
|--------|--------------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role key | Aceder à BD como admin |
| `CRON_SECRET` | Inventa uma password forte (ex: `openssl rand -base64 32`) | Proteger o endpoint `/api/cron/recalc` |
| `UPSTASH_REDIS_REST_URL` | Upstash Dashboard → Database → REST API → URL | Rate limiting distribuído |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Dashboard → Database → REST API → Token | Rate limiting distribuído |

### Como configurar via Dashboard:
1. Vai ao [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages → Seleciona **`gangsta-bot-web`**
3. Settings → **Variables and Secrets**
4. Clica **"Add variable"**
5. Para cada secret:
   - Name: o nome da variável (ex: `SUPABASE_SERVICE_ROLE_KEY`)
   - Value: o valor
   - **Marca a checkbox "Encrypt"** para que seja tratado como secret
6. Clica **"Deploy"** para guardar

### Como configurar via CLI (wrangler):
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

---

## 3. Criar a Base de Dados Redis (Upstash) — Opcional mas recomendado

O rate limiting funciona em memória por defeito (ok para dev/local), mas em produção com múltiplas instâncias do Worker precisas de Redis para rate limiting distribuído.

### Passo a passo:
1. Vai a [upstash.com](https://upstash.com) e cria conta (podes usar login com GitHub)
2. Clica **"Create Database"**
3. Escolhe:
   - **Name:** `gangsta-rate-limit`
   - **Region:** `EU-West` (ou a mais próxima de ti)
   - **Type:** `Regional` (o free tier basta)
4. Clica **"Create"**
5. Dentro da database, vai ao separador **"REST API"**
6. Copia:
   - **UPSTASH_REDIS_REST_URL** (ex: `https://your-db.upstash.io`)
   - **UPSTASH_REDIS_REST_TOKEN** (ex: `AYJ...`)
7. Configura ambos como secrets no Cloudflare (passo 2)

> 💡 O rate limiter detecta automaticamente se o Redis está configurado. Se não estiver, usa memória (fallback seguro).

---

## 4. Deploy do Worker

```bash
npm run build
npx wrangler deploy
```

Ou se usares o deploy automático do GitHub (se tiveres setup):
- Faz push para `main`
- O GitHub Action corre automaticamente

---

## 5. Verificar se está tudo OK

Depois do deploy, testa estes endpoints:

```bash
# Health check
curl https://ballasgang.eu/api/health
# Esperado: {"status":"ok","service":"gangsta-web","timestamp":"..."}

# Cron (com secret)
curl -H "x-cron-secret: A_TUA_CRON_SECRET" https://ballasgang.eu/api/cron/recalc
# Esperado: {"success":true,"rows_updated":N}
```

---

## 📋 Checklist pré-deploy

- [ ] Migration SQL executada no Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurado no Cloudflare
- [ ] `CRON_SECRET` configurado no Cloudflare
- [ ] `UPSTASH_REDIS_REST_URL` configurado (opcional mas recomendado)
- [ ] `UPSTASH_REDIS_REST_TOKEN` configurado (opcional mas recomendado)
- [ ] `npm run build` passa sem erros
- [ ] Deploy feito com `npx wrangler deploy`
- [ ] Health check responde OK
