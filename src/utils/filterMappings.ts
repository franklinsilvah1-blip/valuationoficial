// Mapeamentos centralizados para filtros da plataforma
// Permite compatibilidade retroativa com valores antigos do banco

// PERFIL DO ATIVO - Mapeamento de valores do banco para labels UI (simplificado para 3 opções)
export const PERFIL_INVESTIDOR_OPTIONS = [
  { value: "START", label: "START" },
  { value: "PRO", label: "PRO" },
  { value: "SPECIALIST", label: "SPECIALIST" },
];

// Função para normalizar exibição do perfil do ativo
export const normalizePerfilInvestidor = (value?: string): string => {
  if (!value) return "";
  const upper = value.toUpperCase().trim();
  
  // Normalizar para os 3 valores permitidos
  if (upper === "START") return "START";
  if (upper === "PRO") return "PRO";
  if (upper.includes("SPECIALIST")) return "SPECIALIST";
  
  return value;
};

// RECOMENDAÇÃO - Agrupamento de valores (novos da planilha + antigos para compatibilidade)
export const RECOMENDACAO_GROUPS: Record<string, string[]> = {
  "COMPRA": ["COMPRA", "COMPRA (DY)", "COMPRA (RA)", "COMPRA (RB)", "COMPRA (RM)"],
  "VENDA": ["VENDA", "Ñ COMPRA (ATF)"],
  "NEUTRA": ["NEUTRA", "NEUTRA (AF)", "NEUTRA (TF)"],
  "GANHOS": ["GANHOS"],
  "MANTEM": ["MANTÉM", "MANTEM"],
};

export const RECOMENDACAO_OPTIONS = [
  { value: "COMPRA", label: "COMPRA" },
  { value: "NEUTRA", label: "NEUTRA" },
  { value: "VENDA", label: "VENDA" },
  { value: "GANHOS", label: "GANHOS" },
  { value: "MANTEM", label: "MANTÉM" },
];

// Função para normalizar exibição da recomendação
export const normalizeRecomendacao = (value?: string): string => {
  if (!value) return "";
  const upperValue = value.toUpperCase();
  
  // COMPRA - começa com COMPRA
  if (upperValue.startsWith("COMPRA")) return "COMPRA";
  
  // NEUTRA - começa com NEUTRA  
  if (upperValue.startsWith("NEUTRA")) return "NEUTRA";
  
  // VENDA - contém "COMPRA" mas não começa (ex: "Ñ COMPRA"), ou contém "(ATF)"
  if (upperValue.includes("COMPRA") || upperValue.includes("(ATF)") || upperValue === "VENDA") {
    return "VENDA";
  }
  
  // GANHOS - quando tem ganhos positivos
  if (upperValue === "GANHOS") return "GANHOS";
  
  // MANTÉM
  if (upperValue === "MANTEM" || upperValue === "MANTÉM" || upperValue === "MANTER") {
    return "MANTÉM";
  }
  
  return value;
};

// Função para obter label simplificado da recomendação (para badges)
export const getRecomendacaoDetailLabel = (value?: string): string => {
  if (!value) return "";
  
  const upperValue = value.toUpperCase();
  
  // COMPRA - todas as variantes que COMEÇAM com COMPRA
  if (upperValue.startsWith("COMPRA")) return "COMPRA";
  
  // NEUTRA - todas as variantes
  if (upperValue.startsWith("NEUTRA")) return "NEUTRA";
  
  // VENDA - strings que contêm "COMPRA" mas NÃO começam com "COMPRA" (ex: "Ñ COMPRA (ATF)")
  // Também inclui strings com "(ATF)" ou valor exato "VENDA"
  if (upperValue.includes("COMPRA") || upperValue.includes("(ATF)") || upperValue === "VENDA" || upperValue === "VENDER") {
    return "VENDA";
  }
  
  // GANHOS
  if (upperValue === "GANHOS" || upperValue.includes("GANHOS")) return "GANHOS";
  
  // MANTÉM
  if (upperValue === "MANTEM" || upperValue === "MANTÉM" || upperValue === "MANTER") return "MANTÉM";
  
  return value;
};
// TENDÊNCIA TRIM - Opções simplificadas
export const TENDENCIA_OPTIONS = [
  { value: "ALTA", label: "ALTA" },
  { value: "NEUTRA", label: "NEUTRA" },
  { value: "BAIXA", label: "BAIXA" },
];

// Grupos para compatibilidade com valores antigos do banco
export const TENDENCIA_GROUPS: Record<string, string[]> = {
  "ALTA": ["ALTA", "ALTA (ROI > TR)"],
  "NEUTRA": ["NEUTRA", "NEUTRA (ROI =< RF)"],
  "BAIXA": ["BAIXA", "BAIXA (TAXA < 0)"],
};

// Função para normalizar exibição da tendência
export const normalizeTendencia = (value?: string): string => {
  if (!value) return "";
  const upper = value.toUpperCase().trim();
  
  if (upper.includes("ALTA")) return "ALTA";
  if (upper.includes("NEUTRA")) return "NEUTRA";
  if (upper.includes("BAIXA")) return "BAIXA";
  
  return value;
};

// CARTEIRA - Mapeamento para labels UI
export const CARTEIRA_OPTIONS = [
  { value: "START", label: "START" },
  { value: "PRO", label: "PRO" },
  { value: "SPECIALIST", label: "SPECIALIST" },
  { value: "FALE_C_ESPECIALISTA", label: "Não Recomendado" },
];

export const normalizeCarteira = (value?: string): string => {
  if (!value) return "";
  const mapping: Record<string, string> = {
    "START": "START",
    "PRO": "PRO",
    "SPECIALIST": "SPECIALIST",
    "FALE_C_ESPECIALISTA": "Não Recomendado",
  };
  return mapping[value] || value;
};

// NOTA ESPECIALISTA - Opções individuais na ordem especificada
export const NOTA_ESPECIALISTA_OPTIONS = [
  { value: "Ativo TOP ANO", label: "Ativo TOP ANO" },
  { value: "Ativo TOP TRIM", label: "Ativo TOP TRIM" },
  { value: "Ativo TOP PDY", label: "Ativo TOP PDY" },
  { value: "Recomendado (DY)", label: "Recomendado (DY)" },
  { value: "Recomendado (RB)", label: "Recomendado (RB)" },
  { value: "Recomendado (RM)", label: "Recomendado (RM)" },
  { value: "Recomendado (RA)", label: "Recomendado (RA)" },
  { value: "Não Recomendado (IM)", label: "Não Recomendado (IM)" },
  { value: "Não Recomendado (AF)", label: "Não Recomendado (AF)" },
  { value: "Não Recomendado (TF)", label: "Não Recomendado (TF)" },
];

// Função para normalizar exibição da nota especialista
export const normalizeNotaEspecialista = (value?: string): string => {
  if (!value) return "";
  // Não exibir "Nenhuma nota específica"
  if (value === "Nenhuma nota específica") return "";
  return value;
};

// Labels amigáveis para chips de filtros ativos
export const getFilterLabel = (key: string, value: string): string => {
  if (value === "all" || value === "") return "";
  
  const labels: Record<string, Record<string, string>> = {
    tipo: {
      ACAO: "Ação",
      BDR: "BDR",
      CRIPTO: "Cripto",
      ETF: "ETF",
      FII: "FII",
      INDICE: "Índice",
      RFIXA: "Renda Fixa",
    },
    perfil_investidor: {
      "START": "START",
      "PRO": "PRO",
      "SPECIALIST": "SPECIALIST",
    },
    recomendacao: {
      "COMPRA": "COMPRA",
      "NEUTRA": "NEUTRA",
      "VENDA": "VENDA",
      "GANHOS": "GANHOS",
      "MANTEM": "MANTÉM",
    },
    tendencia: {
      "ALTA": "ALTA",
      "NEUTRA": "NEUTRA",
      "BAIXA": "BAIXA",
    },
    carteira: {
      START: "START",
      PRO: "PRO",
      SPECIALIST: "SPECIALIST",
      FALE_C_ESPECIALISTA: "Não Recomendado",
    },
    nota_especialista: {
      "Ativo TOP ANO": "Ativo TOP ANO",
      "Ativo TOP TRIM": "Ativo TOP TRIM",
      "Ativo TOP PDY": "Ativo TOP PDY",
      "Recomendado (DY)": "Recomendado (DY)",
      "Recomendado (RB)": "Recomendado (RB)",
      "Recomendado (RM)": "Recomendado (RM)",
      "Recomendado (RA)": "Recomendado (RA)",
      "Não Recomendado (IM)": "Não Recomendado (IM)",
      "Não Recomendado (AF)": "Não Recomendado (AF)",
      "Não Recomendado (TF)": "Não Recomendado (TF)",
    },
  };
  
  return labels[key]?.[value] || value;
};
