import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-OWN-ACCOUNT] ${step}${detailsStr}`);
};

interface DeleteAccountRequest {
  confirmation: string; // User must type "DELETAR"
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Starting account deletion process");

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Rate limiting: 3 attempts per hour
    await checkRateLimit(user.id, "delete-own-account", 3, 60);

    // Parse request body
    const { confirmation }: DeleteAccountRequest = await req.json();

    // Verify confirmation text
    if (confirmation !== "DELETAR") {
      logStep("Invalid confirmation text", { received: confirmation });
      return new Response(
        JSON.stringify({ error: "Confirmação inválida. Digite 'DELETAR' para confirmar." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    logStep("Confirmation validated");

    // Check for active Stripe subscription and cancel if exists
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && user.email) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        
        // Find customer by email
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        
        if (customers.data.length > 0) {
          const customerId = customers.data[0].id;
          logStep("Found Stripe customer", { customerId });

          // Find active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
          });

          // Cancel all active subscriptions
          for (const subscription of subscriptions.data) {
            await stripe.subscriptions.cancel(subscription.id);
            logStep("Cancelled Stripe subscription", { subscriptionId: subscription.id });
          }
        }
      } catch (stripeError: any) {
        logStep("Error cancelling Stripe subscription", { error: stripeError.message });
        // Continue with deletion even if Stripe cancellation fails
      }
    }

    // Delete user account (this will cascade delete all related data via foreign keys)
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      logStep("Error deleting user", { error: deleteError.message });
      throw new Error("Erro ao deletar conta. Tente novamente.");
    }

    logStep("User account deleted successfully", { userId: user.id });

    // Log deletion for LGPD compliance audit (with masked PII)
    const { maskId, maskEmail } = await import("../_shared/logger.ts");
    console.log(`[LGPD AUDIT] User account deleted: ${maskId(user.id)} (${maskEmail(user.email || 'unknown')}) at ${new Date().toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conta deletada com sucesso. Todos os seus dados foram removidos conforme LGPD."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    const errorMessage = error.message || "Erro desconhecido ao deletar conta";
    logStep("ERROR", { message: errorMessage });

    // Handle rate limit error specifically
    if (error.message === "RATE_LIMIT_EXCEEDED") {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde 1 hora." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
