type PlanType = "FREE" | "START" | "PRO" | "SPECIALIST";
type CarteiraType = "START" | "PRO" | "SPECIALIST" | "FALE_C_ESPECIALISTA";

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

// Configuração básica para cards resumidos (FREE)
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

// Configuração completa para planos pagos
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
 * Determina quais campos são visíveis baseado no plano do usuário.
 * 
 * Regras simplificadas:
 * - FREE: Campos básicos
 * - START / PRO / SPECIALIST: Todos os campos
 */
export const getFieldVisibility = (
  userPlan: PlanType | string,
  _assetPerfilInvestidor?: string
): FieldVisibilityConfig => {
  const plan = userPlan.toUpperCase() as PlanType;

  if (plan === "FREE") {
    return BASIC_VISIBILITY;
  }

  return FULL_VISIBILITY;
};

/**
 * Determina quais campos devem ser destacados (highlight) baseado no plano
 */
export const getFieldHighlights = (userPlan: PlanType | string): FieldHighlightConfig => {
  const plan = userPlan.toUpperCase() as PlanType;

  if (plan === "FREE") {
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
 * Verifica se o usuário tem acesso completo ao ativo.
 * Qualquer plano pago tem acesso completo.
 */
export const hasFullAccessToAsset = (
  userPlan: PlanType | string,
  _assetPerfilInvestidor?: string
): boolean => {
  const plan = userPlan.toUpperCase() as PlanType;
  return plan !== "FREE";
};

/**
 * Retorna o plano mínimo necessário para acessar um ativo específico
 */
export const getRequiredPlanForAsset = (
  assetCarteira: CarteiraType | string | undefined
): PlanType => {
  const carteira = assetCarteira?.toUpperCase() as CarteiraType;

  if (carteira === "FALE_C_ESPECIALISTA" || carteira === "SPECIALIST") {
    return "SPECIALIST";
  }
  if (carteira === "PRO") {
    return "PRO";
  }
  return "START";
};
