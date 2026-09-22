import { getRecomendacaoDetailLabel } from "@/utils/filterMappings";

/**
 * Código de cores dos dados da planilha, na forma em que a plataforma já o
 * aplica hoje.
 *
 * ESTAS REGRAS NÃO SÃO NOVAS: foram extraídas sem nenhuma alteração de valor
 * de src/components/AssetCard.tsx (getPerfilBadgeColor, getRecomendacaoBadgeColor,
 * getTendenciaBadgeColor, getNotaEspecialistaBadgeColor) para poderem ser
 * reutilizadas também nas tabelas de ativos — antes, a mesma informação
 * aparecia colorida no card e sem cor nenhuma na tabela. O AssetCard passou a
 * importar daqui, então card e tabela não têm como divergir.
 *
 * A classificação depende SEMPRE do valor que veio da planilha (via
 * getRecomendacaoDetailLabel para recomendação, que já agrupa as variantes
 * históricas). Nenhuma cor é inventada por faixa de valor.
 */

const NEUTRAL = "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
const GREEN = "bg-green-500 text-white border-green-600";
const AMBER = "bg-amber-500 text-white border-amber-600";
const YELLOW = "bg-yellow-400 text-yellow-900 border-yellow-500";
const DARK = "bg-gray-900 text-white border-gray-800";
const GRAY = "bg-gray-400 text-gray-900 border-gray-500";
const RED = "bg-red-500 text-white border-red-600";

/** PERFIL DO ATIVO */
export const getPerfilBadgeColor = (perfil?: string | null): string => {
  if (!perfil) return NEUTRAL;
  const upper = perfil.toUpperCase();

  if (upper === "START") return GREEN;
  if (upper === "PRO") return AMBER;
  if (upper.includes("SPECIALIST")) return DARK;

  return NEUTRAL;
};

/** RECOMENDAÇÃO TRIM */
export const getRecomendacaoBadgeColor = (rec?: string | null): string => {
  if (!rec) return NEUTRAL;

  switch (getRecomendacaoDetailLabel(rec)) {
    case "COMPRA":
      return GREEN;
    case "GANHOS":
      return YELLOW;
    case "MANTÉM":
      return DARK;
    case "NEUTRA":
      return GRAY;
    case "VENDA":
      return RED;
    default:
      return NEUTRAL;
  }
};

/** TENDÊNCIA TRIM */
export const getTendenciaBadgeColor = (tend?: string | null): string => {
  if (!tend) return NEUTRAL;
  const upper = tend.toUpperCase();

  if (upper.includes("ALTA")) return YELLOW;
  if (upper.includes("BAIXA")) return RED;
  return GRAY; // NEUTRA
};

/** NOTA ESPECIALISTA */
export const getNotaEspecialistaBadgeColor = (nota?: string | null): string => {
  if (!nota) return NEUTRAL;

  if (nota.includes("TOP ANO") || nota.includes("TOP TRIM") || nota.includes("TOP GANHOS") || nota.includes("(RA)")) {
    return DARK;
  }
  if (nota.includes("(DY)") || nota.includes("(RB)") || nota.includes("(RM)")) {
    return YELLOW;
  }
  if (nota.includes("(AF)") || nota.includes("(TF)") || nota.includes("(IM)")) {
    return RED;
  }

  return NEUTRAL;
};

/** CARTEIRA TRIM — mesmo vocabulário de tiers do PERFIL DO ATIVO. */
export const getCarteiraBadgeColor = (carteira?: string | null): string => {
  if (!carteira) return NEUTRAL;
  const upper = carteira.toUpperCase();

  if (upper === "START") return GREEN;
  if (upper === "PRO") return AMBER;
  if (upper.includes("SPECIALIST")) return DARK;
  if (upper.includes("FALE")) return RED; // FALE_C_ESPECIALISTA = "não recomendado"

  return NEUTRAL;
};

/** Classes base da pílula, idênticas às já usadas no AssetCard. */
export const BADGE_BASE_CLASSES = "rounded-full px-3 border";

/**
 * Sinal de ROI, usado só para a cor do texto em colunas numéricas de retorno.
 * Não redefine nenhuma classificação da planilha: apenas reflete o sinal do
 * número que a própria planilha forneceu.
 */
export const getRoiToneClass = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = parseFloat(String(value).replace(/[%\s]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  if (Number.isNaN(parsed)) return "";
  if (parsed > 0) return "text-green-600 dark:text-green-400 font-medium";
  if (parsed < 0) return "text-red-600 dark:text-red-400 font-medium";
  return "";
};

/** Formata um valor de ROI vindo como texto da planilha, preservando o dado. */
export const formatRoiText = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();
  if (raw.endsWith("%")) return raw;
  const parsed = parseFloat(raw.replace(",", "."));
  if (Number.isNaN(parsed)) return raw;
  return `${parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};
