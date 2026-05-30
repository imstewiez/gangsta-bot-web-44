// ============================================================================
// Centralized beautiful messaging system
// All user-facing text must come from here — no raw errors, no technical jargon
// ============================================================================

// ─── ERROR MESSAGES ───
// These replace ugly technical errors with beautiful, on-brand copy.
// Keys are the ugly raw error (or a pattern), values are the beautiful replacement.

export const ERROR_MESSAGES: Record<string, string> = {
  // Generic / catch-all
  "Sem permissão": "Esta área é reservada à direção.",
  "Sem permissão — só o responsável pode tratar este pedido": "Só quem está a gerir isto pode dar o próximo passo.",
  "Acesso restrito à chefia.": "Zona restrita. Só a direção passa daqui.",
  "Acesso restrito: apenas Manda-Chuva.": "Só o topo da pirâmide mexe nestas opções.",
  "Acesso restrito à direção.": "Território da chefia. Sem tag, não entras.",
  "Forbidden: admin only": "Zona restrita. Só a direção passa daqui.",
  "Forbidden: superadmin only": "Só o topo da pirâmide mexe nestas opções.",
  "Unauthorized": "Identidade não confirmada. Volta a entrar e tenta de novo.",
  "Unauthorized: No request headers available": "Ligação instável. Recarrega e tenta outra vez.",
  "Unauthorized: No authorization header provided": "Sessão perdida. Entra de novo.",
  "Unauthorized: Only Bearer tokens are supported": "Sessão inválida. Volta a entrar.",
  "Unauthorized: No token provided": "Token em falta. Entra novamente.",
  "Unauthorized: Invalid token": "Sessão expirada. Entra de novo.",
  "Não tens conta de membro associada.": "Ainda não estás na base de dados da firma. Contacta a direção.",
  "ID de membro inválido": "Algo correu mal com a tua identificação. Tenta recarregar.",
  "Membro sem Discord ID": "A tua conta Discord não está ligada. Contacta a direção.",
  "Membro não encontrado": "Este irmão já não está na firma ou nunca cá esteve.",
  "Membro não encontrado.": "Este irmão já não está na firma ou nunca cá esteve.",
  "Item não encontrado": "Material não encontrado no armazém.",
  "Item inválido": "Material inválido.",
  "Encomenda não encontrada": "Essa encomenda não existe ou já foi removida.",
  "Encomenda(s) não encontrada(s)": "Essa encomenda não existe ou já foi removida.",
  "Pedido não encontrado": "Pedido não encontrado.",
  "Pedido já resolvido": "Já foi tratado. Não podes mexer no passado.",
  "Saída não encontrada": "Essa saída não existe ou foi cancelada.",
  "Saída já está fechada": "Já está fechada. O que está fechado, fica fechado.",
  "Receita não encontrada": "Receita não encontrada.",
  "Item da receita não encontrado": "Material da receita em falta.",
  "Falha na liquidação": "Não conseguimos fechar as contas desta saída. Tenta de novo.",
  "Falha ao criar saída": "Algo falhou ao planear a saída. Tenta outra vez.",
  "Falha ao criar item": "Não conseguimos adicionar o material. Tenta de novo.",
  "Erro ao criar item": "Não conseguimos adicionar o material. Tenta de novo.",
  "Erro ao criar receita": "Não conseguimos guardar a receita. Tenta de novo.",
  "Erro ao calcular materiais": "Cálculo de materiais falhou. Verifica os preços.",
  "Falha ao aprovar tag": "Não conseguimos aprovar o pedido. Tenta novamente.",
  "Sem ranking para a semana actual": "Ainda não há ranking desta semana. Volta mais tarde.",
  "Carrinho vazio": "O carrinho está vazio. Escolhe alguma coisa primeiro.",
  "Máximo 50 materiais por encomenda": "Máximo 50 materiais por encomenda.",
  "Quantidade inválida": "Quantidade inválida.",
  "Tens de escolher um responsável": "Tens de escolher quem gere isto.",
  "Modo de pagamento inválido": "Modo de pagamento inválido.",
  "Responsável inválido": "Responsável inválido.",
  "Nome inválido": "Nome inválido.",
  "ID inválido": "Identificador inválido.",
  "id inválido": "Identificador inválido.",
  "item_id inválido": "Material inválido.",
  "ingredient_item_id inválido": "Material inválido.",
  "ingredients inválido": "Ingredientes inválidos.",
  "quantidade inválida": "Quantidade inválida.",
  "item_ids inválido": "Materiais inválidos.",
  "item_ids contém IDs inválidos": "Materiais inválidos.",
  "Comentário vazio": "Comentário vazio.",
  "Comentário demasiado longo (máx 1000 chars)": "Comentário demasiado longo.",
  "Sem permissão para comentar nesta encomenda.": "Não podes comentar nesta encomenda.",
  "Não podes cancelar encomendas de outrem.": "Só podes cancelar as tuas encomendas.",
  "Apenas o líder ou direção pode cancelar.": "Só o líder ou a direção pode cancelar.",
  "Apenas o líder ou direção pode remover membros.": "Só o líder ou a direção pode remover membros.",
  "Apenas o líder ou direção pode convidar.": "Só o líder ou a direção pode convidar.",
  "Não te podes remover a ti mesmo.": "Não te podes remover a ti mesmo.",
  "Nenhum membro para convidar.": "Ninguém disponível para convidar.",
  "Apenas podes registar kills para ti mesmo.": "Só podes registar kills em teu nome.",
  "Sem acesso ao armazém.": "O armazém é território da chefia.",
  "Sem linhas": "Adiciona pelo menos um material.",
  "Linha inválida": "Material inválido.",
  "Esse item não está disponível para encomenda": "Esse material não está à venda.",
  "Já decidido": "Já foi tratado.",
  "Nome obrigatório": "Dá um nome ao material.",
  "Categoria obrigatória": "Escolhe uma categoria.",
  "Leaderboard query failed": "Não conseguimos carregar o ranking. Tenta de novo.",
  "DB error": "Algo falhou no sistema. Tenta recarregar.",
  "Erro ao carregar perfil do membro": "Não conseguimos carregar o perfil.",
  "Erro a carregar membros.": "Não conseguimos carregar a lista de irmãos.",
  "Erro ao carregar dados": "Não conseguimos carregar os dados. Tenta de novo.",
  // Zod / validation (raw ugly technical)
  "Invalid numeric parameter": "Valor numérico inválido.",
  "Invalid Date parameter": "Data inválida.",
  "Null byte in string parameter": "Caracter inválido detectado.",
  "String parameter exceeds max length": "Texto demasiado longo.",
  "Array parameter exceeds max length": "Lista demasiado grande.",
  "Unsupported SQL parameter type": "Tipo de dados inválido.",
  "Multi-statement queries are not allowed via pgQuery": "Operação não permitida.",
  "Query exceeds maximum length": "Pedido demasiado grande.",
  // Catch patterns
  "Another recalc job is already running": "O sistema está ocupado a calcular rankings. Espera um pouco.",
};

// Pattern-based fallback for errors not in the exact map
const ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /Unauthorized/i, message: "Sessão inválida. Entra de novo." },
  { pattern: /Forbidden/i, message: "Zona restrita." },
  { pattern: /not found/i, message: "Não encontrado." },
  { pattern: /inválido/i, message: "Algo não está certo. Verifica os dados." },
  { pattern: /falha|failed|error/i, message: "Algo correu mal. Tenta de novo." },
  { pattern: /permissão|permission/i, message: "Não tens autorização para isso." },
];

export function beautifyError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? "");
  // Exact match
  if (ERROR_MESSAGES[text]) return ERROR_MESSAGES[text];
  // Partial match
  for (const key of Object.keys(ERROR_MESSAGES)) {
    if (text.includes(key)) return ERROR_MESSAGES[key];
  }
  // Pattern fallback
  for (const { pattern, message } of ERROR_PATTERNS) {
    if (pattern.test(text)) return message;
  }
  // Ultimate fallback — never expose raw technical text
  return "Algo não correu como esperado. Tenta de novo ou contacta a direção.";
}

// ─── SUCCESS MESSAGES ───
export const SUCCESS_MESSAGES: Record<string, string> = {
  "Atualizado": "Dados atualizados com sucesso.",
  "Guardado": "Guardado com sucesso.",
  "Aprovado": "Aprovado. Segue o jogo.",
  "Recusado": "Recusado. Fica para a próxima.",
  "Criar": "Criado com sucesso.",
  "Material criado": "Novo material adicionado ao armazém.",
  "Material atualizado": "Material atualizado.",
  "Material eliminado": "Material removido.",
  "items removidos": "Materiais removidos.",
  "Receita atualizada": "Receita atualizada.",
  "Preço atualizado": "Preços atualizados.",
  "Tag request approved": "Tag aprovada. Bem-vindo à firma.",
  "Tag request denied": "Tag recusada.",
  "Prémio definido": "Prémio definido com sucesso.",
  "Encomenda submetida": "Encomenda enviada. Aguarda confirmação.",
  "Entrega submetida": "Entrega registada. Aguarda confirmação.",
  "Aquisição registada": "Registado com sucesso.",
  "Comentário adicionado": "Comentário enviado.",
  "Saída criada": "Saída planeado. Boa sorte.",
  "Abate registado": "Abate registado.",
  "Membro promovido": "Promoção efetuada.",
  "Membro kickado": "Membro removido da firma.",
  "Renomeado": "Nome atualizado.",
};

export function beautifySuccess(raw: string): string {
  return SUCCESS_MESSAGES[raw] ?? raw;
}

// ─── EMPTY STATES ───
export const EMPTY_STATE = {
  generic: { title: "Nada por aqui", description: "Ainda não há nada para mostrar.", icon: "empty" as const },
  members: { title: "Nenhum irmão por aqui", description: "A firma está quieta. Ninguém na lista.", icon: "users" as const },
  orders: { title: "Encomendas em branco", description: "Ninguém pediu nada. O armazém descansa.", icon: "shopping" as const },
  ordersHistory: { title: "Histórico vazio", description: "Nenhuma encomenda arquivada.", icon: "archive" as const },
  deliveries: { title: "Entregas em branco", description: "Nada entrou nem saiu. Tudo parado.", icon: "truck" as const },
  deliveriesPending: { title: "Nada pendente", description: "Tudo tratado. Podes descansar.", icon: "check" as const },
  inventory: { title: "Armazém vazio", description: "Nada em stock. Mete-te a trabalhar, irmão.", icon: "package" as const },
  inventoryLedger: { title: "Sem movimentos", description: "O armazém não mexeu. Zero atividade.", icon: "history" as const },
  recipes: { title: "Sem receitas", description: "Nenhuma fórmula registada.", icon: "flask" as const },
  operations: { title: "Sem saídas", description: "Nada planeado. A rua está quieta.", icon: "crosshair" as const },
  prizes: { title: "Sem prémios", description: "Ninguém foi premiado ainda.", icon: "trophy" as const },
  leaderboard: { title: "Sem ranking", description: "Ainda não há classificações.", icon: "chart" as const },
  audit: { title: "Sem registos", description: "Nenhuma ação registada.", icon: "scroll" as const },
  appLogs: { title: "Sem logs técnicos", description: "O sistema está limpo.", icon: "bug" as const },
  comments: { title: "Silêncio total", description: "Ninguém comentou ainda. Sê o primeiro.", icon: "message" as const },
  dashboard: { title: "Sem dados", description: "Ainda não há números para mostrar.", icon: "chart" as const },
  search: { title: "Nenhum resultado", description: "Nada encontrado com esse termo.", icon: "search" as const },
  onboarding: { title: "Sem pedidos", description: "Ninguém pediu tag.", icon: "tag" as const },
  items: { title: "Armazém vazio", description: "Nenhum material registado.", icon: "package" as const },
  memberProfileOrders: { title: "Sem encomendas", description: "Este irmão ainda não pediu nada.", icon: "shopping" as const },
  memberProfileDeliveries: { title: "Sem entregas", description: "Nada entregue por este irmão.", icon: "truck" as const },
  memberProfileRecords: { title: "Sem registos", description: "Este irmão ainda não tem histórico.", icon: "file" as const },
  memberProfileMovements: { title: "Sem movimentos", description: "Nada registado.", icon: "history" as const },
  users: { title: "Nenhum utilizador", description: "Ainda ninguém entrou no site.", icon: "users" as const },
};

// ─── LOADING MESSAGES ───
export const LOADING = {
  generic: "A carregar...",
  members: "A reunir a tropa...",
  orders: "A organizar encomendas...",
  deliveries: "A verificar entregas...",
  inventory: "A contar o stock...",
  recipes: "A preparar as receitas...",
  operations: "A planear saídas...",
  dashboard: "A calcular os números...",
  leaderboard: "A classificar a tropa...",
  audit: "A consultar o histórico...",
  prices: "A verificar preços...",
  profile: "A carregar o perfil...",
  comments: "A carregar comentários...",
  stats: "A atualizar estatísticas...",
};

// ─── ACCESS DENIED ───
export const ACCESS_DENIED = {
  title: "Zona restrita",
  description: "Só quem tem tag passa daqui. Se achas que isto é erro, fala com a direção.",
  button: "Voltar ao início",
  inventoryTitle: "Armazém fechado",
  inventoryDescription: "O armazém é território da chefia e dos oficiais. Sem autorização, não entras.",
};

// ─── ERROR PAGES ───
export const ERROR_PAGE = {
  notFoundTitle: "404 — Território desconhecido",
  notFoundDescription: "Esta página não existe. Ou foi movida, ou nunca cá esteve.",
  notFoundButton: "Voltar à base",
  genericTitle: "Algo falhou",
  genericDescription: "O sistema não conseguiu processar o pedido. Tenta recarregar a página.",
  genericButton: "Tentar de novo",
  serverTitle: "Erro no servidor",
  serverDescription: "Algo correu mal do nosso lado. Tenta recarregar ou volta mais tarde.",
  serverButton: "Recarregar",
  serverHome: "Voltar à base",
};

// ─── PLACEHOLDERS ───
export const PLACEHOLDER = {
  search: "Procurar...",
  searchMembers: "Procurar irmão...",
  searchItems: "Procurar material...",
  searchOrders: "Procurar encomenda...",
  searchRecipes: "Procurar receita...",
  searchOperations: "Procurar saída...",
  searchAudit: "Procurar no histórico...",
  searchLogs: "Procurar nos logs...",
  notes: "Notas...",
  quantity: "Qtd.",
  reason: "Motivo...",
  prizeDescription: "O que o vencedor vai receber...",
  selectManager: "Quem gere isto?",
  selectMaterial: "Escolher material...",
  selectItem: "Escolher material...",
};

// ─── LABEL MAPPINGS (raw → beautiful) ───
export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Manda-Chuva",
  admin: "Direção",
  member: "Irmão",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  denied: "Recusado",
  fulfilled: "Entregue",
  cancelled: "Cancelado",
  in_progress: "Em curso",
  ready: "Pronto",
  active: "Ativo",
  inactive: "Inativo",
  por_definir: "Por definir",
  entregue: "Entregue",
  criada: "Criada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const TIER_LABELS: Record<string, string> = {
  young_blood: "Bairrista-1",
  o_gunao: "Bairrista-2",
  gangster_fodido: "Bairrista-3",
  patrao_di_zona: "Chefe de Moradores",
  real_gangster: "Oficiais-1",
  og: "Oficiais-2",
  kingpin: "Sub-Chefe",
  manda_chuva: "Chefe",
};

export const TIER_SHORT: Record<string, string> = {
  young_blood: "B1",
  o_gunao: "B2",
  gangster_fodido: "B3",
  patrao_di_zona: "CM",
  real_gangster: "O1",
  og: "O2",
  kingpin: "SC",
  manda_chuva: "CH",
};

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  rota: "Rota",
  assalto: "Assalto",
  guerra: "Guerra",
  treino: "Treino",
  outro: "Outro",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  saldo_inicial: "Saldo inicial",
  entrega_bairrista: "Entrega",
  venda_bairrista: "Venda",
  entrega_oficial: "Entrega oficial",
  fornecimento_org: "Fornecimento",
  consumo_saida: "Saída",
  devolucao_saida: "Devolução",
  ajuste_manual: "Ajuste",
  perda_saida: "Perdido",
  apreendido: "Apreendido",
  fabricado: "Fabricado",
};
