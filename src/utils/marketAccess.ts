import { normalizePlanCode, type AnyPlanCode } from "@/utils/planHelpers";

/**
 * Espelho no frontend da matriz de acesso ao mercado implementada no banco
 * (supabase/migrations/20260922120000_market_access_matrix.sql).
 *
 * IMPORTANTE — este arquivo NÃO é a proteção. Ele só decide COMO a interface
 * apresenta o que o backend já entregou. Os valores a que o usuário não tem
 * direito chegam aqui como `null` porque o Postgres os mascarou na view
 * `asset_analyses_gated` / nas RPCs públicas — nunca porque o React os
 * escondeu. Se este arquivo fosse apagado, nenhum dado protegido vazaria;
 * só a apresentação ficaria pior.
 *
 * Mantenha as duas implementações em sincronia: mudança de regra aqui exige a
 * mudança equivalente em `can_view_asset_premium()` no banco.
 */

/** Nível de acesso do usuário — espelha `current_user_market_level()`. */
export type MarketLevel = "ANON" | "START" | "PRO" | "FULL";

/** Perfil do ativo — espelha `normalize_asset_profile()`. */
export type AssetProfile = "START" | "PRO" | "SPECIALIST";

/**
 * Os 5 campos sujeitos à MATRIZ plano × PERFIL DO ATIVO — exatamente a lista
 * que o cliente pediu para bloquear ao PRO em ativos de perfil SPECIALIST.
 * O rótulo é o nome da coluna na planilha; a chave é a coluna real no banco
 * (mapeamento confirmado em supabase/functions/sync-google-sheets/index.ts).
 */
export const MATRIX_ASSET_FIELDS = {
  taxa_semanal: "ROI TRIM (R)",
  roitrim: "ROI TRIM (T)",
  carteira: "Carteira TRIM",
  recomendacao: "Recomendação TRIM",
  nota_especialista: "Nota Especialista",
} as const;

/**
 * Campos protegidos apenas pelo PLANO, sem olhar o perfil do ativo.
 *
 * TENDÊNCIA TRIM está aqui, e NÃO na matriz, de propósito: essa é a regra que
 * já valia antes (bloqueada para anônimo/START, liberada para PRO em diante,
 * em qualquer ativo). Ela não está na lista de 5 campos que o cliente pediu
 * para bloquear ao PRO, e movê-la para a matriz tiraria do assinante PRO a
 * tendência de 588 dos 607 ativos ativos — benefício que a própria página de
 * planos anuncia como incluso no PRO. Regra não solicitada não muda.
 */
export const PLAN_ONLY_ASSET_FIELDS = {
  tendencia: "Tendência TRIM",
} as const;

export type MatrixAssetField = keyof typeof MATRIX_ASSET_FIELDS;
export type PlanOnlyAssetField = keyof typeof PLAN_ONLY_ASSET_FIELDS;
export type ProtectedAssetField = MatrixAssetField | PlanOnlyAssetField;

export const MATRIX_ASSET_FIELD_KEYS = Object.keys(MATRIX_ASSET_FIELDS) as MatrixAssetField[];
export const PLAN_ONLY_ASSET_FIELD_KEYS = Object.keys(PLAN_ONLY_ASSET_FIELDS) as PlanOnlyAssetField[];

/**
 * Em `assets_market_view` a coluna `taxa_semanal` da análise é exposta com o
 * alias `analysis_taxa_semanal` (a tabela `assets` tem colunas próprias e o
 * alias evita a colisão). Ambas as chaves representam ROI TRIM (R).
 */
const MATRIX_ROW_KEYS: string[] = [...MATRIX_ASSET_FIELD_KEYS, "analysis_taxa_semanal"];
const PLAN_ONLY_ROW_KEYS: string[] = [...PLAN_ONLY_ASSET_FIELD_KEYS];

/** Todas as chaves de linha que podem vir mascaradas do servidor. */
export const PROTECTED_ROW_KEYS: string[] = [...MATRIX_ROW_KEYS, ...PLAN_ONLY_ROW_KEYS];

export const isProtectedAssetField = (key: string): boolean => PROTECTED_ROW_KEYS.includes(key);

/** Espelha `normalize_asset_profile()`: fail-safe para o perfil MAIS restritivo. */
export const normalizeAssetProfile = (raw: string | null | undefined): AssetProfile => {
  if (!raw) return "SPECIALIST";
  const value = raw.trim().toUpperCase();
  if (!value) return "SPECIALIST";
  if (value.includes("SPECIALIST") || value.includes("ESPECIALISTA")) return "SPECIALIST";
  if (value === "PRO" || value.startsWith("PRO ")) return "PRO";
  if (value === "START" || value.startsWith("START ") || value === "FREE") return "START";
  return "SPECIALIST";
};

/**
 * Espelha `current_user_market_level()`.
 *
 * FAIL-CLOSED: cada nível elevado tem um ramo explícito; não existe catch-all
 * que devolva "FULL". Plano desconhecido, nulo ou inesperado cai em "START".
 */
export const getMarketLevel = (
  plan: AnyPlanCode | string | null | undefined,
  isAuthenticated: boolean
): MarketLevel => {
  if (!isAuthenticated) return "ANON";

  switch (normalizePlanCode(plan)) {
    case "START":
      return "START";
    case "PRO":
      return "PRO";
    case "SPECIALIST":
      return "FULL";
    case "WEALTH":
      return "FULL";
    default:
      return "START";
  }
};

/** "PRO ou superior" — espelha `current_user_has_full_market_access()`. */
export const hasFullMarketLevel = (level: MarketLevel): boolean =>
  level === "PRO" || level === "FULL";

/**
 * A matriz: este nível vê os 5 campos sujeitos ao PERFIL DO ATIVO?
 * Espelha `can_view_asset_premium(level, perfil)`.
 */
export const canViewAssetPremium = (
  level: MarketLevel,
  assetProfile: string | null | undefined
): boolean => {
  if (level === "FULL") return true;
  if (level === "PRO") {
    const profile = normalizeAssetProfile(assetProfile);
    return profile === "START" || profile === "PRO";
  }
  return false;
};

/**
 * Entrada única para a UI: este campo, neste ativo, é visível para este nível?
 * Aplica a matriz aos 5 campos e a regra por plano ao TENDÊNCIA TRIM.
 */
export const canViewAssetField = (
  level: MarketLevel,
  fieldKey: string,
  assetProfile: string | null | undefined
): boolean => {
  if (PLAN_ONLY_ROW_KEYS.includes(fieldKey)) return hasFullMarketLevel(level);
  if (MATRIX_ROW_KEYS.includes(fieldKey)) return canViewAssetPremium(level, assetProfile);
  return true;
};

/** Plano mínimo que libera os campos da matriz de um ativo com este PERFIL. */
export const getRequiredPlanForProfile = (assetProfile: string | null | undefined) =>
  normalizeAssetProfile(assetProfile) === "SPECIALIST" ? "SPECIALIST" : "PRO";

export interface UnlockCta {
  /** Texto curto exibido no tooltip da célula bloqueada. */
  label: string;
  /** Rota do fluxo já existente de login/cadastro/upgrade. */
  href: string;
}

/**
 * CTA da célula bloqueada. Reutiliza os fluxos que já existem — /auth para
 * visitante e /assinatura para upgrade. Nunca cria checkout paralelo.
 */
export const getUnlockCta = (
  level: MarketLevel,
  assetProfile?: string | null,
  fieldKey?: string
): UnlockCta => {
  if (level === "ANON") {
    return { label: "Crie sua conta grátis para desbloquear", href: "/auth?mode=signup" };
  }

  // TENDÊNCIA TRIM não depende do perfil do ativo: para quem está em START,
  // o plano mínimo é sempre PRO.
  const requiredPlan =
    fieldKey && PLAN_ONLY_ROW_KEYS.includes(fieldKey)
      ? "PRO"
      : getRequiredPlanForProfile(assetProfile);

  return {
    label: `Disponível no plano ${requiredPlan}`,
    href: "/assinatura",
  };
};
