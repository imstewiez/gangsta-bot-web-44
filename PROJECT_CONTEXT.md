# Project Context — gangsta-bot-web-44

> **Última atualização:** 2026-06-02  
> **Estado da sessão:** Gestão de Materiais consolidada como fonte de verdade, preços/receitas por cargo e modo de pagamento, limpeza de membros fantasma, sincronização Discord↔DB automática no bot, UI de materiais melhorada, filtros unificados e cargos ajustados.  
> **Repo principal webapp:** `imstewiez/gangsta-bot-web-44`  
> **Repo operacional do bot/Railway:** `imstewiez/real-gangsta-bot`  
> **Produto:** webapp de gestão interna da Ballas Gang.

---

## 1. Resumo do produto

Esta app **não é sistema financeiro genérico nem sistema de liquidação**. É uma webapp operacional para gestão interna da Ballas Gang/bairro, com foco em:

- Membros, cargos, permissões e atividade.
- Encomendas feitas por membros e tratadas por responsáveis/chefia.
- Entregas/vendas internas para stock/armazém.
- Saídas/operações.
- Prémios semanais.
- Preçário.
- Armazém/stock.
- Receitas/fabricação.
- Gestão de Materiais/Items.
- Auditoria/Qualidade de Dados.
- Modo Superadmin “Ver como outro user”.

Regra absoluta:

```text
Gestão de Materiais / tabela items = fonte de verdade global para qualquer item.
```

Tudo o que seja item, preço, custo, receita, material, side compra/venda, XP, categoria, visibilidade, encomenda, entrega, preçário, receita ou stock deve respeitar a DB/Gestão de Materiais. Nada deve ser inventado por config legacy ou fallback antigo.

---

## 2. Stack e arquitetura

| Camada | Tecnologia |
|--------|------------|
| Webapp | TanStack Start + React + Vite |
| Runtime webapp | Cloudflare Workers |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth + Discord OAuth, com JWT Bearer header |
| Deploy webapp | Wrangler / Cloudflare Workers |
| Data fetching | TanStack Query + server functions |
| UI | Componentes React internos + Tailwind/shadcn-style |
| Bot operacional | Node.js + discord.js em Railway/local |

Path alias webapp:

```text
@/ -> ./src/
```

Importante: **migrations que precisam de correr automaticamente em produção devem existir no repo `real-gangsta-bot`**, porque o bot/Railway é quem corre migrations no arranque. A webapp tem migrations em `supabase/migrations`, mas o deploy da webapp não aplica automaticamente migrations.

---

## 3. Diretórios e ficheiros importantes

### Webapp `imstewiez/gangsta-bot-web-44`

```text
src/
  components/
    layout/
      AppShell.tsx              # Layout principal, sidebar/header, ViewAsSwitcher
      ViewAsSwitcher.tsx        # Modo Superadmin "Ver como"
    domain/
      CategoryHeader.tsx
      ItemIcon.tsx
    ui/
      searchable-select.tsx
      button.tsx
      input.tsx

  integrations/supabase/
    auth-middleware.ts          # Middleware JWT Bearer
    client.ts                   # Supabase client
    types.ts                    # Tipos Supabase

  lib/
    pg.server.ts                # Helper SQL/exec_sql
    pricing.server.ts           # resolveCurrentMember + view-as seguro
    pricing.shared.ts           # helpers permissões + CurrentMember/CatalogItem
    pricing.functions.ts        # catálogo/preçário DB-first
    pricing.resolver.ts         # resolve preços exclusivamente da DB + overrides
    tier-pricing.functions.ts   # preços finais por cargo e modo
    orders.functions.ts         # Encomendas
    deliveries.functions.ts     # Entregas/vendas internas
    inventory.functions.ts      # Armazém/stock
    recipes.functions.ts        # Receitas/fabricação
    recipes.admin.functions.ts  # Gestão de Materiais/admin items/receitas
    prizes.functions.ts         # Prémios
    members.functions.ts        # Membros/managers, filtros anti-fantasma
    dashboard.functions.ts      # Casa/painel, rankings filtrados por cargos válidos
    leaderboard.functions.ts    # Classificação filtrada por cargos válidos
    view-as.functions.ts        # targets do modo Ver Como
    data-quality-v2.functions.ts# Auditoria DB-first atual
    data-quality.functions.ts   # Auditoria antiga/legada, não usar em novas rotas
    config.loader.ts            # Config global/labels/filtros, NÃO fonte de items/preços
    domain.ts                   # labels/cargos/cores/tier descriptions
    authed-server-fn.ts         # Envia Authorization + x-view-as-member-id

  routes/_authenticated/
    admin.itens.tsx             # Gestão de Materiais/Items
    encomendas.tsx              # UI de encomendas
    entregas.tsx                # UI de entregas/vendas internas
    receitas.tsx                # UI de receitas
    premios.tsx                 # UI de prémios
    admin.dados.tsx             # UI Qualidade de Dados, usa data-quality-v2
    admin.dashboard.tsx         # Painel chefia / ciclos encomendas
```

### Bot `imstewiez/real-gangsta-bot`

```text
src/
  app/readyPhases.js            # Ready phases; corre reconcile no arranque
  app/discord/lifecycle.js      # Eventos Discord: entradas/saídas/subidas/descidas
  members/backfill.js           # Importa/reativa membros Discord com cargo operacional
  members/roleInvariants.js     # Reconcile DB↔Discord e remoção de fantasmas
  jobs/scheduler.js             # Jobs mínimos pós-migração webapp
  dbMigrate.js                  # Migrator Railway/local

migrations/
  076_web_material_pricing_and_recipe_overrides.sql
  077_repair_material_buy_prices_robust.sql

scripts/
  repair-material-prices.js     # Repair direto dos preços de compra de materiais
  audit-members.js              # Auditoria Discord vs app/DB
```

---

## 4. Modelo mental dos items

### 4.1 Fonte de verdade

A tabela `items` é a fonte de verdade para:

- `name`
- `category`
- `subcategory`
- `side`
- `purchase_price`
- `morador_purchase_price`
- `min_sale_price`
- `estimated_value`
- `xp_points`
- `active`
- `deleted_at`

Receitas vêm da DB:

- `craft_recipes`
- `recipe_ingredients`
- `recipe_ingredient_tier_overrides`

Preços finais por cargo/modo vêm de:

- `item_tier_surcharges`
  - `surcharge` legacy/compatibilidade
  - `price_with_material`
  - `price_without_material`

### 4.2 Side dos items

```text
side = venda  -> firma vende esse item; aparece em preçário/encomendas/vendas.
side = compra -> firma compra/recebe esse item; aparece em entregas/preçário de compra.
side = ambos  -> aparece nos dois lados.
```

### 4.3 Semântica atual dos preços

#### Items de venda

- `min_sale_price` = preço base com material.
- `purchase_price` = preço base sem material/dinheiro only.
- `estimated_value` = custo interno / custo de produção / valor interno da chefia.
- `item_tier_surcharges.price_with_material` = preço final por cargo para encomenda com materiais.
- `item_tier_surcharges.price_without_material` = preço final por cargo para encomenda só dinheiro.
- `surcharge` fica apenas para compatibilidade com dados antigos; lógica nova deve preferir os campos explícitos.

Um item de venda é válido se tiver **preço com material OU preço sem material**.

#### Items de compra

- `purchase_price` = preço civil / preço compra civil.
- `morador_purchase_price` = preço organização / preço moradores.
- `estimated_value` acompanha custo interno quando aplicável.

Um item de compra é válido se tiver **preço civil OU preço moradores/organização**.

### 4.4 Custo interno

Custo de produção/valor interno é `estimated_value`.

Este valor **não pode aparecer a membros normais**, nem via backend nem via UI.

---

## 5. Gestão de Materiais — estado atual

Ficheiros principais:

```text
src/routes/_authenticated/admin.itens.tsx
src/lib/recipes.admin.functions.ts
src/lib/tier-pricing.functions.ts
src/lib/pricing.resolver.ts
src/lib/pricing.functions.ts
src/lib/orders.functions.ts
```

A página Gestão de Materiais foi redesenhada e agora permite:

- Criar/editar item.
- Definir `side`: compra, venda ou ambos.
- Para compra: definir **preço civil** e **preço moradores**.
- Para venda: definir **base com material**, **base sem material** e **custo interno**.
- Para venda: definir preços finais por Bairrista para os dois modos:
  - Bairrista-1: com material / sem material
  - Bairrista-2: com material / sem material
  - Bairrista-3: com material / sem material
- Definir receitas com quantidade base + overrides por Bairrista:
  - Base
  - Bairrista-1
  - Bairrista-2
  - Bairrista-3
- Filtros unificados:
  - Categorias só em chips interativos.
  - Tipo Compra/Venda/Compra & Venda em botões segmentados.
  - Pesquisa textual.
  - Botão Limpar quando há filtros ativos.

### 5.1 Preços de compra configurados

Foi criado repair/migration para configurar na DB estes preços, aplicados tanto a civil como a moradores/organização quando o item existe:

```text
Taninos                  20€
Radio Estragado          25€
Telemóvel Estragado      25€
Sucata                   40€
Serradura                40€
Carvão                   40€
Tábua Pinho              40€
Plástico / Plástico Reciclado 40€
Tábua Carvalho           65€
Borracha                 65€
Tábua Cerejeira          60€
Ferro                    65€
Tecido                   65€
Cobre                    65€
Lixo Eletrónico          60€
Pólvora                 100€
Tábua Ébano             200€
Kevlar                  600€
Papel                   100€
Couro                  1500€
Aço                    1000€
```

Nota: **Peças** e **Peças Estragadas** não foram alteradas porque não estavam na lista original de preços.

Scripts úteis no bot:

```bash
npm run repair:material-prices
```

Este script imprime exatamente que items atualizou e o relatório de verificação.

---

## 6. Encomendas

Ficheiros principais:

```text
src/lib/orders.functions.ts
src/routes/_authenticated/encomendas.tsx
```

### 6.1 Fluxo de estados

```text
pending -> approved / denied / cancelled
approved -> in_progress / cancelled
in_progress -> ready / cancelled
ready -> fulfilled / cancelled
```

Estados finais:

```text
fulfilled
denied
cancelled
```

### 6.2 Responsável obrigatório

Toda encomenda nova tem de ter `responsavel_member_id` válido.

Ações de gestão devem ser feitas pelo responsável ou por superadmin.

### 6.3 Preços e materiais

- Items sem receita real na DB não devem mostrar opção “com materiais”.
- Se não houver receita, a encomenda deve ser dinheiro only.
- Ingredientes vêm de `craft_recipes`/`recipe_ingredients`, com override por cargo em `recipe_ingredient_tier_overrides`.
- Preços vêm da DB/Gestão de Materiais.
- Encomenda com materiais usa `price_with_material` do cargo, ou base `min_sale_price` se não houver override.
- Encomenda dinheiro only usa `price_without_material` do cargo, ou base `purchase_price` se não houver override.
- Sem `dirty_money`/“dinheiro sujo” na UI; mostrar apenas **dinheiro**.

### 6.4 Movimento de stock

Ao marcar encomenda como `fulfilled`, cria movimento de stock `venda_bairrista` com quantidade negativa do item vendido.

---

## 7. Entregas e vendas internas

Ficheiros principais:

```text
src/lib/deliveries.functions.ts
src/routes/_authenticated/entregas.tsx
```

Tipo de pedido:

```text
entrega -> membro entrega stock/material à firma; normalmente entra a custo 0.
venda   -> venda/aquisição interna a conferir.
```

Regras:

- Entrega/venda nova não pode ser submetida sem responsável.
- Isto é validado na UI e no backend.
- Tab “Para conferir” mostra pendentes do responsável/superadmin.
- Pedidos legacy sem responsável ainda podem aparecer em checks de Qualidade de Dados e podem ser normalizados pelo repair.

Repair legacy em `data-quality-v2.functions.ts`:

- normaliza linhas antigas (`itemId`, `itemName`, `quantity`, etc.) para o formato atual;
- resolve items por ID/nome;
- recalcula `total_qty` e `total_value`;
- rejeita pedidos pendentes sem linhas válidas;
- atribui responsável em pedidos pendentes legacy sem responsável, usando requester quando possível;
- só pode ser executado por Superadmin real.

---

## 8. Receitas

Ficheiros principais:

```text
src/lib/recipes.functions.ts
src/lib/recipes.admin.functions.ts
src/routes/_authenticated/receitas.tsx
```

### 8.1 Fonte de receitas

Receitas vêm da DB:

```text
craft_recipes
recipe_ingredients
recipe_ingredient_tier_overrides
items
```

Não devem vir de `config.json` nem de seed antigo.

### 8.2 Quantidades por cargo

Na Gestão de Materiais, cada ingrediente de receita tem:

```text
Base
Bairrista-1
Bairrista-2
Bairrista-3
```

A quantidade base aplica-se a todos. Overrides por cargo ficam em `recipe_ingredient_tier_overrides`.

Exemplo:

```text
Base: 10 peças
Bairrista-1: 10 peças
Bairrista-2: 8 peças
Bairrista-3: 6 peças
```

As encomendas com materiais usam a quantidade correta conforme o cargo/tier do membro.

### 8.3 Visibilidade por permissões

Membros normais podem ver:

- materiais necessários;
- quantidades;
- total a pagar/preço final.

Membros normais **não podem ver**:

- custo de produção;
- custo por ingrediente;
- margem;
- detalhe de custos;
- custo estimado da simulação.

Chefia/manager pode ver custos e margem.

Isto deve estar protegido no backend e na UI.

---

## 9. Permissões e cargos

Ficheiros principais:

```text
src/lib/pricing.shared.ts
src/lib/pricing.server.ts
src/lib/domain.ts
```

Helpers importantes:

```text
isSuperAdmin
isAdmin
isManager
canSeeInventory
canManagePrizes
```

`CurrentMember` inclui:

```text
id
discord_id
display_name
tier
role_label
is_superadmin
is_admin
is_manager
can_see_inventory
can_manage_prizes
is_morador
is_viewing_as
actual_member_id
actual_display_name
```

Atenção: qualquer edição sensível deve ser protegida no backend, não apenas escondida na UI.

### 9.1 Cargos reais atuais

Cargo/posição principal deve usar nomes reais do Discord:

```text
Young Blood
O Gunão
Gangster Fodido
Patrão di Zona
Real Gangster
OG
Kingpin
Manda-Chuva
```

Em `domain.ts`:

- `ROLE_LABELS` = cargo visual principal.
- `TIER_LABELS` aponta para `ROLE_LABELS` para compatibilidade antiga.
- `TIER_DESCRIPTION_LABELS` = descrição secundária/tier.

Descrição de `real_gangster` foi ajustada para:

```text
Linha da frente
```

Não usar “Oficial de rua”.

---

## 10. Membros / sincronização Discord ↔ App

Este tema envolve webapp e bot.

### 10.1 Regra operacional

Só conta como membro ativo da org se tiver cargo operacional real:

```text
young_blood
 o_gunao
gangster_fodido
patrao_di_zona
real_gangster
og
kingpin
manda_chuva
```

Tags base/flavour/amigos **não contam**. Isto foi feito para evitar membros fantasma.

### 10.2 Filtros na webapp

Webapp foi filtrada para só listar/contar membros ativos com cargo/tier operacional válido em:

```text
src/lib/members.functions.ts
src/lib/dashboard.functions.ts
src/lib/leaderboard.functions.ts
```

Condições esperadas:

```sql
deleted_at is null
coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')
tier in ('young_blood','o_gunao','gangster_fodido','patrao_di_zona','real_gangster','og','kingpin','manda_chuva')
```

### 10.3 Bot automático

No repo `real-gangsta-bot`:

- `src/members/backfill.js`
  - importa/reativa membros do Discord com cargo operacional real;
  - já não aceita role base/friends como cargo operacional;
  - tolera rate limit em `guild.members.fetch()` e não crasha o arranque.

- `src/members/roleInvariants.js`
  - reconcile DB↔Discord;
  - importa/reativa quem está no Discord com cargo operacional;
  - remove/inativa quem saiu do Discord ou ficou só com tags não-operacionais;
  - limpa roles admin/superadmin da webapp para órfãos.

- `src/app/readyPhases.js`
  - corre `membershipReconcile` no arranque do bot.

- `src/jobs/scheduler.js`
  - mantém job diário `discord_membership_reconcile`;
  - já não corre duplicate reconcile no arranque para evitar rate-limit.

- `src/app/discord/lifecycle.js`
  - eventos em tempo real:
    - receber cargo operacional -> cria/reativa na app;
    - perder cargos operacionais -> inativa/remove da app;
    - subida/descida de cargo/tier -> atualiza DB/app;
    - sair do servidor -> offboarding;
    - voltar a receber cargo operacional -> reativa.

### 10.4 Auditoria de membros

Script útil no bot:

```bash
npm run audit:members
```

Mostra:

```text
Discord operacional: X
App/DB ativo:         Y
Faltam na app:        Z
Fantasmas na app:     W
Tier diferente:       N
```

Também lista nomes/Discord IDs em falta ou fantasmas.

Após a última sessão, o utilizador reportou que a contagem já ficou certa entre Discord e app.

---

## 11. Modo Superadmin “Ver como”

Ficheiros principais:

```text
src/components/layout/ViewAsSwitcher.tsx
src/lib/view-as.functions.ts
src/lib/authed-server-fn.ts
src/lib/pricing.server.ts
src/components/layout/AppShell.tsx
```

Objetivo: permitir ao Superadmin ver o site como outro membro/cargo para testar:

- permissões;
- preços por cargo;
- visibilidade de páginas;
- receitas/custos;
- encomendas/entregas;
- preçário.

Segurança:

- Não faz login real com a conta do outro user.
- Usa header interno `x-view-as-member-id`.
- Backend só aceita este header se o user real for Superadmin.
- Membros normais não devem ver nem conseguir usar.

---

## 12. Qualidade de Dados

Ficheiros principais:

```text
src/lib/data-quality-v2.functions.ts
src/routes/_authenticated/admin.dados.tsx
```

A rota atual deve importar de:

```text
@/lib/data-quality-v2.functions
```

A versão antiga `data-quality.functions.ts` existe mas não deve ser usada em novas alterações.

Checks atuais v2:

- Discord duplicado em membros ativos.
- Membros ativos sem nome/Discord.
- Encomendas abertas sem responsável válido.
- Encomendas com total incoerente.
- Entregas pendentes com linhas inválidas.
- Entregas pendentes com requerente/responsável inexistente.
- Items ativos com side/preços inválidos.
- Receitas DB com referências partidas.
- Inventário com movimentos órfãos ou stock negativo.
- Notificações pendentes antigas.

Venda válida se:

```text
min_sale_price > 0 OU purchase_price > 0
```

Compra válida se:

```text
purchase_price > 0 OU morador_purchase_price > 0
```

Botão “Reparar entregas legacy” chama `repairDeliveryLines` e só Superadmin real pode executar.

---

## 13. Painel / Casa / Classificação

Ficheiros principais:

```text
src/lib/dashboard.functions.ts
src/lib/leaderboard.functions.ts
src/routes/_authenticated/index.tsx
src/routes/_authenticated/classificacao.tsx
```

Correções importantes:

- Rankings e “Quem está a marcar pontos” passaram a usar score real de movimentos/operações/kills, filtrando membros ativos com cargo operacional.
- Dashboard/casa filtram membros fantasmas usando tier operacional válido.
- Contagens por hierarquia devem refletir apenas membros ativos válidos.

Atenção: se alguém aparecer com pontuação mas já não tem cargo operacional, verificar:

```text
src/lib/dashboard.functions.ts
src/lib/leaderboard.functions.ts
members.lifecycle_state/status/deleted_at/tier
```

---

## 14. Prémios

Ficheiros principais:

```text
src/lib/prizes.functions.ts
src/routes/_authenticated/premios.tsx
src/lib/pricing.shared.ts
```

Quem pode editar prémios:

```text
Patrão di Zona
OG
Kingpin
Manda-Chuva
Superadmin
```

Helper atual:

```text
canManagePrizes(member)
```

Campo decorado:

```text
CurrentMember.can_manage_prizes
```

Proteção:

- UI só mostra botões se `can_manage_prizes = true`.
- Backend bloqueia `setPrize` e `generatePrizeForCurrentWeek` se não tiver permissão.

Mensagem esperada:

```text
Sem permissão — apenas Chefia/Sub-Chefia pode editar prémios.
```

---

## 15. Preçário / Armazém / Catálogos

Ficheiros relacionados:

```text
src/lib/pricing.functions.ts
src/lib/pricing.resolver.ts
src/lib/inventory.functions.ts
src/routes/_authenticated/precario.tsx
src/routes/_authenticated/armazem.tsx
```

Regras:

- Catálogos públicos devem nascer da DB (`items`), não de config legacy.
- `resolveItemPrices` só deve usar campos da DB + overrides por cargo.
- Armazém/stock deve respeitar `side`, `active`, `deleted_at` e categoria da DB.
- Se um item não está ativo na Gestão de Materiais, não deve aparecer nos fluxos normais.
- Membros normais não devem receber custo interno/margem em payloads backend.

---

## 16. Bot pós-migração webapp

O bot já não deve manter painéis legacy, Google Sheets, dashboards de tópicos, ranking publicado antigo, etc. O bot corre em Railway e agora deve ficar focado em:

- Discord lifecycle.
- Onboarding/offboarding.
- Slash commands mínimos atuais.
- Sincronização membros Discord↔DB.
- Saídas/spot cooldown/request expirer.
- Health server/heartbeat Railway.
- Migrations DB.

No arranque atual, comandos slash esperados nos logs:

```text
meu-pedido, saidas, kick, primeira-vez
```

Se aparecerem jobs/painéis legacy, Google Sheets ou dashboards antigos a correr, isso é regressão.

---

## 17. Deploy e comandos locais

### Webapp

```bash
cd C:\Users\steve\Documents\gangsta-bot-web-44-github
git pull origin main
npm run build
npm run deploy
```

Depois no browser:

```text
CTRL + F5
```

### Bot

```bash
cd C:\Users\steve\Documents\real-gangsta-bot
git pull origin main
npm run start
```

### Scripts úteis do bot

```bash
npm run db:migrate
npm run repair:material-prices
npm run audit:members
```

Se `npm run db:migrate` falhar por `DATABASE_URL`, confirmar `.env`:

```bash
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL ? 'DATABASE_URL OK' : 'DATABASE_URL MISSING')"
```

Nota Cloudflare/Wrangler:

- Se aparecer `Authentication error [code: 10000]`, normalmente é sessão/API token do Wrangler.
- Resolver com login/token de Cloudflare/Wrangler, não é bug da app.

---

## 18. Regras anti-legacy

Objetivo atual:

```text
Erradicar fallback legacy para items/preços/receitas.
```

Situação:

- `pricing.resolver.ts` já não usa config legacy para inventar preços.
- `pricing.functions.ts` lê catálogo público a partir da DB.
- `recipes.functions.ts` lê receitas da DB e não deve usar receitas legacy.
- `orders.functions.ts` usa receitas DB e overrides por cargo.
- `config.loader.ts` ainda existe para config global/tier labels/filtros/operation types/prize types. Não deve ser usado como fonte de preços/receitas/items.

Pesquisar e remover usos indevidos de:

```text
getAllItems
getAllRecipes
getItemById
getNumericId
legacy
fallback
liquidacao
liquidação
dirty_money
sujo
config items
receitas antigas
```

Atenção: `dirty_money` ainda pode existir em colunas antigas/compatibilidade de schema. Na UI deve aparecer apenas **dinheiro**.

---

## 19. Decisões importantes já tomadas

1. **Gestão de Materiais é fonte de verdade.**  
   Nada de fallback legacy para items/preços/receitas.

2. **Custos internos são privados.**  
   Membros normais não podem ver custos de produção, valor estimado nem margens.

3. **Preços por cargo têm dois modos.**  
   Com materiais e só dinheiro são preços diferentes.

4. **Receitas podem variar por Bairrista.**  
   Quantidade base + overrides Bairrista-1/2/3.

5. **Responsável é obrigatório.**  
   Encomendas, entregas e vendas não devem avançar sem responsável quando o fluxo exige conferência.

6. **Edições sensíveis são backend-first.**  
   Não chega esconder botões na UI.

7. **Prémios só Chefia/Sub-Chefia.**  
   Moradores/oficiais normais podem ver, não editar.

8. **Superadmin pode auditar como outro user.**  
   Modo “Ver como” é seguro e não troca auth real.

9. **Membros ativos dependem de cargos operacionais reais no Discord.**  
   Tags de amigos/base não contam.

10. **Bot é fonte operacional para sync Discord↔DB.**  
    Entradas, saídas, subidas e descidas devem atualizar automaticamente; reconcile de arranque/diário é rede de segurança.

---

## 20. Histórico recente de commits relevantes

### Webapp `gangsta-bot-web-44`

```text
166a8d5 - Set organization material buy prices
09e11ab - Support explicit tier prices for both payment modes
1e55a07 - Resolve explicit tier prices per payment mode
018bb5a - Expose catalog prices for both payment modes
6e87080 - Return tier prices for both order modes
4db1486 - Use tier price per selected order mode
9ed9a0f - Add explicit tier prices for item payment modes
7a6befe - Add recipe quantities per bairrista tier
e6dc867 - Support recipe material quantities per tier
78a12bf - Use tier recipe quantities in orders
bae0bfe - Redesign material management price and recipe UI
00c1133 - Unify material management filters
fbb3bd8 - Use Discord rank names for cargo labels
3ca66f7 - Show tier as secondary description badge
3efa10d - Improve Real Gangster tier description
d041c93 - Filter members by active org tier
610d9e0 - Filter dashboard active members by org tier
78d6822 - Filter leaderboard by active org tier
03dc2e9 - Add repair for non org active members
432d96f - Restore member profile exports with org filters
```

### Bot `real-gangsta-bot`

```text
fa15575 - Apply web material pricing schema and buy prices
b5351bb - Load dotenv for standalone migration command
080fca7 - Repair material buy prices with robust matching
719f3ed - Add standalone material price repair script
29c6fd6 - Add material price repair npm script
2744a5e - Require operational role for member backfill
077ccf1 - Remove DB members without operational Discord role
850b589 - Run Discord membership reconcile on ready
beb00ae - Avoid duplicate Discord membership reconcile on startup
1062eaf - Backfill operational Discord members during reconcile
4769dfc - Make member backfill tolerant to Discord fetch rate limits
87fc9cc - Add Discord versus app member audit script
7cfb7dc - Add member audit npm script
cb4a815 - Create or reactivate members on operational role updates
```

---

## 21. Estado atual / próximos pontos prováveis

Verificações depois de deploy/start:

1. Gestão de Materiais mostra preços de compra atualizados para Sucata, Serradura, Aço, Pólvora, etc.
2. Materiais de compra mostram Civil/Moradores.
3. Items de venda mostram Base c/material/Base s/material/Custo.
4. Modal de edição permite preços finais por Bairrista nos dois modos.
5. Receitas permitem quantidade base + Bairrista-1/2/3.
6. Encomendas com materiais usam preço e quantidades do cargo correto.
7. Encomendas sem receita ficam dinheiro only.
8. Membros app = membros Discord com cargos operacionais reais.
9. Membros com só tag de amigos/base não aparecem.
10. Entradas/saídas/subidas/descidas no Discord atualizam app automaticamente.
11. Membros normais, via “Ver como”, não veem custos internos/margens.
12. Moradores/oficiais não conseguem editar prémios.
13. Filtros da Gestão de Materiais não estão duplicados.

Prioridade futura recomendada:

```text
1. Continuar limpeza legacy config/items/receitas.
2. Consolidar Armazém/Inventário DB-first e rever permissões.
3. Rever todas as páginas com modo Ver como.
4. Criar testes manuais/automáticos para fluxos críticos:
   - encomenda dinheiro only
   - encomenda com materiais
   - entrega stock
   - venda interna
   - edição prémio por chefia
   - bloqueio por morador/oficial
   - receitas sem custos para membros
   - sync Discord entrada/saída/subida/descida
5. Remover ficheiros mortos/rotas legacy quando for seguro.
```

---

## 22. Instruções para uma nova sessão com ChatGPT/Claude/Kimi

Quando uma nova sessão começar, dar este contexto:

```text
Lê PROJECT_CONTEXT.md primeiro.
O projeto é gangsta-bot-web-44, com bot operacional real-gangsta-bot.
Gestão de Materiais/items DB é a fonte de verdade absoluta.
Não uses config legacy para items/preços/receitas.
Membros normais não podem ver custos/margens/valor estimado.
Permissões sensíveis têm de estar protegidas no backend.
Superadmin tem modo Ver Como para testar permissões/preços.
Membros ativos vêm do Discord apenas com cargos operacionais reais.
O bot/Railway aplica migrations e sincroniza Discord↔DB.
Continua no main com commits pequenos e descritivos.
```

Se a tarefa for mexer no código:

```text
1. Procurar ficheiros relevantes.
2. Confirmar fluxo backend + UI.
3. Corrigir no backend primeiro.
4. Corrigir UI depois.
5. Commit direto no main.
6. Dizer comandos de build/deploy/start.
```

Coisas perigosas:

- Migrations destrutivas.
- Apagar dados de produção.
- Secrets/API keys.
- Force push/rebase/reset.
- Delete massivo de ficheiros.
- Alterar role IDs sem confirmar `.env`/config.

---

## 23. Glossário rápido

```text
Chefia/Sub-Chefia -> cargos altos com permissões especiais.
Superadmin -> manda_chuva / role/tier com poder total.
Morador/Oficial -> membros normais/operacionais, sem edição sensível.
Entrega -> entrada de material/stock, normalmente custo 0.
Venda interna -> venda/aquisição que precisa conferência.
Encomenda -> pedido de item por membro, com responsável.
Receita -> materiais necessários para fabricar item.
Custo/Valor estimado -> custo interno da chefia, não visível a membros.
Preço com material -> preço quando membro entrega materiais + dinheiro.
Preço sem material -> preço dinheiro only.
Preço civil -> quanto a org paga a civis por material.
Preço moradores -> quanto a org paga a membros/moradores por material.
Cargo operacional -> Young Blood, O Gunão, Gangster Fodido, Patrão di Zona, Real Gangster, OG, Kingpin, Manda-Chuva.
Membro fantasma -> membro ativo na DB/app sem cargo operacional real no Discord.
```
