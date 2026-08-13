import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolvePlanFromStripe } from "../_shared/planResolution.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FORCE-SYNC] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Force sync started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is admin
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!roles;
    logStep("Admin status checked", { isAdmin });

    // Get target user ID from request body (admin can sync any user)
    const body = await req.json().catch(() => ({}));
    const targetUserId = isAdmin && body.userId ? body.userId : user.id;
    
    if (targetUserId !== user.id && !isAdmin) {
      throw new Error("Unauthorized to sync other users");
    }

    logStep("Target user determined", { targetUserId });

    // Get target user's email
    const { data: targetProfile } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("id", targetUserId)
      .single();

    if (!targetProfile?.email) {
      throw new Error("Target user not found");
    }

    const targetEmail = targetProfile.email;
    logStep("Target email retrieved", { targetEmail });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Find Stripe customer
    const customers = await stripe.customers.list({ email: targetEmail, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");

      // Sem cliente Stripe: usuário volta ao nível gratuito de entrada
      // (START), nunca ao valor legado FREE.
      await supabaseClient
        .from("profiles")
        .update({
          plan: "START",
          plan_start_at: null,
          plan_end_at: null,
          stripe_customer_id: null
        })
        .eq("id", targetUserId);

      return new Response(JSON.stringify({
        success: true,
        message: "No active subscription found",
        plan: "START",
        logs: [`No Stripe customer for ${targetEmail}`]
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Stripe customer found", { customerId });

    // Get active subscriptions
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    logStep("Active subscriptions retrieved", { count: activeSubscriptions.data.length });

    let subscription = activeSubscriptions.data.length > 0 ? activeSubscriptions.data[0] : null;

    // Se não encontrou ativa, buscar canceladas com período válido
    if (!subscription) {
      logStep("No active subscription, checking canceled with valid period");
      const canceledSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "canceled",
        limit: 10,
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

    if (!subscription) {
      // No valid subscription at all — volta para START, nunca FREE.
      await supabaseClient
        .from("profiles")
        .update({
          plan: "START",
          plan_start_at: null,
          plan_end_at: null,
          stripe_customer_id: customerId
        })
        .eq("id", targetUserId);

      return new Response(JSON.stringify({
        success: true,
        message: "No active or valid canceled subscription",
        plan: "START",
        customerId,
        logs: [`Customer ${customerId} has no valid subscriptions`]
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const priceId = subscription.items.data[0].price.id;
    const productId = subscription.items.data[0].price.product as string;

    // Busca o plano atual antes de resolver, para nunca rebaixar caso o
    // price/product não seja reconhecido.
    const { data: currentProfileRow } = await supabaseClient
      .from("profiles")
      .select("plan")
      .eq("id", targetUserId)
      .single();
    const plan = resolvePlanFromStripe({ priceId, productId }) || currentProfileRow?.plan || "START";
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const subscriptionStart = new Date(subscription.current_period_start * 1000).toISOString();

    logStep("Subscription details", { 
      subscriptionId: subscription.id,
      productId,
      plan,
      start: subscriptionStart,
      end: subscriptionEnd
    });

    // Force update profile
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({ 
        plan,
        plan_start_at: subscriptionStart,
        plan_end_at: subscriptionEnd,
        stripe_customer_id: customerId
      })
      .eq("id", targetUserId);

    if (updateError) {
      logStep("Error updating profile", { error: updateError });
      throw updateError;
    }

    logStep("Profile updated successfully");

    return new Response(JSON.stringify({ 
      success: true,
      message: "Subscription synchronized successfully",
      plan,
      customerId,
      subscriptionId: subscription.id,
      subscriptionEnd,
      logs: [
        `Found customer ${customerId}`,
        `Found subscription ${subscription.id}`,
        `Product ${productId} mapped to plan ${plan}`,
        `Profile updated successfully`
      ]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[FORCE-SYNC] ERROR:", errorMessage);
    console.error("[FORCE-SYNC] STACK:", errorStack);
    
    // Send notification to admin about sync failure
    try {
      // Get user email for context
      const authHeader = req.headers.get("Authorization");
      let userEmail: string | undefined;
      
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabaseClient.auth.getUser(token);
        userEmail = userData?.user?.email;
      }
      
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-admin-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          type: 'sync_failure',
          errorMessage,
          errorStack,
          userEmail,
          timestamp: new Date().toISOString(),
          syncType: 'force-sync-subscription',
        }),
      });
      
      logStep("Admin notified about sync failure");
    } catch (notifyError) {
      logStep("WARNING: Failed to notify admin about sync failure");
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: "Erro ao sincronizar assinatura. Tente novamente."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
