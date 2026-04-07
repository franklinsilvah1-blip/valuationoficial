type PlanType = "FREE" | "START" | "PRO" | "SPECIALIST";

// Tipo de resultado da verificação de acesso
export type AccessResult = {
  cardType: "full" | "limited";
  buttons: ("upgrade")[];
  message?: string;
};

/**
 * Determina o nível de acesso ao ativo baseado no PLANO do usuário.
 * 
 * Regras simplificadas:
 * - FREE: Card resumido + botão upgrade
 * - START / PRO / SPECIALIST: Card completo (acesso total)
 */
export const getAssetAccessLevelWithProfile = (
  userPlan: PlanType | string,
  _assetPerfilInvestidor?: string | undefined
): AccessResult => {
  const plan = userPlan.toUpperCase();

  // FREE: sempre card resumido + botão upgrade
  if (plan === "FREE") {
    return { 
      cardType: "limited", 
      buttons: ["upgrade"],
      message: "Análise completa disponível para assinantes"
    };
  }

  // Qualquer plano pago: card completo
  return { cardType: "full", buttons: [] };
};
