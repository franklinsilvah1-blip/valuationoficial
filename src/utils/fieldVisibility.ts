import { normalizePlanCode, hasFullMarketAccess, type AnyPlanCode, type PlanType } from "@/utils/planHelpers";

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

// Configuração básica: apenas os indicadores básicos definidos para o plano START.
const BASIC_VISIBILITY: FieldVisibilityConfig = {
  codigo_b3: true,
  nome: true,
  tipo: true,
  setor: true,
  valor: true,
  perfil_investidor: true,
  recomendacao: false,
  tendencia: false,
  taxa_semanal: true,
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

// Configuração completa: PRO, SPECIALIST e WEALTH veem todos os campos.
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

/** Os 4 campos considerados premium/bloqueados para o plano START. */
export const PREMIUM_FIELD_KEYS: (keyof FieldVisibilityConfig)[] = [
  "tendencia",
  "carteira",
  "recomendacao",
  "nota_especialista",
];

/**
 * Determina quais campos são visíveis baseado no plano do usuário.
 *
 * IMPORTANTE: esta função só controla o que a UI RENDERIZA. A proteção real dos
 * valores premium acontece no backend (view `asset_analyses_gated` — ver
 * supabase/migrations). Usuários START nunca devem receber os valores reais de
 * PREMIUM_FIELD_KEYS no payload de rede; esta função apenas decide como o
 * componente exibe o que já veio (null) do backend para esse plano.
 */
export const getFieldVisibility = (
  userPlan: AnyPlanCode | string,
  _assetPerfilInvestidor?: string
): FieldVisibilityConfig => {
  return hasFullMarketAccess(userPlan) ? FULL_VISIBILITY : BASIC_VISIBILITY;
};

/**
 * Determina quais campos devem ser destacados (highlight) baseado no plano
 */
export const getFieldHighlights = (userPlan: AnyPlanCode | string): FieldHighlightConfig => {
  if (!hasFullMarketAccess(userPlan)) {
    return {
      perfil_investidor: true,
      recomendacao: false,
      tendencia: false,
      taxa_semanal: true,
      roi2026: false,
      carteira: false,
    };
  }

  return {
    perfil_investidor: true,
    recomendacao: true,
    tendencia: true,
    taxa_semanal: true,
    roi2026: true,
    carteira: true,
  };
};

/**
 * Verifica se o usuário tem acesso completo ao ativo (todos os campos, não
 * apenas os básicos). Equivalente a `hasFullMarketAccess` de planHelpers.ts,
 * mantido aqui por compatibilidade com os componentes que já importam daqui.
 */
export const hasFullAccessToAsset = (
  userPlan: AnyPlanCode | string,
  _assetPerfilInvestidor?: string
): boolean => hasFullMarketAccess(userPlan);

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
export const getRequiredPlanForAsset = (
  assetCarteira: string | undefined
): PlanType => {
  const carteira = assetCarteira?.toUpperCase();

  if (carteira === "FALE_C_ESPECIALISTA" || carteira === "SPECIALIST") {
    return "SPECIALIST";
  }
  if (carteira === "PRO") {
    return "PRO";
  }
  return "START";
};
