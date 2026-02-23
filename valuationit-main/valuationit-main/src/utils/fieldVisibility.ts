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

// Configuração básica para cards resumidos (FREE ou sem acesso completo)
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

// Configuração completa para cards com acesso total
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
 * Determina quais campos são visíveis baseado no plano do usuário e PERFIL DO ATIVO.
 * 
 * Regras simplificadas (apenas PLANO + PERFIL DO ATIVO):
 * - FREE: Sempre campos básicos
 * - START: Completo se PERFIL_DO_ATIVO = START
 * - PRO: Completo se PERFIL_DO_ATIVO ∈ {START, PRO}
 * - SPECIALIST: Sempre campos completos
 */
export const getFieldVisibility = (
  userPlan: PlanType | string,
  assetPerfilInvestidor?: string
): FieldVisibilityConfig => {
  const plan = userPlan.toUpperCase() as PlanType;
  const perfil = assetPerfilInvestidor?.toUpperCase();

  // FREE: Sempre campos básicos
  if (plan === "FREE") {
    return BASIC_VISIBILITY;
  }

  // SPECIALIST: Sempre campos completos
  if (plan === "SPECIALIST") {
    return FULL_VISIBILITY;
  }

  // START: Completo se PERFIL_DO_ATIVO = START
  if (plan === "START") {
    if (perfil === "START") {
      return FULL_VISIBILITY;
    }
    return BASIC_VISIBILITY;
  }

  // PRO: Completo se PERFIL_DO_ATIVO = START ou PRO
  if (plan === "PRO") {
    if (perfil === "START" || perfil === "PRO") {
      return FULL_VISIBILITY;
    }
    return BASIC_VISIBILITY;
  }

  // Fallback
  return BASIC_VISIBILITY;
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

  // START, PRO, SPECIALIST: mesmos highlights
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
 * Verifica se o usuário tem acesso completo ao ativo
 * Regras simplificadas: apenas PLANO + PERFIL DO ATIVO
 */
export const hasFullAccessToAsset = (
  userPlan: PlanType | string,
  assetPerfilInvestidor?: string
): boolean => {
  const plan = userPlan.toUpperCase() as PlanType;
  const perfil = assetPerfilInvestidor?.toUpperCase();

  if (plan === "FREE") return false;
  
  if (plan === "SPECIALIST") return true;
  
  if (plan === "START") {
    return perfil === "START";
  }
  
  if (plan === "PRO") {
    return perfil === "START" || perfil === "PRO";
  }

  return false;
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
