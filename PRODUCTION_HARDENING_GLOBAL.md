# Production Hardening Global — gangsta-bot-web-44

Este documento é o tracker global de auditoria/estabilização do projeto. A prioridade é transformar a app de um sistema funcional mas frágil num produto consistente, previsível e seguro em produção.

## Objetivo

A webapp deve ter uma única fonte de verdade para:

- membros, cargos e permissões;
- itens, compra, venda, preços por cargo e custo;
- receitas e materiais;
- encomendas;
- entregas de stock;
- armazém/inventário;
- saídas;
- prémios/rankings;
- auditoria/dados;
- UI/UX/copy.

## Regra de domínio atual

### Itens que a organização compra

Campos oficiais:

- `purchase_price` = preço civil, isto é, preço a que a organização compra a civis;
- `morador_purchase_price` = preço organização, isto é, preço a que a organização compra a membros;
- entregas de stock por bairristas = custo 0;
- não têm fluxo de encomenda com materiais.

### Itens que a organização vende

Campos oficiais:

- `min_sale_price` = preço com material;
- `purchase_price` = preço sem material;
- `estimated_value` = custo interno/produção/valor estimado;
- `item_tier_surcharges` = compatibilidade interna para preços finais por cargo;
- UI deve mostrar preço final por cargo, não acréscimo;
- se tiver receita, pode ter opção com materiais;
- se não tiver receita, só pode ser dinheiro.

## Fluxos críticos e critérios de aceitação

### 1. Gestão de Materiais

Estado esperado:

- todos os itens são geridos em Admin → Materiais;
- compra e venda não podem ser confundidas;
- campos aparecem por contexto, não tudo ao mesmo tempo;
- receitas são editáveis na mesma área;
- item sem receita não pode oferecer compra com materiais;
- preço por cargo é inserido como valor final.

Riscos atuais a continuar a rever:

- `purchase_price` ainda serve para preço civil em compra e preço sem material em venda;
- isto é compatível com a DB atual, mas a UI precisa de copy forte para evitar erro humano;
- validar saves para impedir preços zerados em itens ativos.

### 2. Encomendas

Estado esperado:

- com materiais = entrega receita definida + paga preço com material/preço cargo;
- sem materiais = paga preço sem material definido;
- sem receita = só dinheiro;
- nunca mostrar dinheiro sujo;
- nunca calcular taxa automática se existe preço sem material definido;
- botões por estado devem ser mínimos e claros.

Riscos a continuar a rever:

- encomendas antigas podem ter `dirty_money`, `material_cost` ou `payment_mode` legacy;
- listagem deve tolerar legacy sem mostrar labels erradas;
- stored procedure `sp_transition_order` deve respeitar o stock e status de forma atómica.

### 3. Entregas

Estado esperado:

- entrega de stock feita por bairrista entra a custo 0;
- venda/compra paga é fluxo distinto;
- linhas legacy (`itemId`, `quantity`, `itemName`) são normalizadas antes de aprovar;
- aprovação não deve rebentar por JSON antigo.

Riscos a continuar a rever:

- dados antigos em `inventory_delivery_requests.lines` podem continuar sujos;
- auditoria deve distinguir inválido real de legacy reparável.

### 4. Armazém / Inventário

Estado esperado:

- armazém mostra itens ativos da DB, não só config antigo;
- stock negativo é alerta crítico;
- movimentos órfãos são alerta crítico;
- ledger não deve esconder itens DB-only.

Riscos a continuar a rever:

- confirmar se stored procedures de stock usam o mesmo conceito de preço/custo;
- validar se movimentos de encomenda e entrega atualizam stock de forma coerente.

### 5. Saídas

Estado esperado:

- vocabulário principal é Saídas;
- remover ou esconder fluxos de liquidação se já não fizerem parte do produto real;
- se existir fecho de saída, deve chamar-se Fechar/Concluir, não Liquidação;
- botões de convite/cancelar/remover devem aparecer só quando fazem sentido.

Riscos a continuar a rever:

- existe código antigo chamado `liquidation.functions.ts` ainda usado por `/operacoes/$id`;
- deve ser renomeado/refatorizado ou neutralizado sem partir estatísticas.

### 6. Membros / Cargos / Estatísticas

Estado esperado:

- listagem usa sempre o mesmo conceito de membro ativo;
- alterações perigosas pedem motivo;
- ações destrutivas usam modal, não `confirm()` nativo;
- estatísticas manuais nunca podem ficar negativas por acidente.

Riscos a continuar a rever:

- painel admin ainda precisa de validação mais forte em deltas;
- kick/renomear/cargo devem ter feedback claro e logs.

### 7. Dados / Auditoria

Estado esperado:

- Chefia → Dados deve ser o raio-X real da produção;
- checks devem ser reparáveis ou claramente acionáveis;
- erros de schema/migration aparecem como críticos;
- dados legacy reparáveis não devem aparecer como corrupção fatal sem explicação.

Riscos a continuar a rever:

- checks SQL podem estar demasiado rígidos para dados legacy;
- falta botão/processo de reparação assistida para alguns casos.

### 8. UI / UX / Copy

Estado esperado:

- o mesmo conceito tem sempre o mesmo nome;
- sem `dinheiro sujo` na interface;
- sem `liquidação` se não for fluxo real;
- sem botões duplicados;
- sem ações que parecem funcionar mas só dão erro;
- estados vazios e erros devem explicar o que fazer.

Riscos a continuar a rever:

- procurar copy antiga em todo o projeto;
- remover rotas legacy da pesquisa/menu;
- confirmar páginas com ações admin ocultas/duplicadas.

## Ordem de hardening

1. Encomendas e gestão de materiais.
2. Entregas e armazém.
3. Saídas e remoção/refator de liquidação legacy.
4. Membros, cargos e estatísticas manuais.
5. Auditoria de dados e reparações assistidas.
6. UI/copy global.
7. Performance, queries, realtime e cache invalidation.

## Critério para considerar produção sólida

- build passa;
- deploy passa;
- criar/editar item funciona;
- criar receita funciona;
- encomenda com materiais calcula certo;
- encomenda sem materiais calcula certo;
- item sem receita não mostra opção de materiais;
- entrega de stock entra a custo 0;
- aprovar entrega antiga normaliza JSON;
- stock/ledger refletem movimentos;
- membros ativos aparecem iguais em todas as páginas;
- botões visíveis executam com sucesso ou não aparecem;
- Chefia → Dados sem críticos não explicados;
- sem vocabulário legacy no UI principal.
