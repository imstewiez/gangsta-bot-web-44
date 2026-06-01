# Project Context — gangsta-bot-web-44

> **Última atualização:** 2026-06-01  
> **Estado da sessão:** refatoração funcional de Encomendas, Entregas, Gestão de Materiais, Receitas, Prémios, Qualidade de Dados, permissões e modo Superadmin “Ver como”.  
> **Repo principal:** `imstewiez/gangsta-bot-web-44`  
> **Produto:** webapp de gestão interna da firma/bairro Ballas Gang.

---

## 1. Resumo do produto

Esta app **não é um sistema financeiro genérico nem um sistema de liquidação**. É uma webapp operacional para gestão da organização/bairro, com foco em:

- Membros, cargos, permissões e atividade.
- Encomendas feitas por membros e tratadas pela chefia/responsáveis.
- Entregas/vendas internas para stock/armazém.
- Saídas/operações.
- Prémios semanais.
- Preçário.
- Armazém/stock.
- Receitas/fabricação.
- Gestão de Materiais/Items.
- Auditoria/Qualidade de Dados.
- Modo Superadmin para “Ver como outro user”.

A regra de produto mais importante é:

```text
Gestão de Materiais / tabela items = fonte de verdade global para qualquer item.
```

Tudo o que seja item, preço, custo, receita, material, side compra/venda, XP, categoria, visibilidade, encomenda, entrega, preçário, receita ou stock deve respeitar a DB/Gestão de Materiais. Nada deve ser inventado por config legacy ou fallback antigo.

---

## 2. Stack e arquitetura

| Camada | Tecnologia |
|--------|------------|
| Framework | TanStack Start + React + Vite |
| Runtime | Cloudflare Workers |
| Database | Supabase PostgreSQL via `exec_sql` RPC / SQL direto por helpers server |
| Auth | Supabase Auth + Discord OAuth, com JWT Bearer header |
| Deploy | Wrangler / Cloudflare Workers |
| Data fetching | TanStack Query + server functions |
| UI | Componentes React internos + Tailwind/shadcn-style |

Path alias:

```text
@/ -> ./src/
```

---

## 3. Diretórios e ficheiros importantes

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
      ...

  integrations/supabase/
    auth-middleware.ts          # Middleware JWT Bearer
    client.ts                   # Supabase client
    types.ts                    # Tipos Supabase

  lib/
    pg.server.ts                # Helper SQL/exec_sql
    pricing.server.ts           # resolveCurrentMember + view-as seguro
    pricing.shared.ts           # helpers permissões + CurrentMember
    pricing.functions.ts        # catálogo/preçário DB-first
    pricing.resolver.ts         # resolve preços exclusivamente da DB
    orders.functions.ts         # Encomendas
    deliveries.functions.ts     # Entregas/vendas internas
    inventory.functions.ts      # Armazém/stock
    recipes.functions.ts        # Receitas/fabricação
    prizes.functions.ts         # Prémios
    members.functions.ts        # Membros/managers
    view-as.functions.ts        # targets do modo Ver Como
    data-quality-v2.functions.ts# Auditoria DB-first atual
    data-quality.functions.ts   # Auditoria antiga/legada, não usar em novas rotas
    config.loader.ts            # Ainda usado para config global/tier labels/filtros, NÃO como fonte de items/preços
    authed-server-fn.ts         # Envia Authorization + x-view-as-member-id
    armory.catalog.ts           # Helpers visuais/categorias de catálogo

  routes/_authenticated/
    encomendas.tsx              # UI de encomendas
    entregas.tsx                # UI de entregas/vendas internas
    receitas.tsx                # UI de receitas
    premios.tsx                 # UI de prémios
    admin.dados.tsx             # UI Qualidade de Dados, usa data-quality-v2
    admin.dashboard.tsx         # Painel chefia / ciclos encomendas
    ...
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

Surcharges por cargo continuam em:

- `item_tier_surcharges`

### 4.2 Side dos items

```text
side = venda  -> firma vende esse item; aparece em preçário/encomendas/vendas.
side = compra -> firma compra/recebe esse item; aparece em entregas/preçário de compra.
side = ambos  -> aparece nos dois lados.
```

### 4.3 Semântica atual dos preços

A nomenclatura visual ainda tem algum histórico, mas a lógica atual é:

#### Items de venda

- `min_sale_price` = preço com material / preço base com material.
- `purchase_price` = preço sem material.
- `estimated_value` = custo interno / custo de produção / valor interno da chefia.
- `item_tier_surcharges` = ajustes por cargo, aplicados sobre o preço com material quando aplicável.

Um item de venda é válido se tiver **preço com material OU preço sem material**.

#### Items de compra

- `purchase_price` = preço civil / preço compra civil.
- `morador_purchase_price` = preço organização / preço para membros.
- `min_sale_price` também pode existir em material de compra como valor configurado antigo/definido; a auditoria v2 considera isto válido para não criar falso positivo.

Um item de compra é válido se tiver **preço civil OU preço organização OU valor definido**.

### 4.4 Custo interno

Custo de produção/valor interno é `estimated_value`.

Este valor **não pode aparecer a membros normais**.

---

## 5. Regra anti-legacy

Objetivo atual:

```text
Erradicar fallback legacy para items/preços/receitas.
```

Situação atual do código:

- `pricing.resolver.ts` já não usa config legacy para inventar preços.
- `pricing.functions.ts` lê catálogo público a partir da DB.
- `recipes.functions.ts` lê receitas da DB e não deve usar receitas legacy.
- `orders.functions.ts` foi atualizado para remover fallback de receitas por config.
- `config.loader.ts` ainda existe para coisas globais como tiers, labels, filtros, operation types e prize types. Não deve ser usado como fonte de preços/receitas/items.

Ao continuar o projeto, pesquisar e remover usos indevidos de:

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
```

Atenção: o termo `dirty_money` ainda pode existir em colunas antigas/compatibilidade de schema. Não deve ser mostrado na UI como “dinheiro sujo”. Na UI deve aparecer simplesmente **dinheiro**.

---

## 6. Encomendas

Ficheiros principais:

```text
src/lib/orders.functions.ts
src/routes/_authenticated/encomendas.tsx
```

### 6.1 Fluxo de estados

Estados permitidos:

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
- Ingredientes vêm de `craft_recipes`/`recipe_ingredients`.
- Preços vêm da DB/Gestão de Materiais.
- Sem `dirty_money`/“dinheiro sujo” na UI.

### 6.4 Movimento de stock

Ao marcar encomenda como `fulfilled`, cria movimento de stock `venda_bairrista` com quantidade negativa do item vendido.

---

## 7. Entregas e vendas internas

Ficheiros principais:

```text
src/lib/deliveries.functions.ts
src/routes/_authenticated/entregas.tsx
```

### 7.1 Tipo de pedido

```text
entrega -> membro entrega stock/material à firma; normalmente entra a custo 0.
venda   -> venda/aquisição interna a conferir.
```

### 7.2 Responsável obrigatório

Entrega/venda nova não pode ser submetida sem responsável.

Isto é validado na UI e no backend.

### 7.3 Conferência

A tab “Para conferir” mostra pendentes do responsável/superadmin.

Pedidos legacy sem responsável ainda podem aparecer em checks de Qualidade de Dados e podem ser normalizados pelo repair.

### 7.4 Reparação legacy

`data-quality-v2.functions.ts` tem `repairDeliveryLines`, que:

- normaliza linhas antigas (`itemId`, `itemName`, `quantity`, etc.) para o formato atual;
- resolve items por ID/nome;
- recalcula `total_qty` e `total_value`;
- rejeita pedidos pendentes sem linhas válidas;
- atribui responsável em pedidos pendentes legacy sem responsável, usando o requester quando possível;
- só pode ser executado por Superadmin real.

---

## 8. Receitas

Ficheiros principais:

```text
src/lib/recipes.functions.ts
src/routes/_authenticated/receitas.tsx
```

### 8.1 Fonte de receitas

Receitas vêm da DB:

```text
craft_recipes
recipe_ingredients
items
```

Não devem vir de `config.json` nem de seed antigo.

### 8.2 Visibilidade por permissões

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

Isto está protegido no backend e na UI:

- Backend: `listRecipes`, `computeCraftFeasibility`, `computeCraftFeasibilityBatch` devolvem custos a 0 para não-managers.
- UI: blocos de custo/margem escondidos para não-managers.

---

## 9. Prémios

Ficheiros principais:

```text
src/lib/prizes.functions.ts
src/routes/_authenticated/premios.tsx
src/lib/pricing.shared.ts
```

### 9.1 Quem pode editar prémios

Apenas Chefia/Sub-Chefia:

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

### 9.2 Proteção

- UI só mostra botões de editar/definir se `can_manage_prizes = true`.
- Backend bloqueia `setPrize` e `generatePrizeForCurrentWeek` se não tiver permissão.

Mensagem esperada:

```text
Sem permissão — apenas Chefia/Sub-Chefia pode editar prémios.
```

---

## 10. Permissões e cargos

Ficheiros principais:

```text
src/lib/pricing.shared.ts
src/lib/pricing.server.ts
```

Helpers importantes:

```text
isSuperAdmin
isAdmin
isManager
canSeeInventory
canManagePrizes
```

`CurrentMember` inclui atualmente:

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

### 11.1 Objetivo

Permitir ao Superadmin ver o site como outro membro/cargo para testar:

- permissões;
- preços por cargo;
- visibilidade de páginas;
- receitas/custos;
- encomendas/entregas;
- preçário.

### 11.2 Segurança

Não faz login real com a conta do outro user.

Usa header interno:

```text
x-view-as-member-id
```

O backend só aceita este header se o user real for Superadmin.

Código mental:

```text
actual = resolveActualMember()
if !actual.is_superadmin -> ignora x-view-as-member-id
se target válido -> resolveCurrentMember devolve target decorado + is_viewing_as
```

### 11.3 UI

O switcher aparece no header para:

- Superadmin real;
- Superadmin em modo view-as, para conseguir sair do modo.

Membros normais não devem ver nem conseguir usar.

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

### 12.1 Checks atuais da v2

A auditoria v2 está focada em problemas operacionais reais:

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

### 12.2 Validação de preço na auditoria v2

Venda válida se:

```text
min_sale_price > 0 OU purchase_price > 0
```

Compra válida se:

```text
purchase_price > 0 OU morador_purchase_price > 0 OU min_sale_price > 0
```

Isto evita falsos positivos em materiais de compra onde o valor está no campo definido/com_material.

### 12.3 Repair

Botão “Reparar entregas legacy” chama `repairDeliveryLines`.

Só Superadmin real pode executar.

Depois do último commit relacionado, espera-se que:

- os 19 falsos positivos de items de compra desapareçam depois de build/deploy/reanalisar;
- entrega pendente sem responsável seja reparada ao carregar no botão repair;
- restem apenas problemas reais como notificações antigas, encomendas abertas sem responsável, dados incompletos de membros, etc.

---

## 13. Painel Chefia / ciclos de encomendas

Ficheiros principais:

```text
src/lib/admin.dashboard.functions.ts
src/routes/_authenticated/admin.dashboard.tsx
```

Correção importante já feita:

- Custo dos ciclos deve usar `items.estimated_value`, não preço de venda/sem material.

Exemplo esperado:

```text
AP Pistol custo 27k
15x AP Pistol -> custo 405k
```

Não usar `purchase_price` como custo interno se esse campo representa preço sem material/preço de venda.

---

## 14. Preçário / Armazém / Catálogos

Ficheiros relacionados:

```text
src/lib/pricing.functions.ts
src/lib/pricing.resolver.ts
src/routes/_authenticated/precario.tsx
src/lib/inventory.functions.ts
```

Regras:

- Catálogos públicos devem nascer da DB (`items`), não de config legacy.
- `resolveItemPrices` só deve usar campos da DB + surcharges por cargo.
- Armazém/stock deve respeitar `side`, `active`, `deleted_at` e categoria da DB.
- Se um item não está ativo na Gestão de Materiais, não deve aparecer nos fluxos normais.

---

## 15. Deploy e comandos locais

Workflow normal do utilizador:

```bash
git pull origin main
npm run build
npm run deploy
```

Ou, dependendo do setup local:

```bash
npx wrangler deploy
```

Nota importante de Cloudflare/Wrangler:

- Se aparecer `Authentication error [code: 10000]`, normalmente é sessão/API token do Wrangler.
- Resolver com login/token de Cloudflare/Wrangler, não é bug da app.

---

## 16. Decisões importantes já tomadas

1. **Gestão de Materiais é fonte de verdade.**  
   Nada de fallback legacy para items/preços/receitas.

2. **Custos internos são privados.**  
   Membros normais não podem ver custos de produção nem margens.

3. **Responsável é obrigatório.**  
   Encomendas, entregas e vendas não devem avançar sem responsável quando o fluxo exige conferência.

4. **Edições sensíveis são backend-first.**  
   Não chega esconder botões na UI.

5. **Prémios só Chefia/Sub-Chefia.**  
   Moradores/oficiais normais podem ver, não editar.

6. **Superadmin pode auditar como outro user.**  
   Modo “Ver como” é seguro e não troca auth real.

7. **Qualidade de Dados deve apontar problemas reais, não histórico legacy irrelevante.**  
   Falsos positivos devem ser removidos da auditoria.

---

## 17. Histórico recente de commits relevantes

Commits/changelogs recentes que alteraram lógica importante:

```text
cf064ab - Make order actions independent from fragile stored procedures
083ffb0 - Make catalog use item management as source of truth
c140e58 - Stop showing legacy recipes in order material quotes
72e32ac - Require responsible and valid lines in delivery UI
f3b0743 - Require responsible for delivery creation
96ed477 - Use configured internal cost for order cycle profit
77cebaf - Use item management cost in recipe breakdowns
818144a - Make DB item fields the only pricing source
26d3ea1 - Remove legacy config from public catalogs
ad5efae - Add secure view-as member resolution
dacd699 - Expose view-as metadata on current member
ad7a866 - Attach view-as header to server functions
b93baa0 - Add view-as audit server functions
dc5a08a - Add view-as switcher component
2043f02 - Show view-as switcher in app shell
4c03d64 - Hide recipe cost data from non-management users
d1041db - Hide recipe cost breakdown UI for regular members
367e288 - Add strict prize management permission helper
dc98047 - Decorate members with prize permissions
079af63 - Restrict prize edits to leadership roles
5fd8d3e - Use strict prize edit permission in UI
ef84e97 - Add DB-first data quality report without price false positives
94a25b5 - Use DB-first data quality report route
530c070 - Treat buy-side configured material price as valid and repair missing delivery responsible
```

---

## 18. Estado atual / próximos pontos prováveis

Após o último deploy e “Reanalisar” na página Dados, verificar:

1. Se os falsos positivos dos 19 items de compra desapareceram.
2. Se o botão “Reparar entregas legacy” remove a entrega pendente sem responsável.
3. Se ainda há encomendas abertas sem responsável.
4. Se há notificações antigas pendentes.
5. Se membros normais, via “Ver como”, não veem custos nas receitas.
6. Se moradores/oficiais não conseguem editar prémios.
7. Se items sem receita não mostram opção “com materiais” nas encomendas.
8. Se qualquer item exibido no projeto bate com o que está na Gestão de Materiais.

Prioridade futura recomendada:

```text
1. Acabar limpeza legacy config/items/receitas.
2. Consolidar Armazém/Inventário DB-first.
3. Rever permissões de todas as páginas com o modo Ver como.
4. Criar testes manuais/automáticos para fluxos críticos:
   - encomenda dinheiro only
   - encomenda com materiais
   - entrega stock
   - venda interna
   - edição prémio por chefia
   - bloqueio por morador/oficial
   - receitas sem custos para membros
5. Remover ficheiros mortos/rotas legacy quando o conector permitir alteração destrutiva segura.
```

---

## 19. Instruções para uma nova sessão com ChatGPT/Claude/Kimi

Quando uma nova sessão começar, dar este contexto:

```text
Lê PROJECT_CONTEXT.md primeiro.
O projeto é gangsta-bot-web-44.
Gestão de Materiais/items DB é a fonte de verdade absoluta.
Não uses config legacy para items/preços/receitas.
Membros normais não podem ver custos/margens.
Permissões sensíveis têm de estar protegidas no backend.
Superadmin tem modo Ver Como para testar permissões/preços.
Continua no main com commits pequenos e descritivos.
```

Se a tarefa for mexer no código:

```text
1. Procurar ficheiros relevantes.
2. Confirmar fluxo backend + UI.
3. Corrigir no backend primeiro.
4. Corrigir UI depois.
5. Commit direto no main.
6. Dizer comandos de build/deploy.
```

Coisas perigosas que ainda devem ser tratadas com cuidado:

- Migrations destrutivas.
- Apagar dados de produção.
- Secrets/API keys.
- Force push/rebase/reset.
- Delete massivo de ficheiros se o conector bloquear safety checks.

---

## 20. Glossário rápido

```text
Chefia/Sub-Chefia -> cargos altos com permissões especiais.
Superadmin -> manda_chuva / role/tier com poder total.
Morador/Oficial -> membros normais/operacionais, sem edição sensível.
Entrega -> entrada de material/stock, normalmente custo 0.
Venda interna -> venda/aquisição que precisa conferência.
Encomenda -> pedido de item por membro, com responsável.
Receita -> materiais necessários para fabricar item.
Custo/Valor estimado -> custo interno da chefia, não visível a membros.
Preço com material -> preço base quando membro entrega materiais.
Preço sem material -> preço dinheiro only.
Preço civil/organização -> preços de compra de materiais.
```
