import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";
import { resolvePlanFromStripe } from "../_shared/planResolution.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-REPORTS] ${step}${detailsStr}`);
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
    if (!user?.id) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Unauthorized: Admin access required");

    // Rate limit: 10 requests per hour for reports
    await checkRateLimit(user.id, "stripe-reports", 10, 60);
    logStep("Rate limit check passed");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get subscriptions from Stripe (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    logStep("Fetching Stripe subscriptions");
    const subscriptions = await stripe.subscriptions.list({
      status: "all",
      created: {
        gte: Math.floor(twelveMonthsAgo.getTime() / 1000),
      },
      limit: 100,
    });

    logStep("Fetching payment intents");
    const paymentIntents = await stripe.paymentIntents.list({
      created: {
        gte: Math.floor(twelveMonthsAgo.getTime() / 1000),
      },
      limit: 100,
    });

    // Fetch invoices to get actual paid amounts
    logStep("Fetching invoices");
    const invoices = await stripe.invoices.list({
      created: {
        gte: Math.floor(twelveMonthsAgo.getTime() / 1000),
      },
      limit: 100,
      status: 'paid',
    });

    // Process monthly revenue data
    const monthlyData: Record<string, { revenue: number; customers: Set<string>; start: number; pro: number; specialist: number }> = {};
    
    // Process daily revenue data (for charts)
    const dailyData: Record<string, { revenue: number; date: string }> = {};

    // Process PAID invoices (actual revenue received - single source of truth)
    invoices.data.forEach((invoice: any) => {
      const date = new Date(invoice.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      // Monthly data
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, customers: new Set(), start: 0, pro: 0, specialist: 0 };
      }

      // Daily data
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = { revenue: 0, date: dayKey };
      }

      // Resolve plan via a única fonte central (novo price ID ou product ID
      // legado, com grandfathering já aplicado — nunca dicionário próprio).
      const priceId = invoice.lines.data[0]?.price?.id as string | undefined;
      const productId = invoice.lines.data[0]?.price?.product as string | undefined;
      const plan = resolvePlanFromStripe({ priceId, productId }) || "START";

      // Add actual paid amount (convert from cents to reais)
      const amount = invoice.amount_paid || 0;
      monthlyData[monthKey].revenue += amount / 100;
      monthlyData[monthKey].customers.add(invoice.customer as string);
      dailyData[dayKey].revenue += amount / 100;

      // Count by plan
      if (plan === "START") monthlyData[monthKey].start++;
      if (plan === "PRO") monthlyData[monthKey].pro++;
      if (plan === "SPECIALIST") monthlyData[monthKey].specialist++;
    });

    // Convert monthly data to array and sort
    const chartData = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        customers: data.customers.size,
        start: data.start,
        pro: data.pro,
        specialist: data.specialist,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Convert daily data to array and sort
    const dailyChartData = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate current month stats
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthData = monthlyData[currentMonthKey] || { revenue: 0, customers: new Set(), start: 0, pro: 0, specialist: 0 };

    // Get active subscriptions count
    const activeSubscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
    });

    // "start" aqui é mantido só por compatibilidade de forma do payload
    // (campo já consumido pelo frontend) — hoje sempre fica 0, porque
    // nenhuma assinatura Stripe ativa resolve para o plano START (START é
    // gratuito, sem checkout). Assinaturas Stripe legadas do antigo START
    // (grandfathered) resolvem para "PRO" via resolvePlanFromStripe.
    const planCounts = {
      start: 0,
      pro: 0,
      specialist: 0,
      free: 0,
      wealth: 0,
    };

    activeSubscriptions.data.forEach((sub: any) => {
      const priceId = sub.items.data[0]?.price?.id as string | undefined;
      const productId = sub.items.data[0]?.price?.product as string | undefined;
      const plan = resolvePlanFromStripe({ priceId, productId });

      if (plan === "START") planCounts.start++;
      else if (plan === "PRO") planCounts.pro++;
      else if (plan === "SPECIALIST") planCounts.specialist++;
      // WEALTH nunca tem assinatura Stripe recorrente (sem checkout) — por
      // isso não é contado aqui a partir de dados do Stripe.
    });

    // Usuários sem assinatura Stripe paga (nível gratuito de entrada). Conta
    // tanto o valor legado "FREE" quanto o atual "START" — são o mesmo nível.
    const { count: freeCount } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("plan", ["FREE", "START"]);

    planCounts.free = freeCount || 0;

    // WEALTH é concedido manualmente pelo admin (sem checkout) — contado a
    // partir do banco, não do Stripe.
    const { count: wealthCount } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("plan", "WEALTH");

    planCounts.wealth = wealthCount || 0;

    // Get audit log data for upgrades/downgrades/cancellations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: auditLogs } = await supabaseClient
      .from("admin_audit_log")
      .select("*")
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Calculate plan change metrics
    let upgrades = 0;
    let downgrades = 0;
    let cancellations = 0;

    // FREE (legado) e START ficam no mesmo nível — START é o nível gratuito atual.
    const planHierarchy: Record<string, number> = {
      FREE: 0,
      START: 0,
      PRO: 1,
      SPECIALIST: 2,
      WEALTH: 3,
    };

    auditLogs?.forEach((log: any) => {
      if (log.old_plan && log.new_plan) {
        const oldLevel = planHierarchy[log.old_plan] ?? 0;
        const newLevel = planHierarchy[log.new_plan] ?? 0;

        if (newLevel > oldLevel) {
          upgrades++;
        } else if (newLevel < oldLevel) {
          if (log.new_plan === "FREE" || log.new_plan === "START") {
            cancellations++;
          } else {
            downgrades++;
          }
        }
      }
    });

    // Get canceled subscriptions from Stripe (last 30 days)
    const canceledSubs = await stripe.subscriptions.list({
      status: "canceled",
      created: {
        gte: Math.floor(thirtyDaysAgo.getTime() / 1000),
      },
      limit: 100,
    });

    cancellations += canceledSubs.data.length;

    // Calculate churn rate
    const totalActiveCount = activeSubscriptions.data.length;
    const churnRate = totalActiveCount > 0 
      ? ((cancellations / (totalActiveCount + cancellations)) * 100).toFixed(2)
      : "0.00";

    // Calculate MRR (Monthly Recurring Revenue)
    let mrr = 0;
    activeSubscriptions.data.forEach((sub: any) => {
      const amount = sub.items.data[0]?.price?.unit_amount || 0;
      const interval = sub.items.data[0]?.price?.recurring?.interval || "month";
      
      // Normalize to monthly amount
      if (interval === "year") {
        mrr += (amount / 100) / 12; // Annual plans divided by 12
      } else {
        mrr += amount / 100; // Monthly plans as is
      }
    });

    logStep("Reports generated successfully", {
      monthlyDataPoints: chartData.length,
      dailyDataPoints: dailyChartData.length,
      currentMonthRevenue: currentMonthData.revenue,
      activeSubscriptions: activeSubscriptions.data.length,
      upgrades,
      downgrades,
      cancellations,
      mrr,
    });

    return new Response(JSON.stringify({
      monthlyData: chartData,
      dailyData: dailyChartData,
      currentMonth: {
        revenue: currentMonthData.revenue,
        customers: currentMonthData.customers.size,
      },
      planCounts,
      totalActiveSubscriptions: activeSubscriptions.data.length,
      metrics: {
        upgrades,
        downgrades,
        cancellations,
        churnRate: parseFloat(churnRate),
        mrr,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-reports", { message: errorMessage });
    
    const userMessage = error instanceof Error ? mapErrorToUserMessage(error) : "An error occurred";
    const status = errorMessage.includes("RATE_LIMIT_EXCEEDED") ? 429 : 
                   errorMessage.includes("Unauthorized") ? 403 : 500;
    
    return new Response(JSON.stringify({ error: userMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
