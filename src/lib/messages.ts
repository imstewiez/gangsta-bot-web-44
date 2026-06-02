// ============================================================================
// Centralized user-facing messaging
// Keep copy clear, consistent and product-focused. Avoid exposing raw errors or
// internal jargon to users.
// ============================================================================

export const ERROR_MESSAGES: Record<string, string> = {
  "Sem permissão": "Não tens autorização para aceder a esta área.",
  "Sem permissão — só o responsável pode tratar este pedido": "Só o responsável por este pedido pode avançar.",
  "Acesso restrito à chefia.": "Acesso restrito à gestão.",
  "Acesso restrito: apenas Manda-Chuva.": "Acesso restrito à administração.",
  "Acesso restrito à direção.": "Acesso restrito à direção.",
  "Forbidden: admin only": "Acesso restrito à gestão.",
  "Forbidden: superadmin only": "Acesso restrito à administração.",
  Unauthorized: "Sessão não confirmada. Inicia sessão novamente.",
  "Unauthorized: No request headers available": "Não foi possível validar a sessão. Recarrega a página e tenta novamente.",
  "Unauthorized: No authorization header provided": "Sessão expirada. Inicia sessão novamente.",
  "Unauthorized: Only Bearer tokens are supported": "Sessão inválida. Inicia sessão novamente.",
  "Unauthorized: No token provided": "Sessão em falta. Inicia sessão novamente.",
  "Unauthorized: Invalid token": "Sessão expirada. Inicia sessão novamente.",
  "Não tens conta de membro associada.": "A tua conta ainda não está associada a um membro. Contacta a direção.",
  "ID de membro inválido": "Identificação de membro inválida.",
  "Membro sem Discord ID": "Este membro não tem Discord associado.",
  "Membro não encontrado": "Membro não encontrado.",
  "Membro não encontrado.": "Membro não encontrado.",
  "Item não encontrado": "Item não encontrado.",
  "Item inválido": "Item inválido.",
  "Encomenda não encontrada": "Encomenda não encontrada.",
  "Encomenda(s) não encontrada(s)": "Encomenda não encontrada.",
  "Pedido não encontrado": "Pedido não encontrado.",
  "Pedido já resolvido": "Este pedido já foi resolvido.",
  "Saída não encontrada": "Saída não encontrada.",
  "Saída já está fechada": "Esta saída já está fechada.",
  "Receita não encontrada": "Receita não encontrada.",
  "Item da receita não encontrado": "Item da receita não encontrado.",
  "Falha na liquidação": "Não foi possível fechar esta saída. Tenta novamente.",
  "Falha ao criar saída": "Não foi possível criar a saída. Tenta novamente.",
  "Falha ao criar item": "Não foi possível criar o item. Tenta novamente.",
  "Erro ao criar item": "Não foi possível criar o item. Tenta novamente.",
  "Erro ao criar receita": "Não foi possível guardar a receita. Tenta novamente.",
  "Erro ao calcular materiais": "Não foi possível calcular os materiais. Verifica os dados.",
  "Falha ao aprovar tag": "Não foi possível aprovar o pedido. Tenta novamente.",
  "Sem ranking para a semana actual": "Ainda não há ranking para esta semana.",
  "Carrinho vazio": "O carrinho está vazio.",
  "Máximo 50 materiais por encomenda": "Máximo de 50 materiais por encomenda.",
  "Quantidade inválida": "Quantidade inválida.",
  "Tens de escolher um responsável": "Escolhe um responsável.",
  "Modo de pagamento inválido": "Modo de pagamento inválido.",
  "Responsável inválido": "Responsável inválido.",
  "Nome inválido": "Nome inválido.",
  "ID inválido": "Identificador inválido.",
  "id inválido": "Identificador inválido.",
  "item_id inválido": "Item inválido.",
  "ingredient_item_id inválido": "Material inválido.",
  "ingredients inválido": "Ingredientes inválidos.",
  "quantidade inválida": "Quantidade inválida.",
  "item_ids inválido": "Itens inválidos.",
  "item_ids contém IDs inválidos": "Itens inválidos.",
  "Comentário vazio": "Comentário vazio.",
  "Comentário demasiado longo (máx 1000 chars)": "Comentário demasiado longo.",
  "Sem permissão para comentar nesta encomenda.": "Não tens autorização para comentar nesta encomenda.",
  "Não podes cancelar encomendas de outrem.": "Só podes cancelar as tuas encomendas.",
  "Apenas o líder ou direção pode cancelar.": "Só o líder ou a direção pode cancelar.",
  "Apenas o líder ou direção pode remover membros.": "Só o líder ou a direção pode remover membros.",
  "Apenas o líder ou direção pode convidar.": "Só o líder ou a direção pode convidar.",
  "Não te podes remover a ti mesmo.": "Não te podes remover a ti mesmo.",
  "Nenhum membro para convidar.": "Não há membros disponíveis para convidar.",
  "Apenas podes registar kills para ti mesmo.": "Só podes registar abates em teu nome.",
  "Sem acesso ao armazém.": "Não tens acesso ao inventário.",
  "Sem linhas": "Adiciona pelo menos um material.",
  "Linha inválida": "Linha inválida.",
  "Esse item não está disponível para encomenda": "Esse item não está disponível para encomenda.",
  "Já decidido": "Este pedido já foi decidido.",
  "Nome obrigatório": "Nome obrigatório.",
  "Categoria obrigatória": "Categoria obrigatória.",
  "Leaderboard query failed": "Não foi possível carregar a classificação. Tenta novamente.",
  "DB error": "Ocorreu um erro no sistema. Tenta novamente.",
  "Erro ao carregar perfil do membro": "Não foi possível carregar o perfil do membro.",
  "Erro a carregar membros.": "Não foi possível carregar os membros.",
  "Erro ao carregar dados": "Não foi possível carregar os dados. Tenta novamente.",
  "Invalid numeric parameter": "Valor numérico inválido.",
  "Invalid Date parameter": "Data inválida.",
  "Null byte in string parameter": "Texto contém um carácter inválido.",
  "String parameter exceeds max length": "Texto demasiado longo.",
  "Array parameter exceeds max length": "Lista demasiado grande.",
  "Unsupported SQL parameter type": "Tipo de dados inválido.",
  "Multi-statement queries are not allowed via pgQuery": "Operação não permitida.",
  "Query exceeds maximum length": "Pedido demasiado grande.",
  "Another recalc job is already running": "Já existe um cálculo em curso. Tenta novamente dentro de instantes.",
};

const ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /Unauthorized/i, message: "Sessão inválida. Inicia sessão novamente." },
  { pattern: /Forbidden/i, message: "Não tens autorização para aceder a esta área." },
  { pattern: /not found/i, message: "Não encontrado." },
  { pattern: /inválido/i, message: "Verifica os dados e tenta novamente." },
  { pattern: /falha|failed|error/i, message: "Ocorreu um erro. Tenta novamente." },
  { pattern: /permissão|permission/i, message: "Não tens autorização para realizar esta ação." },
];

export function beautifyError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? "");
  if (ERROR_MESSAGES[text]) return ERROR_MESSAGES[text];
  for (const key of Object.keys(ERROR_MESSAGES)) {
    if (text.includes(key)) return ERROR_MESSAGES[key];
  }
  for (const { pattern, message } of ERROR_PATTERNS) {
    if (pattern.test(text)) return message;
  }
  return "Algo não correu como esperado. Tenta novamente ou contacta a direção.";
}

export const SUCCESS_MESSAGES: Record<string, string> = {
  Atualizado: "Atualizado com sucesso.",
  Guardado: "Guardado com sucesso.",
  Aprovado: "Aprovado com sucesso.",
  Recusado: "Recusado com sucesso.",
  Criar: "Criado com sucesso.",
  "Material criado": "Material criado com sucesso.",
  "Material atualizado": "Material atualizado com sucesso.",
  "Material eliminado": "Material removido com sucesso.",
  "items removidos": "Itens removidos com sucesso.",
  "Receita atualizada": "Receita atualizada com sucesso.",
  "Preço atualizado": "Preços atualizados com sucesso.",
  "Tag request approved": "Pedido de tag aprovado.",
  "Tag request denied": "Pedido de tag recusado.",
  "Prémio definido": "Prémio definido com sucesso.",
  "Encomenda submetida": "Encomenda enviada com sucesso.",
  "Entrega submetida": "Entrega registada com sucesso.",
  "Aquisição registada": "Registo criado com sucesso.",
  "Comentário adicionado": "Comentário adicionado.",
  "Saída criada": "Saída criada com sucesso.",
  "Abate registado": "Abate registado com sucesso.",
  "Membro promovido": "Membro promovido com sucesso.",
  "Membro kickado": "Membro removido com sucesso.",
  Renomeado: "Nome atualizado com sucesso.",
};

export function beautifySuccess(raw: string): string {
  return SUCCESS_MESSAGES[raw] ?? raw;
}

export const EMPTY_STATE = {
  generic: { title: "Sem dados", description: "Ainda não há informação para mostrar.", icon: "empty" as const },
  members: { title: "Sem membros", description: "Ainda não há membros nesta lista.", icon: "users" as const },
  orders: { title: "Sem encomendas", description: "Ainda não existem encomendas registadas.", icon: "shopping" as const },
  ordersHistory: { title: "Histórico vazio", description: "Ainda não existem encomendas arquivadas.", icon: "archive" as const },
  deliveries: { title: "Sem entregas", description: "Ainda não existem entregas registadas.", icon: "truck" as const },
  deliveriesPending: { title: "Sem pendentes", description: "Não há entregas pendentes neste momento.", icon: "check" as const },
  inventory: { title: "Inventário vazio", description: "Ainda não existem itens em stock.", icon: "package" as const },
  inventoryLedger: { title: "Sem movimentos", description: "Ainda não existem movimentos de inventário.", icon: "history" as const },
  recipes: { title: "Sem receitas", description: "Ainda não existem receitas registadas.", icon: "flask" as const },
  operations: { title: "Sem saídas", description: "Ainda não existem saídas registadas.", icon: "crosshair" as const },
  prizes: { title: "Sem prémios", description: "Ainda não existem prémios registados.", icon: "trophy" as const },
  leaderboard: { title: "Sem classificação", description: "Ainda não há dados suficientes para criar uma classificação.", icon: "chart" as const },
  audit: { title: "Sem registos", description: "Ainda não existem ações registadas.", icon: "scroll" as const },
  appLogs: { title: "Sem logs técnicos", description: "Ainda não existem logs técnicos.", icon: "bug" as const },
  comments: { title: "Sem comentários", description: "Ainda não existem comentários.", icon: "message" as const },
  dashboard: { title: "Sem dados", description: "Ainda não há dados suficientes para mostrar este painel.", icon: "chart" as const },
  search: { title: "Sem resultados", description: "Não encontrámos resultados para esta pesquisa.", icon: "search" as const },
  onboarding: { title: "Sem pedidos", description: "Ainda não existem pedidos de tag.", icon: "tag" as const },
  items: { title: "Sem itens", description: "Ainda não existem itens registados.", icon: "package" as const },
  memberProfileOrders: { title: "Sem encomendas", description: "Este membro ainda não tem encomendas registadas.", icon: "shopping" as const },
  memberProfileDeliveries: { title: "Sem entregas", description: "Este membro ainda não tem entregas registadas.", icon: "truck" as const },
  memberProfileRecords: { title: "Sem registos", description: "Este membro ainda não tem histórico.", icon: "file" as const },
  memberProfileMovements: { title: "Sem movimentos", description: "Ainda não existem movimentos registados.", icon: "history" as const },
  users: { title: "Sem utilizadores", description: "Ainda não existem utilizadores registados.", icon: "users" as const },
};

export const LOADING = {
  generic: "A carregar...",
  members: "A carregar membros...",
  orders: "A carregar encomendas...",
  deliveries: "A carregar entregas...",
  inventory: "A carregar inventário...",
  recipes: "A carregar receitas...",
  operations: "A carregar saídas...",
  dashboard: "A carregar dados...",
  leaderboard: "A carregar classificação...",
  audit: "A carregar histórico...",
  prices: "A carregar preços...",
  profile: "A carregar perfil...",
  comments: "A carregar comentários...",
  stats: "A atualizar estatísticas...",
};

export const ACCESS_DENIED = {
  title: "Acesso restrito",
  description: "Não tens autorização para aceder a esta área. Se achas que isto é um erro, contacta a direção.",
  button: "Voltar ao início",
  inventoryTitle: "Acesso ao inventário restrito",
  inventoryDescription: "Só membros autorizados podem consultar o inventário.",
};

export const ERROR_PAGE = {
  notFoundTitle: "Página não encontrada",
  notFoundDescription: "Esta página não existe ou foi movida.",
  notFoundButton: "Voltar ao início",
  genericTitle: "Algo falhou",
  genericDescription: "O sistema não conseguiu processar o pedido. Tenta recarregar a página.",
  genericButton: "Tentar novamente",
  serverTitle: "Erro no servidor",
  serverDescription: "Ocorreu um erro do nosso lado. Tenta recarregar ou volta mais tarde.",
  serverButton: "Recarregar",
  serverHome: "Voltar ao início",
};

export const PLACEHOLDER = {
  search: "Procurar...",
  searchMembers: "Procurar membro...",
  searchItems: "Procurar item...",
  searchOrders: "Procurar encomenda...",
  searchRecipes: "Procurar receita...",
  searchOperations: "Procurar saída...",
  searchAudit: "Procurar no histórico...",
  searchLogs: "Procurar nos logs...",
  notes: "Notas...",
  quantity: "Qtd.",
  reason: "Motivo...",
  prizeDescription: "Descreve o prémio...",
  selectManager: "Selecionar responsável...",
  selectMaterial: "Selecionar material...",
  selectItem: "Selecionar item...",
};

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Administração",
  admin: "Direção",
  member: "Membro",
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
  young_blood: "Young Blood",
  o_gunao: "O Gunão",
  gangster_fodido: "Gangster Fodido",
  patrao_di_zona: "Patrão di Zona",
  real_gangster: "Real Gangster",
  og: "OG",
  kingpin: "Kingpin",
  manda_chuva: "Manda-Chuva",
};

export const TIER_SHORT: Record<string, string> = {
  young_blood: "YB",
  o_gunao: "OGN",
  gangster_fodido: "GF",
  patrao_di_zona: "PDZ",
  real_gangster: "RG",
  og: "OG",
  kingpin: "KP",
  manda_chuva: "MC",
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
  perda_saida: "Perda",
  apreendido: "Apreendido",
  fabricado: "Fabricado",
};
