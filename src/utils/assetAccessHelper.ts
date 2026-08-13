import { hasFullMarketAccess, type AnyPlanCode } from "@/utils/planHelpers";

// Tipo de resultado da verificação de acesso
export type AccessResult = {
  cardType: "full" | "limited";
  buttons: ("upgrade")[];
  message?: string;
};

/**
 * Determina o nível de acesso ao ativo baseado no PLANO do usuário.
 *
 * Regras:
 * - START (e visitantes/anônimos): card resumido + botão upgrade
 * - PRO / SPECIALIST / WEALTH: card completo (acesso total)
 */
export const getAssetAccessLevelWithProfile = (
  userPlan: AnyPlanCode | string,
  _assetPerfilInvestidor?: string | undefined
): AccessResult => {
  if (!hasFullMarketAccess(userPlan)) {
    return {
      cardType: "limited",
      buttons: ["upgrade"],
      message: "Análise completa disponível para assinantes",
    };
  }

  return { cardType: "full", buttons: [] };
};
