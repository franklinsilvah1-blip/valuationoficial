type PlanType = "FREE" | "START" | "PRO" | "SPECIALIST";

// Tipo de resultado da verificação de acesso
export type AccessResult = {
  cardType: "full" | "limited";
  buttons: ("upgrade")[];
  message?: string;
};

/**
 * Determina o nível de acesso ao ativo baseado em PLANO + PERFIL DO ATIVO
 * 
 * Regras simplificadas:
 * 
 * FREE: Sempre card resumido + botão upgrade
 * 
 * START: 
 * - PERFIL_DO_ATIVO = START → Card completo
 * - PERFIL_DO_ATIVO ≠ START → Card resumido + botão upgrade
 * 
 * PRO:
 * - PERFIL_DO_ATIVO = START ou PRO → Card completo
 * - PERFIL_DO_ATIVO = SPECIALIST → Card resumido + botão upgrade
 * 
 * SPECIALIST:
 * - Sempre card completo, independente do PERFIL DO ATIVO
 */
export const getAssetAccessLevelWithProfile = (
  userPlan: PlanType | string,
  assetPerfilInvestidor: string | undefined
): AccessResult => {
  const plan = userPlan.toUpperCase();
  const perfil = assetPerfilInvestidor?.toUpperCase();

  // ========== FREE ==========
  // Sempre card resumido + botão upgrade
  if (plan === "FREE") {
    return { 
      cardType: "limited", 
      buttons: ["upgrade"],
      message: "Análise completa disponível para assinantes"
    };
  }

  // ========== SPECIALIST ==========
  // SEMPRE card COMPLETO, independente do PERFIL DO ATIVO
  if (plan === "SPECIALIST") {
    return { cardType: "full", buttons: [] };
  }

  // ========== START ==========
  if (plan === "START") {
    // PERFIL_DO_ATIVO = START → Card completo
    if (perfil === "START") {
      return { cardType: "full", buttons: [] };
    }
    // PERFIL_DO_ATIVO ≠ START → Card resumido + upgrade
    return { 
      cardType: "limited", 
      buttons: ["upgrade"],
      message: "Análise completa disponível no Plano PRO ou SPECIALIST"
    };
  }

  // ========== PRO ==========
  if (plan === "PRO") {
    // PERFIL_DO_ATIVO = START ou PRO → Card completo
    if (perfil === "START" || perfil === "PRO") {
      return { cardType: "full", buttons: [] };
    }
    // PERFIL_DO_ATIVO = SPECIALIST → Card resumido + upgrade
    return { 
      cardType: "limited", 
      buttons: ["upgrade"],
      message: "Análise completa disponível no Plano SPECIALIST"
    };
  }

  // Fallback para qualquer plano não reconhecido
  return { cardType: "full", buttons: [] };
};
