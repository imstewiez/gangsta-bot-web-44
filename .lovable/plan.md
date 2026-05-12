# Preçário, Encomendas, Entregas e Notificações

A maior parte da infraestrutura já existe na BD Railway. Não preciso de criar tabelas novas para orders nem entregas — basta seed de preços, uma coluna extra para drogas (preço morador vs civil), pricing engine no servidor, UIs novas e notificações in-app via Supabase.

## Mapeamento de escalões (members.tier)

A coluna `members.tier` já existe com exactamente os valores certos:

| Tier (DB) | Nome | Margem sobre preço base | Pode gerir encomendas/entregas |
|-----------|------|------------------------|-------------------------------|
| `young_blood` | YB (Bairrista N1) | +1.5% | não |
| `o_gunao` | GN (Bairrista N2) | +1.0% | não |
| `gangster_fodido` | GF (Bairrista N3) | +0.5% | não |
| `patrao_di_zona` | Patrão di Zona | 0% | **sim** |
| `real_gangster` | Real Gangster (oficial N1) | 0% | não |
| `og` | OG (oficial N2) | 0% | não |
| `kingpin` | Kingpin (sub-chefe) | 0% | **sim** |
| `manda_chuva` | Manda-Chuva (chefe) | 0% | **sim** |

`role = 'chefia'` também tem permissão de gestão (já mapeado no `auth.tsx`).

## Fase 1 — Seed do catálogo de preços

- Migration na Railway via script (não Supabase) para:
  - Adicionar `items.morador_purchase_price numeric(12,2)` (NULL = não aplicável; só usado para drogas)
  - Adicionar `items.subcategory text` para distinguir grupos de venda (`armas_orange`, `armas_red`, `armas_brancas`, `carregadores`, `coletes`, `acessorios`) e de compra (`lixo`, `madeiras`, `materias_primas`, `minerios`, `corpos`, `prints`, `drogas`)
  - Adicionar `items.side text check (side in ('compra','venda','ambos'))` — define se é item que a org compra a fora ou vende a membros
- Script `scripts/seed-pricing.ts` que faz UPSERT por `name` com a tabela completa que enviaste (lixo, madeiras, mat-primas, minérios, corpos, prints, drogas com civil+morador, armas brancas/orange/red, carregadores, coletes, acessórios)
- `purchase_price` = preço que a org paga ao receber (civil para drogas, único para o resto)
- `min_sale_price` = preço base de venda
- Output: tabela `items` totalmente alinhada com o teu preçário

## Fase 2 — Pricing engine + página Preçário

- `src/lib/pricing.functions.ts`:
  - `getCatalog()` → devolve items agrupados por categoria/subcategoria
  - `getSalePrice({ itemId, memberId })` → aplica margem por tier do member
  - `tierMargin(tier)` helper puro (1.5/1.0/0.5/0)
- Página `/_authenticated/precario.tsx` (substitui/expande a actual):
  - Tabs: **Compramos** (lixo, madeiras, mat-primas, minérios, corpos, prints, drogas) e **Vendemos** (armas brancas, orange, red, carregadores, coletes, acessórios)
  - Coluna preço base; nas drogas duas colunas (Morador / Civil)
  - Nas armas/equip mostra o preço final consoante o tier do utilizador autenticado (ex.: "para ti: 65 975 (YB +1.5%)") + tabela colapsável com preço por escalão
  - Editável só por chefia/manda_chuva/kingpin/patrao_di_zona

## Fase 3 — Encomendas (orders)

A tabela `orders` já tem o flow completo (`pending → approved → in_progress → ready → fulfilled | denied | cancelled`).

- `src/lib/orders.functions.ts` (refactor):
  - `createOrder({ itemId, qty, notes })` — qualquer membro autenticado; valida que o item é de venda; calcula `unit_price` com margem do tier; status inicial `pending`
  - `listOrders({ scope })` — `mine` para o requisitante; `manage` só para gestores (patrão/kingpin/manda-chuva/chefia)
  - `transitionOrder({ id, to })` — gestor only; valida transições permitidas; escreve em `order_status_history`; cria notificações
- Página `/_authenticated/encomendas.tsx` (refactor):
  - Aba "Minhas encomendas" — qualquer membro
  - Aba "Gestão" — só gestores; mostra fila pending, em curso, prontas
  - Botões por estado: Aprovar / Rejeitar / Marcar em curso / Marcar pronta / Confirmar entrega
  - Mostra preço unitário + total + estado + histórico

## Fase 4 — Entregas de material + Notificações in-app

- Entregas (já existe `inventory_delivery_requests`):
  - Página `/_authenticated/entregas.tsx`:
    - Membro entrega material → cria pedido `tipo='entrega'` com linhas (item + qty)
    - Calcula `total_value` usando `purchase_price` (drogas: usa `morador_purchase_price` se o requisitante é membro, senão `purchase_price`)
    - Gestor aprova / rejeita; quando aprovado, cria movimentos em `inventory_movements` (já há essa tabela)
- Notificações in-app:
  - Migration **Supabase** (não Railway, porque está ligada à auth): tabela `notifications (id, user_id, type, title, body, link, read_at, created_at)` com RLS (user só vê as suas)
  - Server fn dispara insert para o gestor quando há novo pedido/encomenda; insere para o requisitante quando há mudança de estado
  - Sino no `TopNav` com contador de não-lidas + dropdown com lista; marca como lida ao abrir
  - Realtime: `supabase.channel().on('postgres_changes', ...)` para actualizar em vivo

## Detalhes técnicos

- Mapeamento `member ↔ supabase user_id`: já existe via `profiles.discord_id`. Resolver tier do utilizador autenticado fazendo `members.discord_id = profiles.discord_id`. Vou criar helper `getCurrentMember()` em `src/lib/members.functions.ts`.
- Permissões "gestor" centralizadas em helper `isOrderManager(member)` baseado em tier∈{patrao_di_zona, kingpin, manda_chuva} OU role='chefia'.
- Todas as transições escrevem em `order_status_history` (já existe) e disparam notificação.
- A migration Supabase (Fase 4) precisa de approval do utilizador antes de executar — vou pedir nesse momento.

## Ordem de execução

```text
1. Adicionar colunas + seed preços (Railway, via script)
2. Pricing engine + página Preçário
3. Refactor Encomendas (UI + flows)
4. Entregas + tabela notifications (Supabase migration)
```

Pronto a executar quando aprovares. Posso fazer as 4 fases seguidas, ou paro entre cada uma para validares.