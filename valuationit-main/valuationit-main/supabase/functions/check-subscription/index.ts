import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Mapeamento dos product IDs para planos
const PRODUCT_TO_PLAN: Record<string, string> = {
  prod_TMWTUVuAcCM1Qg: "START",
  prod_TMWWN3NKrAoZYe: "PRO",
  prod_TdJ7Clh2GRzchP: "SPECIALIST",
  prod_TnV2XDNVvq4DPq: "TESTE", // Plano de teste antigo R$ 2/dia
  prod_TpKS0xmSbMgIq6: "TESTE", // Plano de teste novo R$ 2/semana
};

// Helper function to check if user is admin
const isUserAdmin = async (supabaseClient: any, userId: string): Promise<boolean> => {
  const { data } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  
  return !!data;
};

Deno.serve(async (req) => {
  // Log every invocation attempt
  console.log("[CHECK-SUBSCRIPTION] ===== FUNCTION INVOKED =====");
  console.log("[CHECK-SUBSCRIPTION] Method:", req.method);
  console.log("[CHECK-SUBSCRIPTION] Headers:", Object.fromEntries(req.headers.entries()));
  
  if (req.method === "OPTIONS") {
    logStep("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Rate limit: 300 requests per hour (5 per minute with buffer for retries and multiple tabs)
    await checkRateLimit(user.id, "check-subscription", 300, 60);
    logStep("Rate limit check passed");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, checking if user is admin");
      
      // Check if user is admin - admins always have SPECIALIST plan
      if (await isUserAdmin(supabaseClient, user.id)) {
        logStep("User is admin, returning SPECIALIST plan");
        return new Response(JSON.stringify({ 
          subscribed: true, 
          plan: "SPECIALIST",
          subscription_end: null 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      logStep("No customer found, updating unsubscribed state");
      
      // Atualizar perfil para FREE
      await supabaseClient
        .from("profiles")
        .update({ plan: "FREE", plan_start_at: null, plan_end_at: null })
        .eq("id", user.id);
      
      return new Response(JSON.stringify({ subscribed: false, plan: "FREE" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Buscar assinaturas ativas E canceladas (canceladas podem ter período válido restante)
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    let subscription = activeSubscriptions.data.length > 0 ? activeSubscriptions.data[0] : null;

    // Se não encontrou assinatura ativa, buscar canceladas com período ainda válido
    if (!subscription) {
      logStep("No active subscription, checking canceled with valid period");
      const canceledSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "canceled",
        limit: 5,
      });

      const now = Math.floor(Date.now() / 1000);
      subscription = canceledSubscriptions.data.find(
        (sub) => sub.current_period_end && sub.current_period_end > now
      ) || null;

      if (subscription) {
        logStep("Found canceled subscription with valid period", {
          subscriptionId: subscription.id,
          periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        });
      }
    }

    let hasActiveSub = !!subscription;
    let plan = "FREE";
    let subscriptionEnd = null;

    if (hasActiveSub && subscription) {
      // Validate timestamps before converting - treat invalid as FREE instead of error
      const periodEnd = subscription.current_period_end;
      const periodStart = subscription.current_period_start;
      
      if (!periodEnd || typeof periodEnd !== 'number' || periodEnd <= 0) {
        logStep("Invalid period_end, treating as FREE", { periodEnd });
        hasActiveSub = false;
        plan = "FREE";
      } else if (!periodStart || typeof periodStart !== 'number' || periodStart <= 0) {
        logStep("Invalid period_start, treating as FREE", { periodStart });
        hasActiveSub = false;
        plan = "FREE";
      } else {
        subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        const subscriptionStart = new Date(periodStart * 1000).toISOString();
        
        logStep("Valid subscription found", { 
          subscriptionId: subscription.id,
          status: subscription.status,
          endDate: subscriptionEnd,
          startDate: subscriptionStart 
        });
        
        const priceProduct = subscription.items.data[0].price.product;
        const productId = typeof priceProduct === 'string' ? priceProduct : priceProduct?.id;
        plan = PRODUCT_TO_PLAN[productId] || "FREE";
        logStep("Determined subscription plan", { productId, plan });

        const { data: currentProfile } = await supabaseClient
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        const wasFreeBefore = !currentProfile || currentProfile.plan === "FREE";

        if (!(await isUserAdmin(supabaseClient, user.id))) {
          await supabaseClient
            .from("profiles")
            .update({ 
              plan: plan,
              plan_start_at: subscriptionStart,
              plan_end_at: subscriptionEnd,
              stripe_customer_id: customerId
            })
            .eq("id", user.id);
          
          logStep("Profile updated in Supabase");
        } else {
          logStep("User is admin, skipping plan update");
        }

        if (wasFreeBefore && plan !== "FREE") {
          logStep("Sending welcome email for new paid subscription");
          const sendEmail = async () => {
            try {
              const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ userId: user.id, plan }),
              });
              if (!response.ok) {
                console.error("[CHECK-SUBSCRIPTION] Failed to send welcome email");
              } else {
                logStep("Welcome email sent successfully");
              }
            } catch (emailError) {
              console.error("[CHECK-SUBSCRIPTION] Error sending welcome email:", emailError);
            }
          };
          sendEmail();
        }
      }
    } else {
      logStep("No valid subscription found, checking if user is admin");
      
      if (await isUserAdmin(supabaseClient, user.id)) {
        logStep("User is admin, returning SPECIALIST plan");
        plan = "SPECIALIST";
        subscriptionEnd = null;
      } else {
        // Verificar plan_end_at no banco antes de resetar para FREE
        const { data: existingProfile } = await supabaseClient
          .from("profiles")
          .select("plan, plan_end_at")
          .eq("id", user.id)
          .single();

        if (existingProfile && existingProfile.plan_end_at) {
          const planEndDate = new Date(existingProfile.plan_end_at);
          if (planEndDate > new Date()) {
            logStep("Plan still valid per plan_end_at, NOT resetting to FREE", {
              plan: existingProfile.plan,
              plan_end_at: existingProfile.plan_end_at,
            });
            plan = existingProfile.plan;
            subscriptionEnd = existingProfile.plan_end_at;
          } else {
            logStep("Plan expired, resetting to FREE");
            await supabaseClient
              .from("profiles")
              .update({ plan: "FREE", plan_start_at: null, plan_end_at: null })
              .eq("id", user.id);
          }
        } else {
          logStep("No plan_end_at, resetting to FREE");
          await supabaseClient
            .from("profiles")
            .update({ plan: "FREE", plan_start_at: null, plan_end_at: null })
            .eq("id", user.id);
        }
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan: plan,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Enhanced error logging
    console.error("[CHECK-SUBSCRIPTION] ===== ERROR =====");
    console.error("[CHECK-SUBSCRIPTION] Message:", errorMessage);
    console.error("[CHECK-SUBSCRIPTION] Stack:", errorStack);
    console.error("[CHECK-SUBSCRIPTION] Full error:", error);
    
    logStep("ERROR in check-subscription", { 
      message: errorMessage,
      stack: errorStack,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    const userMessage = error instanceof Error ? mapErrorToUserMessage(error) : "An error occurred";
    const status = errorMessage.includes("RATE_LIMIT_EXCEEDED") ? 429 : 500;
    
    return new Response(JSON.stringify({ 
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
