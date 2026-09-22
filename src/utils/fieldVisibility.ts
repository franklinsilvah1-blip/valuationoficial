import { normalizePlanCode, type AnyPlanCode, type PlanType } from "@/utils/planHelpers";
import {
  canViewAssetPremium,
  getMarketLevel,
  getRequiredPlanForProfile,
  hasFullMarketLevel,
  MATRIX_ASSET_FIELD_KEYS,
  PLAN_ONLY_ASSET_FIELD_KEYS,
} from "@/utils/marketAccess";

export interface FieldVisibilityConfig {
  // Campos sempre visíveis
  codigo_b3: boolean;
  nome: boolean;
  tipo: boolean;
  setor: boolean;

  // Campos com visibilidade controlada
  valor: boolean;
  perfil_investidor: boolean;
  recomendacao: boolean;
  tendencia: boolean;
  taxa_semanal: boolean;
  roitrim: boolean;
  roi2026: boolean;
  roi2025: boolean;
  roi24: boolean;
  dy2025: boolean;
  fator_mc: boolean;
  roi2023a2025: boolean;
  carteira: boolean;
  nota_especialista: boolean;
}

export interface FieldHighlightConfig {
  perfil_investidor: boolean;
  recomendacao: boolean;
  tendencia: boolean;
  taxa_semanal: boolean;
  roi2026: boolean;
  carteira: boolean;
}

/**
 * Configuração básica: os indicadores liberados quando o usuário NÃO tem
 * direito aos campos premium daquele ativo.
 *
 * ROI TRIM (R) (`taxa_semanal`) e ROI TRIM (T) (`roitrim`) passaram para o
 * grupo premium nesta rodada — antes eram visíveis para START.
 */
const BASIC_VISIBILITY: FieldVisibilityConfig = {
  codigo_b3: true,
  nome: true,
  tipo: true,
  setor: true,
  valor: true,
  perfil_investidor: true,
  recomendacao: false,
  tendencia: false,
  taxa_semanal: false,
  roitrim: false,
  roi2026: true,
  roi2025: true,
  roi24: false,
  dy2025: true,
  fator_mc: true,
  roi2023a2025: true,
  carteira: false,
  nota_especialista: false,
};

// Configuração completa: todos os campos daquele ativo liberados.
const FULL_VISIBILITY: FieldVisibilityConfig = {
  codigo_b3: true,
  nome: true,
  tipo: true,
  setor: true,
  valor: true,
  perfil_investidor: true,
  recomendacao: true,
  tendencia: true,
  taxa_semanal: true,
  roitrim: true,
  roi2026: true,
  roi2025: true,
  roi24: true,
  dy2025: true,
  fator_mc: true,
  roi2023a2025: true,
  carteira: true,
  nota_especialista: true,
};

/**
 * Campos protegidos. Reexportados de marketAccess.ts, que é a fonte única —
 * não redefina as listas aqui.
 *
 * MATRIX_* dependem do PERFIL do ativo; PLAN_ONLY_* (TENDÊNCIA TRIM) dependem
 * só do plano, preservando a regra que já existia.
 */
export const PREMIUM_FIELD_KEYS: (keyof FieldVisibilityConfig)[] = [
  ...MATRIX_ASSET_FIELD_KEYS,
  ...PLAN_ONLY_ASSET_FIELD_KEYS,
] as (keyof FieldVisibilityConfig)[];

/**
 * Determina quais campos são visíveis pela matriz PLANO × PERFIL DO ATIVO.
 *
 * IMPORTANTE: esta função só controla o que a UI RENDERIZA. A proteção real
 * dos valores premium acontece no backend (view `asset_analyses_gated` +
 * RPCs públicas — ver supabase/migrations). Um usuário sem direito nunca
 * recebe os valores reais no payload de rede; esta função apenas decide como
 * o componente exibe o que já veio (null) do backend.
 */
export const getFieldVisibility = (
  userPlan: AnyPlanCode | string,
  assetPerfilInvestidor?: string,
  isAuthenticated: boolean = true
): FieldVisibilityConfig => {
  const level = getMarketLevel(userPlan, isAuthenticated);
  const base = canViewAssetPremium(level, assetPerfilInvestidor) ? FULL_VISIBILITY : BASIC_VISIBILITY;

  // TENDÊNCIA TRIM fica FORA da matriz: depende só do plano (PRO ou superior
  // vê em qualquer ativo, inclusive os de perfil SPECIALIST). É a regra que já
  // valia antes desta rodada e que o cliente não pediu para mudar.
  return { ...base, tendencia: hasFullMarketLevel(level) };
};

/**
 * Determina quais campos devem ser destacados (highlight).
 */
export const getFieldHighlights = (
  userPlan: AnyPlanCode | string,
  assetPerfilInvestidor?: string,
  isAuthenticated: boolean = true
): FieldHighlightConfig => {
  const visibility = getFieldVisibility(userPlan, assetPerfilInvestidor, isAuthenticated);

  return {
    perfil_investidor: true,
    recomendacao: visibility.recomendacao,
    tendencia: visibility.tendencia,
    taxa_semanal: true,
    roi2026: visibility.recomendacao,
    carteira: visibility.carteira,
  };
};

/**
 * Verifica se o usuário tem acesso completo a ESTE ativo (todos os campos, não
 * apenas os básicos), considerando plano E perfil do ativo.
 */
export const hasFullAccessToAsset = (
  userPlan: AnyPlanCode | string,
  assetPerfilInvestidor?: string,
  isAuthenticated: boolean = true
): boolean => canViewAssetPremium(getMarketLevel(userPlan, isAuthenticated), assetPerfilInvestidor);

/**
 * Retorna o plano mínimo necessário para acessar os campos completos de um
 * ativo classificado em uma determinada carteira/tier de conteúdo.
 *
 * Nota: `carteira` é um campo de CONTEÚDO do ativo (de onde vem a análise),
 * não o plano do usuário — os dois usam o mesmo enum no banco por herança
 * histórica, mas são conceitos diferentes. "FALE_C_ESPECIALISTA" aqui
 * significa "ativo não recomendado pelo especialista", e exige o mesmo nível
 * mínimo (SPECIALIST) que o tier "SPECIALIST" para ser visto por completo.
 */
export const getRequiredPlanForAsset = (assetCarteira: string | undefined): PlanType => {
  const carteira = assetCarteira?.toUpperCase();

  if (carteira === "FALE_C_ESPECIALISTA" || carteira === "SPECIALIST") {
    return "SPECIALIST";
  }
  if (carteira === "PRO") {
    return "PRO";
  }
  return "START";
};

/** Plano mínimo que libera os campos premium de um ativo com este PERFIL. */
export const getRequiredPlanForAssetProfile = (assetPerfilInvestidor: string | undefined): PlanType =>
  getRequiredPlanForProfile(assetPerfilInvestidor) as PlanType;

/** Mantido para compatibilidade com importadores existentes. */
export { normalizePlanCode };
