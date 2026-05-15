# Upgrade Global da Web App

## Estado Atual (problemas identificados)

1. **Nenhum lazy loading** — todas as 17 páginas são carregadas no bundle inicial
2. **Spinners de texto** — 16 páginas mostram "A carregar…" em vez de skeletons visuais
3. **Sem error boundaries** — um erro numa página quebra a app toda
4. **Sem optimistic updates** — ações (ex: ajustar stock) esperam resposta do servidor antes de mostrar resultado
5. **Sem realtime** — dados não atualizam automaticamente quando outro utilizador muda algo
6. **Sem prefetching** — navegar para uma página = esperar pelo carregamento
7. **Sem keyboard shortcuts** — tudo é à base de rato

---

## Opção 1: Light — Impacto Visual Imediato (~2h)

- **Skeletons em todas as páginas** — substituir "A carregar…" por skeletons tipo shimmer
- **Loading states nos botões** — spinner dentro do botão em vez de apenas disabled
- **Empty states bonitos** — páginas sem dados mostram ilustração + texto útil em vez de "Sem X."
- **Toasts uniformes** — garantir que todas as mutações têm toast de sucesso/erro

## Opção 2: Medium — Performance + UX (~4h) ⭐ Recomendada

Tudo da Opção 1, mais:

- **Lazy loading de rotas** — cada página só carrega quando o utilizador navega para ela
- **Error boundaries por página** — erro numa página mostra fallback bonito, app continua
- **Optimistic updates** — ações comuns (ajustar stock, criar encomenda, editar preço) mostram resultado imediatamente e sincronizam em background
- **Prefetching** — ao passar o rato sobre links de navegação, os dados pré-carregam
- **TanStack Query cache tuning** — staleTime global para reduzir re-fetchs desnecessários

## Opção 3: Full — App Premium (~6h)

Tudo da Opção 2, mais:

- **Supabase Realtime** — notificações em tempo real quando outro utilizador faz algo (ex: nova encomenda, stock alterado)
- **Keyboard shortcuts** — Ctrl+K para procurar, ESC para fechar dialogs, etc.
- **Virtualização de listas grandes** — scroll suave em listas com 100+ items
- **Animações de transição** — entre páginas e ao abrir dialogs

---

## Impacto Esperado

| Aspecto | Antes | Depois (Medium) |
|---------|-------|-----------------|
| Bundle inicial | ~750KB | ~200KB (lazy) |
| Loading visual | Texto "A carregar…" | Skeletons shimmer |
| Feedback de ação | Botão fica cinzento | Spinner + toast |
| Erros | App crasha | Fallback bonito por página |
| Mutations | Espera servidor | Resultado imediato + sync background |
| Navegação | Clique → espera | Hover → prefetch → instantâneo |

---

**Nota:** Tudo é feito sem alterar funcionalidades existentes. São apenas melhorias de UX/performance por cima.
