// Fonte central de verdade para resolução de planos nas Edge Functions.
// Não crie um novo dicionário plano<->Stripe fora daqui — estenda este arquivo.

export type BillingCycle = "monthly" | "quarterly";
export type CheckoutPlan = "PRO" | "SPECIALIST";

/**
 * Dicionário LEGADO de Product ID Stripe -> PLANO CANÔNICO NOVO (com
 * grandfathering), usado por assinaturas Stripe criadas antes desta
 * migração (cobrança trimestral única, era de nomenclatura antiga).
 *
 * ATENÇÃO — isto NÃO é um mapeamento 1:1 de nome antigo para nome novo.
 * No sistema anterior o controle de acesso a `asset_analyses` era binário
 * (`plan !== "FREE"` = acesso completo aos dados, ver
 * fieldVisibility.ts/hasFullAccessToAsset antes desta migração) — ou seja,
 * o antigo `START` pago já dava acesso completo aos indicadores, e o antigo
 * `PRO` já incluía benefício de especialista (Product IDs confirmados em
 * create-checkout/stripe-webhook/check-subscription anteriores a esta
 * migração). Mapear literalmente `START antigo -> START novo` rebaixaria um
 * assinante pagante para o novo nível gratuito. Por isso os produtos
 * antigos resolvem para o nível de acesso NOVO equivalente, não para o
 * código de mesmo nome:
 *
 *   prod_TMWTUVuAcCM1Qg (START antigo, pago, acesso completo)      -> PRO novo
 *   prod_TMWWN3NKrAoZYe (PRO antigo, pago, com benefício especialista) -> SPECIALIST novo
 *   prod_TdJ7Clh2GRzchP (SPECIALIST antigo, nível mais alto)       -> SPECIALIST novo (preservado, nunca WEALTH)
 *   prod_TnV2XDNVvq4DPq / prod_TpKS0xmSbMgIq6 (TESTE, acesso completo comprovado) -> PRO novo
 *
 * Preservado como fonte única — nunca editar sem reconfirmar os Product IDs
 * reais no dashboard Stripe.
 */
export const LEGACY_PRODUCT_TO_PLAN: Record<string, string> = {
  prod_TMWTUVuAcCM1Qg: "PRO", // START antigo (pago, acesso completo) — grandfathered para PRO
  prod_TMWWN3NKrAoZYe: "SPECIALIST", // PRO antigo (com especialista) — grandfathered para SPECIALIST
  prod_TdJ7Clh2GRzchP: "SPECIALIST", // SPECIALIST antigo — preservado, nunca rebaixado nem virado WEALTH
  prod_TnV2XDNVvq4DPq: "PRO", // Plano de teste antigo R$ 2/dia — nível comprovado: acesso completo
  prod_TpKS0xmSbMgIq6: "PRO", // Plano de teste novo R$ 2/semana — nível comprovado: acesso completo
};

/**
 * Price IDs LEGADOS (cobrança trimestral única, pré-migração). Usados apenas
 * por create-checkout para o plano TESTE (mantido funcionando, não exposto
 * na nova UI de assinatura).
 */
export const LEGACY_PLAN_PRICE_IDS: Record<string, string> = {
  START: "price_1SPnQvRyKGDht1PjOco1Y4vh", // R$ 147,00 trimestral (legado)
  PRO: "price_1SPnT8RyKGDht1PjyyTAXXaQ", // R$ 297,00 trimestral (legado)
  SPECIALIST: "price_1Sg2VXRyKGDht1Pj2cow0LgQ", // R$ 597,00 trimestral (legado)
  TESTE: "price_1SrfnLRyKGDht1PjDfuxru7e", // R$ 2,00 semanal - plano de teste
};

/**
 * Nomes das variáveis de ambiente para os NOVOS price IDs (mensal/trimestral,
 * PRO e SPECIALIST). Ainda não configuradas em produção — ver .env.example.
 * getCheckoutPriceId lança um erro claro se a env var não estiver definida,
 * em vez de escolher um price ID incorreto.
 */
const NEW_PRICE_ENV_VARS: Record<CheckoutPlan, Record<BillingCycle, string>> = {
  PRO: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    quarterly: "STRIPE_PRICE_PRO_QUARTERLY",
  },
  SPECIALIST: {
    monthly: "STRIPE_PRICE_SPECIALIST_MONTHLY",
    quarterly: "STRIPE_PRICE_SPECIALIST_QUARTERLY",
  },
};

/**
 * Resolve o price ID Stripe a ser usado num NOVO checkout para PRO/SPECIALIST
 * mensal ou trimestral. START não tem checkout (é grátis) e WEALTH não tem
 * checkout automático (é sob consulta) — nunca chame esta função para eles.
 *
 * Lança erro claro se a env var correspondente não estiver configurada,
 * em vez de silenciosamente cair em um plano/preço errado.
 */
export function getCheckoutPriceId(plan: CheckoutPlan, cycle: BillingCycle): string {
  const envVarName = NEW_PRICE_ENV_VARS[plan][cycle];
  const priceId = Deno.env.get(envVarName);
  if (!priceId) {
    throw new Error(
      `Checkout indisponível para ${plan}/${cycle}: variável de ambiente ${envVarName} não configurada.`
    );
  }
  return priceId;
}

/**
 * Resolve o plano canônico (ou legado) a partir de um evento Stripe,
 * priorizando o Price ID (mais preciso — distingue mensal/trimestral do
 * mesmo produto) e caindo para o Product ID legado quando o price não é
 * reconhecido. Retorna null se nada bater — quem chama decide o fallback
 * (nunca deve rebaixar silenciosamente um plano melhor para um pior).
 */
export function resolvePlanFromStripe(params: { priceId?: string | null; productId?: string | null }): string | null {
  const { priceId, productId } = params;

  if (priceId) {
    for (const plan of Object.keys(NEW_PRICE_ENV_VARS) as CheckoutPlan[]) {
      for (const cycle of ["monthly", "quarterly"] as BillingCycle[]) {
        const envVarName = NEW_PRICE_ENV_VARS[plan][cycle];
        const configuredPriceId = Deno.env.get(envVarName);
        if (configuredPriceId && configuredPriceId === priceId) {
          return plan;
        }
      }
    }
  }

  if (productId && LEGACY_PRODUCT_TO_PLAN[productId]) {
    return LEGACY_PRODUCT_TO_PLAN[productId];
  }

  return null;
}

/**
 * Fallback de current_period_end SOMENTE para o caso raríssimo de o Stripe
 * retornar um período inválido/ausente (nunca observado em operação normal
 * — é uma defesa contra dado malformado, não o caminho principal). Stripe é
 * sempre a fonte de verdade do período (current_period_end); nunca assumir
 * "trimestre = 90 dias" — deriva a duração real do
 * price.recurring.interval/interval_count do próprio item da assinatura
 * (ex.: interval="month", interval_count=3 -> 3 meses reais, não 90 dias
 * fixos). Só cai no fallback genérico de 30 dias se nem isso estiver
 * disponível.
 */
export function estimatePeriodEndFallback(item: {
  price?: { recurring?: { interval?: string; interval_count?: number } | null } | null;
} | undefined): string {
  const recurring = item?.price?.recurring;
  const now = new Date();
  if (recurring?.interval === "month" || recurring?.interval === "year") {
    const count = recurring.interval_count && recurring.interval_count > 0 ? recurring.interval_count : 1;
    const result = new Date(now);
    if (recurring.interval === "month") {
      result.setMonth(result.getMonth() + count);
    } else {
      result.setFullYear(result.getFullYear() + count);
    }
    return result.toISOString();
  }
  // Sem informação de intervalo disponível: fallback genérico de 30 dias
  // (não 90 — não presume trimestre).
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
}
