import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

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
    const { userId, newPlan, newEndDate, action, role, roleId } = await req.json();
    logStep("Request data", { userId, newPlan, newEndDate, action, role, roleId });

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

    // Map plan to Stripe price (you'll need to configure these in your Stripe dashboard)
    const planPriceMap: Record<string, string> = {
      START: Deno.env.get("STRIPE_PRICE_START") || "",
      PRO: Deno.env.get("STRIPE_PRICE_PRO") || "",
      SPECIALIST: Deno.env.get("STRIPE_PRICE_SPECIALIST") || "",
    };

    if (newPlan !== "FREE") {
      const priceId = planPriceMap[newPlan];
      if (!priceId) {
        throw new Error(`Price ID not configured for plan: ${newPlan}`);
      }

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
    } else {
      // Cancel any active subscriptions if downgrading to FREE
      if (subscriptions.data.length > 0) {
        logStep("Canceling subscription for FREE plan");
        await stripe.subscriptions.cancel(subscriptions.data[0].id);
      }
    }

    // Update local database
    const updateData: any = {
      plan: newPlan,
      plan_start_at: new Date().toISOString(),
      stripe_customer_id: customerId,
    };

    if (newPlan === "FREE") {
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
          change_type: "stripe",
          new_end_date: newEndDate || null,
          customer_id: customerId,
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
