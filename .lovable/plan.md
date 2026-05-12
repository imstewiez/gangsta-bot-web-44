## Objetivo
Implementar todas as alterações pedidas de forma uniforme e coerente — sem dados confidenciais para membros normais, com material/custos visíveis nas encomendas, leaderboard público, e UI 100% polida com ícones em todo o lado.

---

## 1. Painel "Casa" (dashboard) — público, sem dados de chefia
**Tirar:** tags por tratar, saídas em aberto, stock total.
**Pôr (visível a todos):**
- Entradas novas da semana (membros que entraram nos últimos 7 dias)
- Total de saídas registadas (movimentos `venda_*` + `entrega_*` da semana)
- Total de kills da semana (soma de `weekly_rankings.kills`)
- Total de operações/vitórias da semana
- Premiado da semana (vencedor do top semanal — nome + score + tier)
- Top 5 semanal e mensal (já existe, manter)

Criar nova server fn `getHomeKpis` separada de `getDashboardKpis` (esta passa a ser só para `/admin` se quiseres manter os dados internos lá).

## 2. Perfil de membro `/membros/$id`
**Diagnóstico:** o link existe e o painel de chefia já está implementado em `MemberAdminPanel`. Vou:
- Verificar com `invoke-server-function` porque é que `getMember` poderá estar a falhar (provavelmente erro de query).
- Garantir que página abre, mostra stats completos (kills, mortes, K/D, entregas, vendas, operações, vendas de bairrista, vendas de morador), histórico, e o painel admin para chefia.
- Acrescentar botão "Voltar" e ícones em cada card.

## 3. Precário — tirar armas brancas
Filtrar `category != 'arma_branca'` (e variantes `armas_brancas`, `melee`) na query `listPricing`. Também esconder do dropdown de itens nas encomendas.

## 4. Inventário/Stock — reorganizar categorias
- Excluir armas brancas.
- Reclassificar (via UPDATE no `items.category`/`subcategory`):
  - **Armas Orange:** Compact Rifle (Drako), SNS Pistol, Pistol XM3
  - **Armas Red:** restantes armas de fogo
  - **Acessórios:** silenciador, mira, lanterna, carregadores
- Ordenar dentro de cada categoria por preço **decrescente**.
- Adicionar ícones por categoria e secções colapsáveis bonitas.

> ⚠️ Para reclassificar preciso de saber os nomes/IDs exactos dos itens. Vou primeiro fazer `SELECT` e depois apresentar a proposta de UPDATE para confirmares antes de aplicar.

## 5. Encomendas — mostrar material + valor
- Em cada item da seleção: mostrar material necessário (ingredientes do `craft_recipes`) + valor total do item.
- No fim do carrinho: somatório de **todo** o material necessário agregado + valor total.
- Para armas Orange: só peças de craft.
- Para armas Red: peças de craft + print necessária (campo já existe nas receitas? confirmar).

## 6. Saídas (operações) — auto-fechar 12h
Criar `pg_cron` job que corre de hora a hora:
```sql
update operations
set status = 'fechada_auto', closed_at = now()
where status in ('planeada','em_curso','agendada','iniciada','em_liquidacao')
  and started_at < now() - interval '12 hours';
```

## 7. Tops → Leaderboard público
- Renomear separador "Tops" para **"Leaderboard"** (ícone troféu).
- Mostrar **todos** os membros (não só top 5), com kills, mortes, K/D, entregas, vendas, operações, score, ranking semanal e mensal.
- Acessível a todos os membros autenticados (já é).
- Tabela ordenável + filtros (semana / mês / tudo).

## 8. Prémios
Manter a tab para chefia gerir.
Mostrar o **premiado da semana** também na Casa (ponto 1).

## 9. Auditoria — legível
Substituir códigos por labels PT em `auditoria.tsx`:
```
member_promoted     → "Promoção"
member_demoted      → "Despromoção"
member_kicked       → "Expulsão"
member_renamed      → "Renomeação"
order_created       → "Encomenda criada"
order_fulfilled     → "Encomenda entregue"
inventory_in/out    → "Entrada/Saída de stock"
operation_started   → "Operação iniciada"
...
```
+ ícone por tipo de ação + cor (verde/vermelho/amarelo).

## 10. UI/UX uniforme — ícones em TODO o lado
- Cabeçalho de cada `Card` com ícone à esquerda do título.
- Cada `PageHeader` com ícone temático ao lado do eyebrow.
- Tabelas com ícones nas colunas (kills 🗡, money 💰, etc — mas usando lucide).
- Botões de ação sempre com ícone + texto.
- Substituir todos os emojis residuais por ícones lucide.

## Ordem de execução
1. **Investigar** perfil de membro (porque é que não abre) + listar items+categorias da DB
2. **Reclassificar items** (com confirmação tua)
3. **Casa** redesenhar (`getHomeKpis` + UI nova)
4. **Precário/Stock** — filtros + organização
5. **Encomendas** — materiais + totais
6. **Auditoria** — labels + ícones
7. **Leaderboard** — refazer tops
8. **Prémio na Casa** + cron 12h
9. **Polish global** de ícones e cabeçalhos

---

## Perguntas antes de avançar
1. **Auto-fechar saídas:** queres que o estado final seja `fechada_auto` (novo) ou `cancelada`/`fechada` (existente)?
2. **Tops/Leaderboard:** queres manter o nome "Tops" no menu mas com tabela completa por baixo, ou renomear mesmo para "Leaderboard"?
3. **Confirmas** que posso fazer `UPDATE` directo em `items` para reclassificar Drako/SNS/XM3 como Orange e o resto das armas como Red, depois de eu te mostrar a lista actual?
4. **Print necessária para Red weapons:** existe já no schema (campo na receita) ou preciso adicionar?

Assim que respondas (ou disseres "avança e decide tu"), começo pela investigação + correcção do perfil de membro e sigo a ordem acima.
