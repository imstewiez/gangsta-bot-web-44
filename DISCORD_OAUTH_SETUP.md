# Configuração Discord OAuth — RedWood Web App

## O que mudou

A autenticação passou de **email/password** para **Discord OAuth2**.
O login agora é apenas um botão "Entrar com Discord".

---

## Passo 1: Discord Developer Portal

1. Vai a https://discord.com/developers/applications
2. Seleciona a **mesma app que o bot usa** (já existe)
3. No menu lateral, clica em **OAuth2 → General**
4. Em **Redirects**, adiciona:

```
https://<seu-projeto>.supabase.co/auth/v1/callback
```

> ⚠️ Se já tens domínio próprio, adiciona também:
> ```
> https://seudominio.com/auth/callback
> ```

5. Guarda o **Client ID** e o **Client Secret** (clica em "Reset Secret" se não tiveres)

---

## Passo 2: Supabase Dashboard

1. Vai ao teu projeto Supabase → **Authentication → Providers**
2. Ativa **Discord**
3. Preenche:
   - **Client ID**: (do Discord Developer Portal)
   - **Secret**: (do Discord Developer Portal)
4. Em **Redirect URL**, confirma que está:
   ```
   https://<seu-projeto>.supabase.co/auth/v1/callback
   ```
5. Clica em **Save**

---

## Passo 3: Verificar o trigger (já feito)

A migration `20260512050308_0d0bc73b-3093-4eb8-8c8a-5bc6c552204a.sql` já foi atualizada.
O trigger `handle_new_user` agora captura corretamente:
- `discord_id` → do `provider_id` do Discord
- `display_name` → do `full_name` ou `name` do Discord
- `avatar_url` → do avatar do Discord

---

## Passo 4: Variáveis de ambiente

Certifica-te que as seguintes env vars estão configuradas (já deveriam estar):

```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-public-key>
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## Fluxo de autenticação

```
User clica "Entrar com Discord"
    ↓
Redirecionado para Discord OAuth
    ↓
Discord autoriza e redireciona de volta
    ↓
Supabase troca o code por JWT session
    ↓
Trigger handle_new_user cria profile + member role
    ↓
User é redirecionado para /dashboard
```

---

## Notas importantes

- **Não precisas de criar contas manualmente** — o trigger cria automaticamente
- **Roles**: Todo o user novo recebe role `member` por omissão. Admins atribuem `admin` via painel `/admin`
- **Se o user já tem conta email/password**: O Discord OAuth cria um novo user separado. Para migrar users existentes, contacta-me.
- **Onboarding**: Se o `discord_id` do user não existir na tabela `members` (Railway), a app pode redirecionar para um fluxo de "pedir tag" (implementar no futuro se necessário)

---

## Testar localmente

```bash
npm run dev
```

Vai a http://localhost:3000/login e clica "Entrar com Discord".

Para testar local, adiciona também este redirect no Discord:
```
http://localhost:3000/auth/callback
```
