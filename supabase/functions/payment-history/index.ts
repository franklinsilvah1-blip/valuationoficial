import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";
import { resolvePlanFromStripe } from "../_shared/planResolution.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAYMENT-HISTORY] ${step}${detailsStr}`);
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Rate limit: 20 requests per hour
    await checkRateLimit(user.id, "payment-history", 20, 60);
    logStep("Rate limit check passed");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        payments: [],
        subscriptions: [] 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Fetch payment intents
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 100,
    });

    // Fetch invoices (for subscriptions)
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });

    // Fetch subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100,
    });

    logStep("Data fetched", {
      paymentIntents: paymentIntents.data.length,
      invoices: invoices.data.length,
      subscriptions: subscriptions.data.length,
    });

    // Process payment intents
    const payments = paymentIntents.data.map((payment: any) => {
      let created = null;
      try {
        if (payment.created && typeof payment.created === 'number') {
          created = new Date(payment.created * 1000).toISOString();
        }
      } catch (e) {
        console.warn(`Failed to parse created date for payment ${payment.id}:`, e);
        created = new Date().toISOString(); // Fallback to current date
      }
      
      return {
        id: payment.id,
        amount: payment.amount / 100, // Convert from cents to reais
        currency: payment.currency.toUpperCase(),
        status: payment.status,
        created: created || new Date().toISOString(),
        description: payment.description || "Pagamento único",
        payment_method: payment.payment_method_types?.[0] || "unknown",
      };
    });

    // Process invoices (subscription payments)
    const invoicePayments = invoices.data.map((invoice: any) => {
      const priceId = invoice.lines.data[0]?.price?.id as string | undefined;
      const productId = invoice.lines.data[0]?.price?.product as string | undefined;
      const plan = resolvePlanFromStripe({ priceId, productId }) || "Unknown";
      
      // Safely parse all dates
      let created = null;
      let periodStart = null;
      let periodEnd = null;
      
      try {
        if (invoice.created && typeof invoice.created === 'number') {
          created = new Date(invoice.created * 1000).toISOString();
        }
      } catch (e) {
        console.warn(`Failed to parse created date for invoice ${invoice.id}:`, e);
        created = new Date().toISOString(); // Fallback to current date
      }
      
      try {
        if (invoice.period_start && typeof invoice.period_start === 'number') {
          periodStart = new Date(invoice.period_start * 1000).toISOString();
        }
      } catch (e) {
        console.warn(`Failed to parse period_start for invoice ${invoice.id}:`, e);
      }
      
      try {
        if (invoice.period_end && typeof invoice.period_end === 'number') {
          periodEnd = new Date(invoice.period_end * 1000).toISOString();
        }
      } catch (e) {
        console.warn(`Failed to parse period_end for invoice ${invoice.id}:`, e);
      }
      
      return {
        id: invoice.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status === "paid" ? "succeeded" : invoice.status || "pending",
        created: created || new Date().toISOString(),
        description: `Assinatura ${plan}`,
        payment_method: invoice.payment_settings?.payment_method_types?.[0] || "card",
        invoice_pdf: invoice.invoice_pdf,
        period_start: periodStart,
        period_end: periodEnd,
      };
    });

    // Combine and sort all payments by date (most recent first)
    const allPayments = [...payments, ...invoicePayments].sort((a, b) => {
      try {
        const dateA = a.created ? new Date(a.created).getTime() : 0;
        const dateB = b.created ? new Date(b.created).getTime() : 0;
        return dateB - dateA;
      } catch (e) {
        console.warn('Error sorting payments by date:', e);
        return 0;
      }
    });

    // Helper function for safe date conversion
    const safeConvertDate = (timestamp: number | null | undefined, fieldName: string, subscriptionId: string): string | null => {
      if (!timestamp || typeof timestamp !== 'number') {
        return null;
      }
      
      try {
        const date = new Date(timestamp * 1000);
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date for ${fieldName} in subscription ${subscriptionId}`);
          return null;
        }
        return date.toISOString();
      } catch (e) {
        console.warn(`Failed to parse ${fieldName} for subscription ${subscriptionId}:`, e);
        return null;
      }
    };

    // Process subscriptions
    const subscriptionData = subscriptions.data.map((sub: any) => {
      const priceId = sub.items.data[0]?.price?.id as string | undefined;
      const productId = sub.items.data[0]?.price?.product as string | undefined;
      const plan = resolvePlanFromStripe({ priceId, productId }) || "Unknown";
      
      return {
        id: sub.id,
        plan,
        status: sub.status,
        current_period_start: safeConvertDate(sub.current_period_start, 'current_period_start', sub.id) || new Date().toISOString(),
        current_period_end: safeConvertDate(sub.current_period_end, 'current_period_end', sub.id) || new Date().toISOString(),
        cancel_at: safeConvertDate(sub.cancel_at, 'cancel_at', sub.id),
        canceled_at: safeConvertDate(sub.canceled_at, 'canceled_at', sub.id),
        amount: sub.items.data[0]?.price?.unit_amount ? sub.items.data[0].price.unit_amount / 100 : 0,
        interval: sub.items.data[0]?.price?.recurring?.interval || "month",
      };
    });

    logStep("Subscriptions processed", {
      count: subscriptionData.length,
      ids: subscriptionData.map((s: any) => s.id)
    });

    logStep("Payment history retrieved successfully", {
      totalPayments: allPayments.length,
      totalSubscriptions: subscriptionData.length,
    });

    return new Response(JSON.stringify({
      payments: allPayments,
      subscriptions: subscriptionData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in payment-history", { message: errorMessage });
    
    const userMessage = error instanceof Error ? mapErrorToUserMessage(error) : "An error occurred";
    const status = errorMessage.includes("RATE_LIMIT_EXCEEDED") ? 429 : 500;
    
    return new Response(JSON.stringify({ error: userMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
