## Resumo

Pacote grande com várias áreas. Faço por blocos para conseguir entregar com qualidade. Confirma se queres tudo ou se preferes que parta em fases.

---

## 1. Inventário (`/inventario`)

- Mostrar **todos** os itens organizados por categoria, em vez de uma lista plana só com armas.
- Categorias visíveis e ordem fixa, com ícones/cores próprias:
  - 🟧 **Armas Orange**
  - 🟥 **Armas Red**
  - 🔪 **Armas Brancas**
  - 💊 **Drogas**
  - 📦 **Materiais** com sub-grupos:
    - Matérias-primas
    - Lixo / sucata
    - Outros
- Cada categoria como secção colapsável com cabeçalho colorido, contagem total e valor.
- Mantém regra de gating: só Patrão di Zona, OG e Chefia veem/gerem.

> Nota técnica: vou ler `items` e usar `category` + `subcategory`. Se faltarem categorias na BD, mapeio no frontend.

---

## 2. Entregas (`/entregas`)

- No formulário de nova entrega, escolher **Tipo**: 
  - 🟢 **Entregar ao bairro** (vai parar ao stock — atual)
  - 💰 **Vender ao bairro** (entra como pedido de compra do bairro)
- Estados visuais distintos:
  - Entrega: `pendente → entregue`
  - Venda: `pendente → comprar → comprado/pago`
- Chefia decide aprovar/recusar, e marca como pago no caso de venda.
- Stock continua a aumentar quando a operação é finalizada (entregue ou comprado).

> Tecnicamente uso `inventory_delivery_requests.tipo` (já existe) com valores `entrega` ou `venda` e adapto labels/fluxo.

---

## 3. Receitas (`/receitas`)

- Margem de lucro da organização **só visível para chefia** (`is_manager`).
- Restantes membros veem só ingredientes + preço de venda.

---

## 4. Saídas (`/operacoes`) — refeito

- **Apagar** página de Liquidação (`/liquidacao`) e mover tudo para Saídas.
- Só Patrão di Zona, Real Gangster, OG e Chefia podem **abrir/fechar** sessões e ser líder.
- Ao abrir sessão:
  - Líder = utilizador atual (predefinido)
  - Data/hora = `now()`
  - Tipo = `Pista` ou `Spot`
  - Se `Spot` → campo Spot obrigatório + limite de **12 caracterizados**, restantes entram como `trabalhador`.
  - Se `Pista` → sem campo Spot, sem limite de caracterizados.
- **Flow membros:**
  - Sessão aberta aparece com botão "Aderir" → escolhem papel (caracterizado/trabalhador, conforme vagas).
- **Encerramento:**
  - Líder fecha manualmente, ou auto-fecha após **12h**.
  - Ao fechar, se houve fight: admin/líder marca `houve_fight=true` + `inimigo`.
  - Cada membro presente preenche: morreu? quantos matou?
  - Fecha mesmo sem todos terem respondido.
- Liquidação automática nesta mesma tab.

> Tecnicamente: novas colunas em `operations` (`enemy`, `had_fight`, `auto_close_at`) + tabela `operation_participants` com `role`, `died`, `kills`, `joined_at`. Cron de 15min a fechar sessões > 12h.

---

## 5. Acesso / Onboarding

- Remover página de aprovação de acesso (`/onboarding` e fluxo associado).
- Quem fizer login com Discord → entra direto. O gating efetivo (membros) já vem do bot via `members.discord_id`.
- Se o utilizador não estiver em `members`, mostro ecrã "Sem acesso — fala com a chefia no Discord" em vez de aprovar.

---

## 6. Auditoria (`/auditoria`)

- Log centralizado de **tudo** o que acontece:
  - Encomendas criadas/aprovadas/recusadas/entregues
  - Entregas/vendas criadas e decididas
  - Movimentos de stock
  - Saídas abertas/fechadas, adesões, fight, kills
  - Edições de preçário, receitas, membros
  - Logins
- UI: tabela com filtros por tipo, ator, data, pesquisa livre.

> Tecnicamente: tabela `audit_log (actor_member_id, action, entity, entity_id, payload jsonb, created_at)` + helper `logAudit()` chamado em todas as server functions de escrita.

---

## 7. Leaderboards / Tops (`/tops`)

- Três abas: **Geral**, **Mensal**, **Semanal**.
- Selector de data (semana / mês específico).
- Para cada vista mostrar:
  - Pódio top 3 + tabela top 20
  - KPIs do período: nº encomendas, nº entregas, nº vendas, € movimentados
  - Stats PvP: kills, mortes, K/D, sessões, fights ganhos
- Tudo com visual cuidado, medalhas, barras, etc.

---

## 8. Polish geral

- Todos os labels em PT-PT bairrista, sem `_`.
- Emojis e ícones consistentes em todas as páginas.
- Cores de status já corrigidas anteriormente — aplico mesma paleta em saídas/entregas/auditoria.

---

## Ordem de execução proposta

1. Inventário por categorias (rápido, frontend)
2. Entregas com tipo venda/entrega
3. Receitas — gating margem
4. Remover onboarding/aprovação
5. Auditoria (migration + logging em writes existentes)
6. Saídas refeito + apagar liquidação + cron auto-close
7. Tops refeito
8. Polish final

---

## Migrations necessárias

- `audit_log` (nova)
- `operations`: colunas `enemy text`, `had_fight bool`, `auto_close_at timestamptz`, `max_caracterizados int default 12`
- `operation_participants`: colunas `role text` ('caracterizado'|'trabalhador'), garantir `died`, `kills`
- `inventory_delivery_requests`: garantir suporte a `tipo='venda'` + estado `paid`
- `pg_cron` job para fechar saídas > 12h

---

## Pergunta antes de avançar

Queres que eu **execute tudo de uma vez** (vai demorar, várias migrations e ficheiros), ou preferes que comece pelos blocos 1–4 (sem mexer em saídas/auditoria) e depois faço a parte pesada num segundo passo?