import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { getCheckoutPriceId, type BillingCycle, type CheckoutPlan } from "../_shared/planResolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPDATE-CLIENT-PLAN] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const adminUser = userData.user;
    if (!adminUser) throw new Error("Not authenticated");

    // Check if user is admin
    const { data: adminRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      throw new Error("Unauthorized: Admin access required");
    }

    logStep("Admin verified", { adminId: adminUser.id });

    // Get request body
    const { userId, newPlan, newEndDate, cycle, action, role, roleId } = await req.json();
    logStep("Request data", { userId, newPlan, newEndDate, cycle, action, role, roleId });

    // Handle remove_role action
    if (action === "remove_role") {
      if (!userId || !roleId) {
        throw new Error("userId and roleId are required for remove_role action");
      }

      // Verify the role exists and belongs to this user
      const { data: existingRole, error: checkError } = await supabaseClient
        .from("user_roles")
        .select("*")
        .eq("id", roleId)
        .eq("user_id", userId)
        .single();

      if (checkError || !existingRole) {
        throw new Error("Role not found or doesn't belong to this user");
      }

      // Prevent removing admin role
      if (existingRole.role === "admin") {
        throw new Error("Cannot remove admin role");
      }

      // Delete the role
      const { error: deleteError } = await supabaseClient
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (deleteError) throw new Error(`Failed to remove role: ${deleteError.message}`);

      logStep("Role removed", { userId, roleId, role: existingRole.role });

      // Register in audit log
      const { error: auditError } = await supabaseClient
        .from("admin_audit_log")
        .insert({
          user_id: userId,
          granted_by: adminUser.id,
          action: "role_removed",
          role_assigned: existingRole.role,
          metadata: {
            removed_role: existingRole.role,
            timestamp: new Date().toISOString(),
          },
        });

      if (auditError) {
        logStep("Failed to create audit log", { error: auditError });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Role removed successfully",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Handle assign_role action
    if (action === "assign_role") {
      if (!userId || !role) {
        throw new Error("userId and role are required for assign_role action");
      }

      // Validate role
      const validRoles = ["admin", "user", "editor", "moderator"];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}`);
      }

      // Check if user already has this role
      const { data: existingRole } = await supabaseClient
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .eq("role", role)
        .maybeSingle();

      if (existingRole) {
        throw new Error("User already has this role");
      }

      // Insert role
      const { error: roleError } = await supabaseClient
        .from("user_roles")
        .insert({
          user_id: userId,
          role: role,
        });

      if (roleError) throw new Error(`Failed to assign role: ${roleError.message}`);

      logStep("Role assigned", { userId, role });

      // Register in audit log
      const { error: auditError } = await supabaseClient
        .from("admin_audit_log")
        .insert({
          user_id: userId,
          granted_by: adminUser.id,
          action: "role_assigned",
          role_assigned: role,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        });

      if (auditError) {
        logStep("Failed to create audit log", { error: auditError });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Role assigned successfully",
          role,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Original plan update logic
    if (!userId || !newPlan) {
      throw new Error("userId and newPlan are required");
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) throw new Error(`Failed to get user profile: ${profileError.message}`);
    if (!profile.email) throw new Error("User email not found");

    logStep("User profile retrieved", { email: profile.email, currentPlan: profile.plan });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create Stripe customer
    let customerId: string;
    const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.name || undefined,
      });
      customerId = customer.id;
      logStep("New Stripe customer created", { customerId });
    }

    // Get current subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

// START é gratuito e WEALTH é sob consulta — nenhum dos dois tem cobrança
    // Stripe automática. START/FREE (legado) cancelam qualquer assinatura
    // ativa; WEALTH não mexe na assinatura Stripe existente (é uma decisão
    // comercial separada, o admin cancela manualmente se for o caso).
    const isNoCheckoutPlan = newPlan === "FREE" || newPlan === "START";
    const isWealthPlan = newPlan === "WEALTH";

    /**
     * Resolve o price ID para PRO/SPECIALIST no ciclo pedido (default
     * trimestral, para não quebrar chamadas antigas do admin sem `cycle`).
     * Tenta primeiro o par de env vars novo (mensal/trimestral); se não
     * estiver configurado, cai para a env var legada única (compatibilidade
     * com o painel admin anterior a esta migração).
     */
    function resolveAdminPriceId(plan: string, billingCycle: BillingCycle): string {
      if (plan === "PRO" || plan === "SPECIALIST") {
        try {
          return getCheckoutPriceId(plan as CheckoutPlan, billingCycle);
        } catch {
          const legacyEnvVar = plan === "PRO" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_SPECIALIST";
          const legacyPriceId = Deno.env.get(legacyEnvVar);
          if (legacyPriceId) return legacyPriceId;
          throw new Error(`Price ID not configured for plan: ${plan}/${billingCycle}`);
        }
      }
      throw new Error(`Plan ${plan} does not use Stripe checkout`);
    }

    if (!isNoCheckoutPlan && !isWealthPlan) {
      const resolvedCycle: BillingCycle = cycle === "monthly" ? "monthly" : "quarterly";
      const priceId = resolveAdminPriceId(newPlan, resolvedCycle);

      if (subscriptions.data.length > 0) {
        // Update existing subscription
        const subscription = subscriptions.data[0];
        logStep("Updating existing subscription", { subscriptionId: subscription.id });

        await stripe.subscriptions.update(subscription.id, {
          items: [{
            id: subscription.items.data[0].id,
            price: priceId,
          }],
          proration_behavior: "always_invoice",
        });

        logStep("Subscription updated in Stripe");
      } else {
        // Create new subscription
        logStep("Creating new subscription");

        await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
        });

        logStep("New subscription created in Stripe");
      }
    } else if (isNoCheckoutPlan) {
      // Cancela qualquer assinatura ativa ao rebaixar para START/FREE
      if (subscriptions.data.length > 0) {
        logStep("Canceling subscription for START/FREE plan");
        await stripe.subscriptions.cancel(subscriptions.data[0].id);
      }
    } else {
      logStep("WEALTH plan: skipping Stripe subscription changes (billing is off-platform)", {
        hadExistingActiveSubscription: subscriptions.data.length > 0,
        existingSubscriptionId: subscriptions.data[0]?.id || null,
      });
    }

    // Concessão manual de WEALTH sobre uma assinatura Stripe ainda ativa: não
    // é um erro (a assinatura antiga continua cobrando normalmente até o
    // admin decidir cancelá-la separadamente), mas precisa ficar visível —
    // nunca uma troca silenciosa entre duas fontes de verdade conflitantes.
    const wealthOverStripeWarning =
      isWealthPlan && subscriptions.data.length > 0
        ? `Atenção: o usuário recebeu o plano WEALTH administrativamente, mas ainda possui uma assinatura Stripe ativa (${subscriptions.data[0].id}) que continuará sendo cobrada normalmente. Cancele-a manualmente no Stripe se isso não for desejado — esta ação não cancela assinaturas automaticamente.`
        : null;

    // Update local database.
    // plan_start_at é evidência de plano pago para o backfill de
    // grandfathering (20260415120000_plan_model_v2.sql). Ao rebaixar para
    // START/FREE (isNoCheckoutPlan — sem cobrança), nunca carimba data nova
    // e limpa qualquer valor anterior — um usuário genuinamente movido para
    // o nível grátis não deve parecer "assinante legado pago".
    //
    // stripe_customer_id é diferente: representa o Customer do usuário no
    // Stripe, que continua existindo (e deve continuar existindo) mesmo após
    // a assinatura ser cancelada ou o plano virar START — é reutilizado pelo
    // checkout de uma futura reassinatura, pelo customer-portal e pelo
    // histórico de pagamentos (ver auditoria completa no relatório). Nunca é
    // apagado por um downgrade nem substituído por um Customer novo aqui —
    // só é atualizado quando muda de verdade (era null e agora foi
    // encontrado/criado um Customer real).
    const updateData: any = {
      plan: newPlan,
      plan_start_at: isNoCheckoutPlan ? null : new Date().toISOString(),
      stripe_customer_id: customerId,
    };

    if (isNoCheckoutPlan) {
      updateData.plan_end_at = null;
    } else if (newEndDate) {
      updateData.plan_end_at = new Date(newEndDate).toISOString();
    } else {
      // Set 1 month from now as default
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      updateData.plan_end_at = endDate.toISOString();
    }

    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (updateError) throw new Error(`Failed to update profile: ${updateError.message}`);

    logStep("Profile updated in database");

    // Register in audit log
    const { error: auditError } = await supabaseClient
      .from("admin_audit_log")
      .insert({
        user_id: userId,
        granted_by: adminUser.id,
        action: "stripe_plan_update",
        old_plan: profile.plan,
        new_plan: newPlan,
        metadata: {
          change_type: isWealthPlan
            ? "administrative_wealth_grant"
            : isNoCheckoutPlan
              ? "administrative_downgrade_to_free"
              : "stripe",
          new_end_date: newEndDate || null,
          customer_id: customerId,
          had_existing_active_stripe_subscription: subscriptions.data.length > 0,
          existing_stripe_subscription_id: subscriptions.data[0]?.id || null,
          timestamp: new Date().toISOString(),
        },
      });

    if (auditError) {
      logStep("Failed to create audit log", { error: auditError });
      // Don't throw - audit is optional
    } else {
      logStep("Audit log created");
    }

    // Send notification email (optional)
    try {
      await supabaseClient.functions.invoke("send-admin-notification", {
        body: {
          subject: "Plano Atualizado",
          message: `O administrador ${adminUser.email} alterou seu plano para ${newPlan}`,
          recipientEmail: profile.email,
        },
      });
      logStep("Notification email sent");
    } catch (emailError) {
      logStep("Failed to send notification email", { error: emailError });
      // Don't throw - email is optional
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Plan updated successfully",
        newPlan,
        warning: wealthOverStripeWarning,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
