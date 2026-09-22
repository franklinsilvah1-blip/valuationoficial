import type { AnyPlanCode } from "@/utils/planHelpers";
import { canViewAssetPremium, getMarketLevel } from "@/utils/marketAccess";

// Tipo de resultado da verificação de acesso
export type AccessResult = {
  cardType: "full" | "limited";
  buttons: ("upgrade")[];
  message?: string;
};

/**
 * Determina o nível de acesso ao ativo pela matriz PLANO × PERFIL DO ATIVO
 * (ver src/utils/marketAccess.ts e `can_view_asset_premium()` no banco).
 *
 * - START (e visitantes/anônimos): card resumido + botão upgrade
 * - PRO: card completo para ativos de perfil START/PRO; resumido para
 *   ativos de perfil SPECIALIST
 * - SPECIALIST / WEALTH: card completo em qualquer ativo
 *
 * Continua sendo só APRESENTAÇÃO: os valores premium já chegam mascarados do
 * servidor para quem não tem direito.
 */
export const getAssetAccessLevelWithProfile = (
  userPlan: AnyPlanCode | string,
  assetPerfilInvestidor?: string | undefined,
  isAuthenticated: boolean = true
): AccessResult => {
  const level = getMarketLevel(userPlan, isAuthenticated);

  if (!canViewAssetPremium(level, assetPerfilInvestidor)) {
    return {
      cardType: "limited",
      buttons: ["upgrade"],
      message: "Análise completa disponível para assinantes",
    };
  }

  return { cardType: "full", buttons: [] };
};
