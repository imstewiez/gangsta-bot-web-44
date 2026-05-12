# Plano — Overhaul Premium "Bairro Command Center"

Antes de mexer em código quero alinhar contigo o **âmbito por fases**. O pedido é enorme (8 áreas + design system + hierarquia + ordenação global + nomes). Fazer tudo numa só iteração arrisca partir flows. Proponho 5 fases sequenciais — cada uma entregável, testável, e reversível por commit.

---

## Fase 0 — Fundação (design system + hierarquia)
**Não toca em páginas, só em tokens e helpers. Base para tudo o resto.**

- **Tokens em `src/styles.css`**: refinar paleta dark/red/carvão (oklch), adicionar `--gradient-blood`, `--gradient-noir`, `--shadow-cinematic`, `--glow-red`, superfícies glass/matte (`--surface-1/2/3`), e tons `warning/info/success/destructive` afinados para contraste premium.
- **Hierarquia oficial em `src/lib/domain.ts`**: criar `RANKS` ordenado (Young Blood → Manda-Chuva), com `rank_label`, `rank_tier` (1–8), `rank_tone` e `rank_icon`. Helper `normalizeRank(raw)` que mapeia nomes legados da DB para os oficiais (sem alterar dados).
- **Mappers de labels**: `formatMovementType`, `formatOrderStatus`, `formatSaidaStatus`, `formatItemName` — converter códigos crus em PT-PT bonito numa única fonte de verdade.
- **`RoleBadge` premium**: rebranded com tier visual (gradiente subtil por nível, ícone Lucide consistente, glow no topo da hierarquia).

## Fase 1 — Ordenação global por valor descendente
**Pequena, transversal, alto impacto.**

- Auditar todas as queries/listas que devolvem itens com preço/valor: `pricing.functions`, `inventory.functions`, `orders.functions`, `recipes.functions`, `liquidation.functions`, `leaderboard.functions`.
- Default: `ORDER BY <preço/valor> DESC NULLS LAST`. Manter filtros/search já existentes.
- Dropdowns de carrinho/encomendas: ordenar client-side por valor desc.

## Fase 2 — Shell + Casa/Dashboard + Membros
**As 3 páginas mais visíveis ganham primeiro.**

- **AppShell/TopNav**: header mais cinematográfico, breadcrumb subtil, search global (Cmd+K placeholder), notificações refinadas.
- **Dashboard `/`**: KPIs em cards glass, "Premiado da Semana" destacado, atividade recente com ícones+tons da fase 0, alertas de baixo stock e saídas por fechar.
- **Membros**: lista com filtros por rank (usando hierarquia oficial), ordenação por rank desc default, badges premium. Investigar e corrigir o bug do perfil que não carrega (o user reportou antes — verificar `membros.$id.tsx` e `getMember`).

## Fase 3 — Preçário + Inventário + Encomendas
**Núcleo operacional.**

- **Preçário**: cards de categoria com header glass, item caro primeiro, ícones consistentes (já feito parcialmente).
- **Inventário**: já alinhado com preçário; só polish (skeletons, empty states bonitos, totals por categoria com progress bar de utilização).
- **Encomendas**: carrinho redesenhado, totals sticky, validação inline, estados sucesso/erro/loading, items ordenados por valor.

## Fase 4 — Saídas + Leaderboard + Auditoria + Admin
**Polish final + role-gating.**

- **Saídas**: timeline visual do lifecycle, status pills, timer ao vivo até auto-fecho 12h.
- **Leaderboard**: pódio top-3 cinematográfico, tabs Semana/Mês/Tudo, todos os membros listados.
- **Auditoria**: labels PT-PT via mappers da fase 0, ícones por tipo, filtros (ator/alvo/evento/data).
- **Admin**: separar em sub-secções (Membros · Cargos · Discord · Notificações · Scoring · Itens · Automações), reforçar `has_role('admin')` server-side.

---

## Regras que respeito em todas as fases
- Zero migrations destrutivas. Se precisar de DB, só `ALTER ADD COLUMN` opcional.
- Server functions atuais preservadas — só adições ou refactors internos.
- Auth/RLS intactos.
- Auditoria registada para qualquer nova mutação.
- PT-PT em toda a UI nova.
- Sem mock data.

## Detalhes técnicos
- Stack: TanStack Start + React 19 + Tailwind v4 + shadcn/ui + Lucide. Sem novas dependências pesadas; talvez `framer-motion` (já no projeto) para micro-interações.
- Tokens em `oklch` apenas (regra do template).
- `requireSupabaseAuth` mantido em todas as server fns; `has_role` para admin.
- Discord OAuth/bot intactos.

## O que preciso de ti antes de começar
1. **Confirmas a ordem das fases?** Ou queres começar por outra (ex.: arrancar pela Casa/Dashboard porque é a primeira impressão)?
2. **Vou em rajada (todas as fases seguidas) ou paro no fim de cada fase para tu validares visualmente?** Recomendo parar — é mais seguro e dá-te controlo.
3. Há algum **ecrã específico** que te incomoda mais agora e queres prioritário fora desta ordem?

Assim que confirmares, arranco pela **Fase 0** (invisível mas crítica) e depois Fase 1, e continuo conforme combinares.