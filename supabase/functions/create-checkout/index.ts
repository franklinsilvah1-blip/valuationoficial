import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Mapeamento dos planos para price IDs (trimestrais)
const PLAN_PRICE_IDS: Record<string, string> = {
  START: "price_1SPnQvRyKGDht1PjOco1Y4vh", // R$ 147,00 trimestral
  PRO: "price_1SPnT8RyKGDht1PjyyTAXXaQ", // R$ 297,00 trimestral
  SPECIALIST: "price_1Sg2VXRyKGDht1Pj2cow0LgQ", // R$ 597,00 trimestral
  TESTE: "price_1SrfnLRyKGDht1PjDfuxru7e", // R$ 2,00 semanal - plano de teste
};

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

    const { plan, affiliateCode } = await req.json();
    const priceId = PLAN_PRICE_IDS[plan];
    
    if (!priceId) {
      throw new Error(`Invalid plan: ${plan}`);
    }
    
    logStep("Plan selected", { plan, priceId, affiliateCode: affiliateCode || 'none' });

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

    const origin = req.headers.get("origin") || "https://clube-carteira-facil.lovable.app";
    
    // Build metadata with optional affiliate code
    const metadata: Record<string, string> = {
      user_id: user.id,
      plan: plan,
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
