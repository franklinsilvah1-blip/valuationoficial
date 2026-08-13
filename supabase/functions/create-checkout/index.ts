import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";
import { APP_URL } from "../_shared/constants.ts";
import { getCheckoutPriceId, LEGACY_PLAN_PRICE_IDS, type CheckoutPlan } from "../_shared/planResolution.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const CHECKOUT_PLANS: CheckoutPlan[] = ["PRO", "SPECIALIST"];

/**
 * Resolve o price ID para o checkout. START é grátis e WEALTH é sob consulta
 * — nenhum dos dois chega aqui (o frontend não oferece checkout para eles).
 * TESTE continua funcionando via o price ID legado (não exposto na nova UI,
 * mantido só para não quebrar links antigos).
 */
function resolveCheckoutPriceId(plan: string, cycle: unknown): string {
  if (plan === "TESTE") {
    return LEGACY_PLAN_PRICE_IDS.TESTE;
  }
  if (!CHECKOUT_PLANS.includes(plan as CheckoutPlan)) {
    throw new Error(`Invalid plan: ${plan}`);
  }
  // Nunca cair silenciosamente em "quarterly" para um cycle ausente/inválido
  // — um valor não reconhecido deve rejeitar o checkout, nunca escolher um
  // preço diferente do que o cliente pediu.
  if (cycle !== "monthly" && cycle !== "quarterly") {
    throw new Error(`Invalid billing cycle: ${String(cycle)}`);
  }
  return getCheckoutPriceId(plan as CheckoutPlan, cycle);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Rate limit: 5 requests per hour
    await checkRateLimit(user.id, "create-checkout", 5, 60);
    logStep("Rate limit check passed");

    const { plan, cycle, affiliateCode } = await req.json();
    const priceId = resolveCheckoutPriceId(plan, cycle);

    logStep("Plan selected", { plan, cycle, priceId, affiliateCode: affiliateCode || 'none' });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Verificar se o cliente já existe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("Creating new customer");
    }

    const origin = APP_URL;
    
    // Build metadata with optional affiliate code
    const metadata: Record<string, string> = {
      user_id: user.id,
      plan: plan,
      cycle: cycle === "monthly" ? "monthly" : "quarterly",
    };
    
    if (affiliateCode) {
      metadata.affiliateCode = affiliateCode.toUpperCase();
      logStep("Adding affiliate code to metadata", { affiliateCode: metadata.affiliateCode });
    }
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/assinatura-sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/assinatura`,
      metadata,
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    const userMessage = error instanceof Error ? mapErrorToUserMessage(error) : "An error occurred";
    const status = errorMessage.includes("RATE_LIMIT_EXCEEDED") ? 429 : 500;
    
    return new Response(JSON.stringify({ error: userMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
