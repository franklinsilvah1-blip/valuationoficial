// Helper functions for plan management

export type PlanType = "FREE" | "START" | "PRO" | "SPECIALIST" | "WEALTH";

export interface PlanInfo {
  code: PlanType;
  displayName: string;
  description: string;
  price: number;
  features: string[];
  dailyViewLimit?: number;
  hasCommunityAccess: boolean;
  isActive: boolean;
}

// Map internal plan codes to display names (simple - for ASSINATURA page)
export const getPlanDisplayNameSimple = (plan: PlanType | string): string => {
  const planNames: Record<string, string> = {
    FREE: "FREE",
    START: "START",
    PRO: "PRO",
    SPECIALIST: "SPECIALIST",
    WEALTH: "WEALTH",
  };
  return planNames[plan] || plan;
};

// Map internal plan codes to display names (full - for CONSULTORIA page)
export const getPlanDisplayNameFull = (plan: PlanType | string): string => {
  const planNames: Record<string, string> = {
    FREE: "FREE",
    START: "Valuation START",
    PRO: "Valuation PRO",
    SPECIALIST: "Valuation SPECIALIST",
    WEALTH: "Valuation WEALTH",
  };
  return planNames[plan] || plan;
};

// Legacy function - kept for backward compatibility
export const getPlanDisplayName = getPlanDisplayNameFull;

// Get plan information
export const getPlanInfo = (plan: PlanType): PlanInfo => {
  const plans: Record<PlanType, PlanInfo> = {
    FREE: {
      code: "FREE",
      displayName: "Plano Free",
      description: "Acesso limitado para conhecer a plataforma",
      price: 0,
      features: [
        "Visualização de até 3 ativos por dia",
        "Acesso básico ao mercado",
        "Sem acesso à comunidade exclusiva",
      ],
      dailyViewLimit: 3,
      hasCommunityAccess: false,
      isActive: true,
    },
    START: {
      code: "START",
      displayName: "Valuation START",
      description: "Para quem está começando a investir",
      price: 147,
      features: [
        "Visualizações ilimitadas",
        "Acesso completo à plataforma",
        "Acesso à comunidade exclusiva",
        "Análises detalhadas de ativos",
        "Carteira recomendada START",
      ],
      hasCommunityAccess: true,
      isActive: true,
    },
    PRO: {
      code: "PRO",
      displayName: "Valuation PRO",
      description: "Para investidores experientes",
      price: 297,
      features: [
        "Todos os benefícios do START",
        "Visualizações ilimitadas",
        "Acesso antecipado a novos conteúdos",
        "Análises avançadas",
        "Carteira recomendada PRO",
        "Relatórios exclusivos",
        "Acesso à comunidade exclusiva",
      ],
      hasCommunityAccess: true,
      isActive: true,
    },
    SPECIALIST: {
      code: "SPECIALIST",
      displayName: "Valuation SPECIALIST",
      description: "Plano para investidores profissionais",
      price: 1497,
      features: [
        "Todos os benefícios do PRO",
        "Visualizações ilimitadas",
        "Relatórios e insights exclusivos",
        "Análises personalizadas",
        "Carteira recomendada SPECIALIST",
        "Suporte prioritário",
        "Acesso à comunidade exclusiva",
        "Mentoria X Valuation",
        "Ganhos Excepcionais TRIM",
      ],
      hasCommunityAccess: true,
      isActive: true,
    },
    WEALTH: {
      code: "WEALTH",
      displayName: "Valuation WEALTH",
      description: "Mentoria exclusiva para investidores e empresários",
      price: 0, // Consulte
      features: [
        "Todos os benefícios do SPECIALIST",
        "Estratégia personalizada",
        "Ampliação inteligente de patrimônio",
        "Blindagem estratégica da riqueza",
        "Mentoria exclusiva | Gestão de ativos e Planejamento Patrimonial",
      ],
      hasCommunityAccess: true,
      isActive: true,
    },
  };

  return plans[plan];
};

// Check if user has access to specific features
export const hasFeatureAccess = (
  userPlan: PlanType | string,
  feature: "unlimited_views" | "community" | "advanced_analysis" | "early_access" | "priority_support"
): boolean => {
  const plan = userPlan as PlanType;
  
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
export const getDailyViewLimit = (plan: PlanType | string): number | null => {
  if (plan === "FREE") return 3;
  return null; // Unlimited for paid plans
};

// Format expiration date
export const formatExpirationDate = (
  plan: PlanType | string,
  expirationDate: string | null
): string => {
  if (plan === "FREE") {
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
  plan: PlanType | string,
  expirationDate: string | null
): "active" | "expired" | "expiring_soon" => {
  if (plan === "FREE") {
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
export const getPlanBadgeVariant = (plan: PlanType | string): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    FREE: "outline",
    START: "secondary",
    PRO: "default",
    SPECIALIST: "default",
  };

  return variants[plan] || "outline";
};

// Compare plans (returns true if planA is higher than planB)
export const isHigherPlan = (planA: PlanType | string, planB: PlanType | string): boolean => {
  const hierarchy = ["FREE", "START", "PRO", "SPECIALIST", "WEALTH"];
  return hierarchy.indexOf(planA) > hierarchy.indexOf(planB);
};

// Get all available plans for purchase
export const getAvailablePlans = (): PlanInfo[] => {
  return [
    getPlanInfo("START"),
    getPlanInfo("PRO"),
    getPlanInfo("SPECIALIST"),
    getPlanInfo("WEALTH"),
  ];
};
