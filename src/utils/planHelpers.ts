// Fonte central de verdade para planos comerciais da ValuationIT.
// Qualquer checagem de plano/permissão em componentes deve passar por aqui —
// não compare `profile.plan === "PRO"` diretamente nos componentes.

// Planos canônicos (os 4 planos comerciais atuais).
export type PlanType = "START" | "PRO" | "SPECIALIST" | "WEALTH";

// Códigos legados que ainda podem existir em `profiles.plan` para usuários antigos.
// Nunca são gravados para novos usuários, mas continuam sendo lidos/normalizados
// para não rebaixar ninguém. Ver RELATORIO_IMPLEMENTACAO_PLANOS.md para o
// levantamento completo de onde cada um foi encontrado.
export type LegacyPlanCode = "FREE" | "TESTE" | "FALE_C_ESPECIALISTA";

export type AnyPlanCode = PlanType | LegacyPlanCode;

export type BillingCycle = "monthly" | "quarterly";

/**
 * Normaliza qualquer código de plano (canônico, legado, nulo ou desconhecido)
 * para um dos 4 planos canônicos usados em toda a lógica de acesso/entitlements.
 *
 * Mapeamento (matriz de migração, ver RELATORIO_IMPLEMENTACAO_PLANOS.md item 4):
 * - FREE            -> START        (usuário gratuito antigo = novo nível de entrada gratuito)
 * - TESTE            -> PRO          (plano de teste interno tinha acesso completo aos dados;
 *                                      normalizar para START seria um rebaixamento)
 * - FALE_C_ESPECIALISTA -> SPECIALIST (única opção manual de "consultoria" que já existia;
 *                                      é o nível mínimo que dá acesso a especialista — nunca
 *                                      normalizado para WEALTH, que não tem evidência de
 *                                      equivalência real; ver relatório)
 * - valor desconhecido/nulo -> START (fail-safe: nunca retorna undefined)
 *
 * IMPORTANTE — por que START/PRO/SPECIALIST são identidade aqui: no sistema
 * ANTERIOR a esta migração, `profiles.plan = 'START'` já significava
 * "assinante pago com acesso completo aos dados" (o controle de acesso era
 * binário `plan !== 'FREE'`, não hierárquico) e `profiles.plan = 'PRO'` já
 * incluía benefício de especialista. Mapear esses valores 1:1 para os novos
 * START/PRO teria rebaixado assinantes pagantes. Por isso a migration SQL
 * (supabase/migrations/20260415120000_plan_model_v2.sql, seção "backfill de
 * grandfathering") converteu fisicamente e uma única vez, ANTES desta
 * normalização entrar em vigor: START antigo -> PRO, PRO antigo ->
 * SPECIALIST, SPECIALIST antigo permanece SPECIALIST. Depois desse backfill,
 * qualquer 'START'/'PRO'/'SPECIALIST' armazenado já usa o significado NOVO,
 * e esta função pode tratá-los como identidade com segurança. O mesmo
 * grandfathering é aplicado a eventos futuros do Stripe para produtos
 * antigos em supabase/functions/_shared/planResolution.ts
 * (LEGACY_PRODUCT_TO_PLAN).
 */
export const normalizePlanCode = (raw: AnyPlanCode | string | null | undefined): PlanType => {
  if (!raw) return "START";
  const code = raw.toUpperCase();

  switch (code) {
    case "START":
    case "PRO":
    case "SPECIALIST":
    case "WEALTH":
      return code;
    case "FREE":
      return "START";
    case "TESTE":
      return "PRO";
    case "FALE_C_ESPECIALISTA":
      return "SPECIALIST";
    default:
      return "START";
  }
};

export interface PlanEntitlements {
  /** Vê todos os campos de análise (não apenas os básicos). */
  hasFullMarketAccess: boolean;
  /** Tem acesso ao benefício comercial "falar com especialista" / carteira personalizada. */
  canAccessSpecialist: boolean;
  /** Pode iniciar um checkout Stripe para este plano (START e WEALTH não podem). */
  canCheckout: boolean;
  /** Plano é "sob consulta" — CTA deve ser contato comercial, nunca checkout. */
  isContactOnlyPlan: boolean;
  /** Limite diário de visualizações, ou null se ilimitado. */
  dailyViewLimit: number | null;
}

const ENTITLEMENTS: Record<PlanType, PlanEntitlements> = {
  START: {
    hasFullMarketAccess: false,
    canAccessSpecialist: false,
    canCheckout: false,
    isContactOnlyPlan: false,
    dailyViewLimit: null,
  },
  PRO: {
    hasFullMarketAccess: true,
    canAccessSpecialist: false,
    canCheckout: true,
    isContactOnlyPlan: false,
    dailyViewLimit: null,
  },
  SPECIALIST: {
    hasFullMarketAccess: true,
    canAccessSpecialist: true,
    canCheckout: true,
    isContactOnlyPlan: false,
    dailyViewLimit: null,
  },
  WEALTH: {
    hasFullMarketAccess: true,
    canAccessSpecialist: true,
    canCheckout: false,
    isContactOnlyPlan: true,
    dailyViewLimit: null,
  },
};

/** Retorna a matriz completa de direitos de um plano (já normalizado). */
export const getPlanEntitlements = (plan: AnyPlanCode | string | null | undefined): PlanEntitlements => {
  return ENTITLEMENTS[normalizePlanCode(plan)];
};

/** O usuário vê valores reais (não bloqueados) nos campos de análise premium. */
export const hasFullMarketAccess = (plan: AnyPlanCode | string | null | undefined): boolean =>
  getPlanEntitlements(plan).hasFullMarketAccess;

/** O usuário tem acesso ao benefício de especialista / carteira personalizada. */
export const canAccessSpecialist = (plan: AnyPlanCode | string | null | undefined): boolean =>
  getPlanEntitlements(plan).canAccessSpecialist;

/** O plano é "sob consulta" (WEALTH) — nunca deve oferecer checkout Stripe. */
export const isContactOnlyPlan = (plan: AnyPlanCode | string | null | undefined): boolean =>
  getPlanEntitlements(plan).isContactOnlyPlan;

/** Alias mantido por compatibilidade semântica com fieldVisibility.ts. */
export const canViewPremiumAssetFields = hasFullMarketAccess;

export interface PlanInfo {
  code: PlanType;
  displayName: string;
  description: string;
  /** Preço mensal em R$, ou null se não há cobrança mensal avulsa (START grátis, WEALTH sob consulta). */
  priceMonthly: number | null;
  /** Preço trimestral total em R$, ou null (START grátis, WEALTH sob consulta). */
  priceQuarterly: number | null;
  priceNote: string;
  features: string[];
  ctaLabel: string;
  isContactOnly: boolean;
  isFree: boolean;
}

// Map internal plan codes to display names (simple - for ASSINATURA page)
export const getPlanDisplayNameSimple = (plan: AnyPlanCode | string): string => {
  return normalizePlanCode(plan);
};

// Map internal plan codes to display names (full - for CONSULTORIA page)
export const getPlanDisplayNameFull = (plan: AnyPlanCode | string): string => {
  const planNames: Record<PlanType, string> = {
    START: "Valuation START",
    PRO: "Valuation PRO",
    SPECIALIST: "Valuation SPECIALIST",
    WEALTH: "Valuation WEALTH",
  };
  return planNames[normalizePlanCode(plan)];
};

// Legacy function - kept for backward compatibility
export const getPlanDisplayName = getPlanDisplayNameFull;

/**
 * Informação comercial dos 4 planos, conforme especificação de negócio vigente.
 * Os `stripe_price_id` reais não vivem aqui — vivem em `subscription_plans` no banco
 * (fonte de verdade lida pelas Edge Functions). Este objeto é só para exibição.
 */
export const getPlanInfo = (plan: PlanType): PlanInfo => {
  const plans: Record<PlanType, PlanInfo> = {
    START: {
      code: "START",
      displayName: "START",
      description: "Para começar a comparar investimentos.",
      priceMonthly: 0,
      priceQuarterly: 0,
      priceNote: "Grátis",
      features: [
        "Acesso à lista completa de ativos após cadastro",
        "Indicadores básicos dos ativos",
        "Busca e filtros",
        "Acesso limitado aos indicadores premium",
      ],
      ctaLabel: "Começar grátis",
      isContactOnly: false,
      isFree: true,
    },
    PRO: {
      code: "PRO",
      displayName: "PRO",
      description: "Acesso completo aos dados e indicadores de todos os ativos.",
      priceMonthly: 29.9,
      priceQuarterly: 89.7,
      priceNote: "R$ 29,90/mês ou R$ 89,70/trimestre",
      features: [
        "Todos os ativos",
        "Todos os indicadores",
        "Tendência TRIM",
        "Carteira TRIM",
        "Recomendação TRIM",
        "Nota Especialista",
      ],
      ctaLabel: "Assinar",
      isContactOnly: false,
      isFree: false,
    },
    SPECIALIST: {
      code: "SPECIALIST",
      displayName: "SPECIALIST",
      description: "Todos os benefícios do PRO, com acesso a especialista.",
      priceMonthly: 249.9,
      priceQuarterly: 749.7,
      priceNote: "R$ 249,90/mês ou R$ 749,70/trimestre",
      features: [
        "Todos os benefícios do PRO",
        "Acesso a especialista",
        "Carteira personalizada",
      ],
      ctaLabel: "Assinar",
      isContactOnly: false,
      isFree: false,
    },
    WEALTH: {
      code: "WEALTH",
      displayName: "WEALTH",
      description: "Atendimento personalizado para investidores com maior capacidade de investimento.",
      priceMonthly: null,
      priceQuarterly: null,
      priceNote: "Sob consulta",
      features: [
        "Todos os dados e indicadores",
        "Acesso a especialista",
        "Atendimento personalizado",
        "Modelo comercial baseado em percentual sobre o total investido",
      ],
      ctaLabel: "Falar com Especialista",
      isContactOnly: true,
      isFree: false,
    },
  };

  return plans[plan];
};

/** Os 4 planos comerciais selecionáveis, na ordem de exibição. */
export const SELECTABLE_PLANS: PlanType[] = ["START", "PRO", "SPECIALIST", "WEALTH"];

/** Preço exibido de acordo com o ciclo escolhido (só relevante para PRO/SPECIALIST). */
export const getDisplayPrice = (plan: PlanType, cycle: BillingCycle): number | null => {
  const info = getPlanInfo(plan);
  return cycle === "monthly" ? info.priceMonthly : info.priceQuarterly;
};

// Check if user has access to specific features
export const hasFeatureAccess = (
  userPlan: AnyPlanCode | string,
  feature: "unlimited_views" | "community" | "advanced_analysis" | "early_access" | "priority_support"
): boolean => {
  const plan = normalizePlanCode(userPlan);
  const featureMatrix: Record<string, PlanType[]> = {
    unlimited_views: ["START", "PRO", "SPECIALIST", "WEALTH"],
    community: ["START", "PRO", "SPECIALIST", "WEALTH"],
    advanced_analysis: ["PRO", "SPECIALIST", "WEALTH"],
    early_access: ["PRO", "SPECIALIST", "WEALTH"],
    priority_support: ["SPECIALIST", "WEALTH"],
  };
  return featureMatrix[feature]?.includes(plan) || false;
};

// Get daily view limit for plan
export const getDailyViewLimit = (plan: AnyPlanCode | string): number | null => {
  return getPlanEntitlements(plan).dailyViewLimit;
};

// Format expiration date
export const formatExpirationDate = (
  plan: AnyPlanCode | string,
  expirationDate: string | null
): string => {
  if (getPlanInfo(normalizePlanCode(plan)).isFree) {
    return "Não expira";
  }

  if (!expirationDate) {
    return "Não expira";
  }

  const date = new Date(expirationDate);
  const now = new Date();

  if (date < now) {
    return "Expirado";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Get plan status
export const getPlanStatus = (
  plan: AnyPlanCode | string,
  expirationDate: string | null
): "active" | "expired" | "expiring_soon" => {
  if (getPlanInfo(normalizePlanCode(plan)).isFree) {
    return "active";
  }

  if (!expirationDate) {
    return "active";
  }

  const date = new Date(expirationDate);
  const now = new Date();

  if (date < now) {
    return "expired";
  }

  // Check if expiring in 5 days or less
  const daysUntilExpiration = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiration <= 5) {
    return "expiring_soon";
  }

  return "active";
};

// Get plan badge color
export const getPlanBadgeVariant = (plan: AnyPlanCode | string): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<PlanType, "default" | "secondary" | "destructive" | "outline"> = {
    START: "outline",
    PRO: "secondary",
    SPECIALIST: "default",
    WEALTH: "default",
  };
  return variants[normalizePlanCode(plan)];
};

// Compare plans (returns true if planA is higher than planB)
export const isHigherPlan = (planA: AnyPlanCode | string, planB: AnyPlanCode | string): boolean => {
  const hierarchy: PlanType[] = ["START", "PRO", "SPECIALIST", "WEALTH"];
  return hierarchy.indexOf(normalizePlanCode(planA)) > hierarchy.indexOf(normalizePlanCode(planB));
};

// Get all available plans for purchase, in display order
export const getAvailablePlans = (): PlanInfo[] => {
  return SELECTABLE_PLANS.map(getPlanInfo);
};
