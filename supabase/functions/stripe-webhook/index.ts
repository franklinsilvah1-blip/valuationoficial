import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolvePlanFromStripe, estimatePeriodEndFallback } from "../_shared/planResolution.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

/**
 * Resolve o plano a partir de uma subscription do Stripe (price ID novo ou
 * product ID legado — ver supabase/functions/_shared/planResolution.ts).
 * Se não conseguir resolver, retorna `fallbackPlan` em vez de rebaixar
 * silenciosamente o usuário — eventos do Stripe não reconhecidos (ex.:
 * atrasados, de um price ainda não configurado) nunca devem piorar o plano
 * de um usuário existente.
 */
function resolveSubscriptionPlan(subscription: Stripe.Subscription, fallbackPlan: string): string {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const productId = item?.price?.product as string | undefined;
  const resolved = resolvePlanFromStripe({ priceId, productId });
  if (!resolved) {
    logStep("WARNING: Could not resolve plan from Stripe price/product, keeping fallback", {
      priceId,
      productId,
      fallbackPlan,
    });
    return fallbackPlan;
  }
  return resolved;
}

// Helper function to send admin notifications
async function notifyAdmin(notificationData: any) {
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-admin-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(notificationData),
    });

    if (response.ok) {
      logStep("Admin notified successfully");
    } else {
      const errorText = await response.text();
      logStep("WARNING: Failed to notify admin", { status: response.status, error: errorText });
    }
  } catch (notifyError) {
    const notifyErrorMsg = notifyError instanceof Error ? notifyError.message : String(notifyError);
    logStep("WARNING: Exception notifying admin", { error: notifyErrorMsg });
  }
}

// Helper function to send subscription notifications to users
async function notifyUserSubscriptionChange(data: {
  userEmail: string;
  userName?: string;
  notificationType: 'canceled' | 'updated' | 'downgraded' | 'upgraded';
  oldPlan?: string;
  newPlan?: string;
}) {
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-subscription-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      logStep("User notified about subscription change successfully");
    } else {
      const errorText = await response.text();
      logStep("WARNING: Failed to notify user about subscription change", { status: response.status, error: errorText });
    }
  } catch (notifyError) {
    const notifyErrorMsg = notifyError instanceof Error ? notifyError.message : String(notifyError);
    logStep("WARNING: Exception notifying user about subscription change", { error: notifyErrorMsg });
  }
}

// Helper function to send affiliate email notifications
async function sendAffiliateEmail(data: {
  affiliateId?: string;
  userId?: string;
  emailType: 'welcome' | 'new_commission' | 'commission_paid';
  commissionAmount?: number;
}) {
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-affiliate-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      logStep("Affiliate email sent successfully", { emailType: data.emailType });
    } else {
      const errorText = await response.text();
      logStep("WARNING: Failed to send affiliate email", { 
        emailType: data.emailType, 
        status: response.status, 
        error: errorText 
      });
    }
  } catch (emailError) {
    const emailErrorMsg = emailError instanceof Error ? emailError.message : String(emailError);
    logStep("WARNING: Exception sending affiliate email (non-blocking)", { 
      emailType: data.emailType, 
      error: emailErrorMsg 
    });
  }
}

// Helper function to process affiliate commission
async function processAffiliateCommission(
  supabaseClient: any,
  affiliateCode: string,
  userId: string,
  amountPaid: number,
  stripePaymentId: string
) {
  try {
    logStep("Processing affiliate commission", { affiliateCode, userId, amountPaid });

    // Find affiliate by code
    const { data: affiliate, error: affiliateError } = await supabaseClient
      .from("affiliates")
      .select("id, commission_rate, status, user_id")
      .eq("affiliate_code", affiliateCode.toUpperCase())
      .maybeSingle();

    if (affiliateError) {
      logStep("ERROR: Failed to find affiliate", { error: affiliateError });
      return;
    }

    if (!affiliate) {
      logStep("WARNING: Affiliate code not found", { affiliateCode });
      return;
    }

    if (affiliate.status !== "active") {
      logStep("WARNING: Affiliate is not active", { status: affiliate.status });
      return;
    }

    // Prevent self-referral
    if (affiliate.user_id === userId) {
      logStep("WARNING: Self-referral detected, skipping commission", { userId });
      return;
    }

    // Idempotência: Stripe pode reentregar o mesmo webhook mais de uma vez
    // (entrega "at least once" — documentado pela própria Stripe). Sem esta
    // checagem, um evento duplicado criaria uma segunda linha em
    // `commissions` para o mesmo pagamento, duplicando o valor creditado ao
    // afiliado e disparando um segundo e-mail de comissão. `stripe_payment_id`
    // não tem constraint UNIQUE no banco, então a proteção precisa ser feita
    // aqui antes do INSERT.
    const { data: existingCommission } = await supabaseClient
      .from("commissions")
      .select("id")
      .eq("stripe_payment_id", stripePaymentId)
      .maybeSingle();

    if (existingCommission) {
      logStep("WARNING: Commission for this stripe_payment_id already exists, skipping duplicate", { stripePaymentId });
      return;
    }

    // Find or create referral record
    const { data: existingReferral } = await supabaseClient
      .from("referrals")
      .select("id")
      .eq("affiliate_id", affiliate.id)
      .eq("referred_user_id", userId)
      .maybeSingle();

    let referralId = existingReferral?.id;

    if (!referralId) {
      // Create referral record if it doesn't exist
      const { data: newReferral, error: referralError } = await supabaseClient
        .from("referrals")
        .insert({
          affiliate_id: affiliate.id,
          referred_user_id: userId,
          status: "converted",
          converted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (referralError) {
        logStep("WARNING: Failed to create referral record", { error: referralError });
      } else {
        referralId = newReferral.id;
        logStep("Referral record created", { referralId });
      }
    } else {
      // Update existing referral to converted status
      await supabaseClient
        .from("referrals")
        .update({
          status: "converted",
          converted_at: new Date().toISOString(),
        })
        .eq("id", referralId);
      
      logStep("Referral record updated to converted", { referralId });
    }

    // Calculate commission
    const commissionAmount = (amountPaid * affiliate.commission_rate) / 100;
    
    logStep("Calculated commission", { 
      amountPaid, 
      commissionRate: affiliate.commission_rate, 
      commissionAmount 
    });

    // Insert commission record
    const { error: commissionError } = await supabaseClient
      .from("commissions")
      .insert({
        affiliate_id: affiliate.id,
        referral_id: referralId,
        amount: commissionAmount,
        status: "pending",
        stripe_payment_id: stripePaymentId,
      });

    if (commissionError) {
      // 23505 = unique_violation no índice parcial
      // commissions_stripe_payment_id_unique (migration
      // 20260415120000_plan_model_v2.sql). Segunda camada de defesa contra
      // reentrega concorrente do mesmo webhook: o SELECT acima (linha ~171)
      // já cobre o caso sequencial, mas dois webhooks quase simultâneos
      // podem ambos passar pelo SELECT antes de qualquer um commitar o
      // INSERT — só o índice único do banco resolve essa corrida de fato.
      // Tratado como "já processado" (informativo, não erro): não lança,
      // não reenvia e-mail, não altera saldo/comissão já gravados pela
      // outra execução concorrente.
      if (commissionError.code === "23505") {
        logStep("INFO: Duplicate commission insert blocked by unique index (concurrent webhook delivery) — already processed", { stripePaymentId });
        return;
      }
      logStep("ERROR: Failed to create commission record", { error: commissionError });
      return;
    }

    // Update affiliate totals and last_revenue_at for activity tracking
    await supabaseClient
      .from("affiliates")
      .update({
        total_referrals: affiliate.total_referrals ? affiliate.total_referrals + 1 : 1,
        total_earnings: (affiliate.total_earnings || 0) + commissionAmount,
        last_revenue_at: new Date().toISOString(),
        last_inactivity_notification: null, // Reset inactivity notifications on new revenue
      })
      .eq("id", affiliate.id);

    logStep("Affiliate commission processed successfully", { 
      affiliateId: affiliate.id, 
      commissionAmount 
    });

    // Send new commission email notification to affiliate (non-blocking)
    await sendAffiliateEmail({
      affiliateId: affiliate.id,
      emailType: 'new_commission',
      commissionAmount: commissionAmount,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Exception processing affiliate commission", { error: errorMsg });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  logStep("Webhook received");

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      return new Response(JSON.stringify({ error: "Stripe key not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    
    logStep("Verifying webhook signature");
    
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified", { type: event.type, id: event.id });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Webhook signature verification failed", { error: errorMsg });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${errorMsg}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Process different event types
    switch (event.type) {
      case "checkout.session.completed": {
        logStep("Processing checkout.session.completed");
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode !== "subscription") {
          logStep("Skipping non-subscription checkout");
          break;
        }

        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerId = session.customer as string;
        
        if (!customerEmail) {
          logStep("ERROR: No customer email found in session");
          break;
        }

        logStep("Checkout session completed", { email: customerEmail, customerId });

        // Get subscription details
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const productId = subscription.items.data[0].price.product as string;

        // Validate timestamps before converting to ISO string
        const periodEnd = subscription.current_period_end;
        const periodStart = subscription.current_period_start;
        
        let subscriptionEnd: string;
        let subscriptionStart: string;
        
        if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_end, deriving fallback from price.recurring", { periodEnd });
          subscriptionEnd = estimatePeriodEndFallback(subscription.items.data[0]);
        }
        
        if (periodStart && typeof periodStart === 'number' && periodStart > 0) {
          subscriptionStart = new Date(periodStart * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_start, using current date", { periodStart });
          subscriptionStart = new Date().toISOString();
        }

        logStep("Subscription details retrieved", { subscriptionId, productId, subscriptionEnd, subscriptionStart });

        // Find user by email
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id, plan")
          .eq("email", customerEmail)
          .maybeSingle();

        if (!profiles) {
          logStep("ERROR: No profile found for email", { email: customerEmail });
          break;
        }

        // Nunca rebaixa: se o price/product não for reconhecido, mantém o
        // plano atual do usuário em vez de cair para um plano pior.
        const plan = resolveSubscriptionPlan(subscription, profiles.plan);
        const wasFreeBefore = profiles.plan === "FREE" || profiles.plan === "START";

        // Update profile
        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            plan,
            plan_start_at: subscriptionStart,
            plan_end_at: subscriptionEnd,
            stripe_customer_id: customerId,
          })
          .eq("id", profiles.id);

        if (updateError) {
          logStep("ERROR: Failed to update profile", { error: updateError });
          throw updateError;
        }

        logStep("Profile updated successfully", { userId: profiles.id, plan });

        // Send welcome email for new paid subscriptions
        if (wasFreeBefore && plan !== "FREE" && plan !== "START") {
          logStep("Sending welcome email");
          
          try {
            const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ userId: profiles.id, plan }),
            });

            if (emailResponse.ok) {
              logStep("Welcome email sent successfully");
            } else {
              logStep("WARNING: Welcome email failed", { status: emailResponse.status });
            }
          } catch (emailError) {
            const emailErrorMsg = emailError instanceof Error ? emailError.message : String(emailError);
            logStep("ERROR: Exception sending welcome email", { error: emailErrorMsg });
          }
        }

        // Process affiliate commission if affiliateCode is present in metadata
        // Removed wasFreeBefore restriction - commissions apply to any checkout with affiliateCode (including upgrades)
        const affiliateCode = session.metadata?.affiliateCode;
        if (affiliateCode) {
          const amountPaid = session.amount_total ? session.amount_total / 100 : 0; // Convert from cents
          const stripePaymentId = session.payment_intent as string || session.id;
          
          logStep("Processing affiliate commission for checkout", { affiliateCode, amountPaid });
          
          await processAffiliateCommission(
            supabaseClient,
            affiliateCode,
            profiles.id,
            amountPaid,
            stripePaymentId
          );
        }

        break;
      }

      case "customer.subscription.updated": {
        logStep("Processing customer.subscription.updated");
        const subscription = event.data.object as Stripe.Subscription;
        
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if (!customer || customer.deleted) {
          logStep("ERROR: Customer not found or deleted");
          break;
        }

        const customerEmail = customer.email;
        if (!customerEmail) {
          logStep("ERROR: No email for customer");
          break;
        }

        const productId = subscription.items.data[0].price.product as string;
        const status = subscription.status;

        // Validate timestamps before converting
        const periodEnd = subscription.current_period_end;
        const periodStart = subscription.current_period_start;
        
        let subscriptionEnd: string;
        let subscriptionStart: string;
        
        if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_end in subscription.updated, deriving fallback from price.recurring", { periodEnd });
          subscriptionEnd = estimatePeriodEndFallback(subscription.items.data[0]);
        }
        
        if (periodStart && typeof periodStart === 'number' && periodStart > 0) {
          subscriptionStart = new Date(periodStart * 1000).toISOString();
        } else {
          subscriptionStart = new Date().toISOString();
        }

        // Find user
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id, plan, name")
          .eq("email", customerEmail)
          .maybeSingle();

        if (!profiles) {
          logStep("ERROR: No profile found for email", { email: customerEmail });
          break;
        }

        const oldPlan = profiles.plan;
        // Nunca rebaixa: price/product não reconhecido mantém o plano atual.
        const plan = resolveSubscriptionPlan(subscription, oldPlan);
        logStep("Subscription updated", { email: customerEmail, plan, status, subscriptionEnd });

        // Update profile based on subscription status
        if (status === "active") {
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({
              plan,
              plan_start_at: subscriptionStart,
              plan_end_at: subscriptionEnd,
              stripe_customer_id: customerId,
            })
            .eq("id", profiles.id);

          if (updateError) {
            logStep("ERROR: Failed to update profile", { error: updateError });
            throw updateError;
          }

          logStep("Profile updated to active subscription");

          // Notify user about plan change if plan actually changed
          if (oldPlan !== plan) {
            const isUpgrade = (oldPlan === "FREE" || oldPlan === "START") && (plan === "PRO" || plan === "SPECIALIST");
            const notificationType = isUpgrade ? 'upgraded' : 'downgraded';
            
            await notifyUserSubscriptionChange({
              userEmail: customerEmail,
              userName: profiles.name || undefined,
              notificationType,
              oldPlan,
              newPlan: plan,
            });
          }
        } else if (status === "canceled" || status === "incomplete_expired") {
          // Assinatura cancelada/expirada volta para START (nível gratuito de
          // entrada) — nunca para o valor legado "FREE".
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({
              plan: "START",
              plan_start_at: null,
              plan_end_at: null,
            })
            .eq("id", profiles.id);

          if (updateError) {
            logStep("ERROR: Failed to update profile to START", { error: updateError });
            throw updateError;
          }

          logStep("Profile updated to START (subscription canceled/expired)");

          // Notify user about cancellation
          await notifyUserSubscriptionChange({
            userEmail: customerEmail,
            userName: profiles.name || undefined,
            notificationType: 'canceled',
            oldPlan,
            newPlan: 'START',
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        logStep("Processing customer.subscription.deleted");
        const subscription = event.data.object as Stripe.Subscription;
        
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if (!customer || customer.deleted) {
          logStep("ERROR: Customer not found or deleted");
          break;
        }

        const customerEmail = customer.email;
        if (!customerEmail) {
          logStep("ERROR: No email for customer");
          break;
        }

        logStep("Subscription deleted", { email: customerEmail });

        // Find user and set to FREE
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id, plan, name")
          .eq("email", customerEmail)
          .maybeSingle();

        if (!profiles) {
          logStep("ERROR: No profile found for email", { email: customerEmail });
          break;
        }

        const oldPlan = profiles.plan;
        const deletedPlan = resolveSubscriptionPlan(subscription, oldPlan);

        // Assinatura cancelada/expirada volta para START (nível gratuito de
        // entrada), nunca para o valor legado "FREE" — START é o único
        // código gratuito válido para novos e ex-assinantes a partir desta
        // migração.
        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            plan: "START",
            plan_start_at: null,
            plan_end_at: null,
          })
          .eq("id", profiles.id);

        if (updateError) {
          logStep("ERROR: Failed to update profile to START", { error: updateError });
          throw updateError;
        }

        logStep("Profile updated to START (subscription deleted)");

        // Notify user about subscription deletion
        await notifyUserSubscriptionChange({
          userEmail: customerEmail,
          userName: profiles.name || undefined,
          notificationType: 'canceled',
          oldPlan: deletedPlan,
          newPlan: 'START',
        });

        break;
      }

      case "invoice.payment_succeeded": {
        logStep("Processing invoice.payment_succeeded");
        const invoice = event.data.object as Stripe.Invoice;
        
        // This handles recurring payments
        if (!invoice.subscription) {
          logStep("Skipping invoice without subscription");
          break;
        }

        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if (!customer || customer.deleted) {
          logStep("ERROR: Customer not found or deleted");
          break;
        }

        const customerEmail = customer.email;
        if (!customerEmail) {
          logStep("ERROR: No email for customer");
          break;
        }

        logStep("Recurring payment succeeded", { email: customerEmail });

        // Get subscription to update end date
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

        // Validate timestamps before converting
        const periodEnd = subscription.current_period_end;
        const periodStart = subscription.current_period_start;
        
        let subscriptionEnd: string;
        let subscriptionStart: string;
        
        if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_end in invoice.payment_succeeded, deriving fallback from price.recurring", { periodEnd });
          subscriptionEnd = estimatePeriodEndFallback(subscription.items.data[0]);
        }
        
        if (periodStart && typeof periodStart === 'number' && periodStart > 0) {
          subscriptionStart = new Date(periodStart * 1000).toISOString();
        } else {
          subscriptionStart = new Date().toISOString();
        }

        // Find and update user
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id, plan")
          .eq("email", customerEmail)
          .maybeSingle();

        if (!profiles) {
          logStep("ERROR: No profile found for email", { email: customerEmail });
          break;
        }

        // Nunca rebaixa: price/product não reconhecido mantém o plano atual.
        const plan = resolveSubscriptionPlan(subscription, profiles.plan);

        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            plan,
            plan_start_at: subscriptionStart,
            plan_end_at: subscriptionEnd,
            stripe_customer_id: customerId,
          })
          .eq("id", profiles.id);

        if (updateError) {
          logStep("ERROR: Failed to update profile", { error: updateError });
          throw updateError;
        }

        logStep("Profile updated after recurring payment");
        break;
      }

      case "invoice.payment_failed": {
        logStep("Processing invoice.payment_failed");
        const invoice = event.data.object as Stripe.Invoice;
        
        if (!invoice.subscription) {
          logStep("Skipping invoice without subscription");
          break;
        }

        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if (!customer || customer.deleted) {
          logStep("ERROR: Customer not found or deleted");
          break;
        }

        const customerEmail = customer.email;
        logStep("Payment failed", { email: customerEmail });
        
        // Get subscription and plan details (apenas informativo para o e-mail
        // de admin — não escreve em profiles.plan)
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const plan = resolveSubscriptionPlan(subscription, "UNKNOWN");
        
        // Send notification to admin about payment failure
        const failureMessage = invoice.last_finalization_error?.message || 
                               invoice.charge?.failure_message || 
                               "Pagamento recusado ou falhou";
        
        await notifyAdmin({
          type: 'payment_failure',
          customerEmail,
          customerName: (customer as any).name || undefined,
          plan,
          amount: invoice.amount_due,
          currency: invoice.currency,
          failureMessage,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          timestamp: new Date(invoice.created * 1000).toISOString(),
          attemptCount: invoice.attempt_count,
        });
        
        logStep("Admin notified about payment failure");
        
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true, type: event.type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[STRIPE-WEBHOOK] ===== ERROR =====");
    console.error("[STRIPE-WEBHOOK] Message:", errorMessage);
    console.error("[STRIPE-WEBHOOK] Stack:", errorStack);
    
    // Notify admin about webhook failure
    try {
      // Extract event data if available from request body
      let eventType = "unknown";
      let eventId = "unknown";
      let customerEmail: string | undefined;
      
      // Try to parse the original request to get event details
      try {
        const body = await req.clone().text();
        const parsedBody = JSON.parse(body);
        if (parsedBody.type) eventType = parsedBody.type;
        if (parsedBody.id) eventId = parsedBody.id;
        
        // Try to extract customer email from various event types
        if (parsedBody.data?.object) {
          const obj = parsedBody.data.object;
          customerEmail = obj.customer_email || 
                         obj.customer_details?.email || 
                         obj.email;
        }
      } catch (parseError) {
        logStep("WARNING: Could not parse request body for notification details");
      }
      
      await notifyAdmin({
        type: 'webhook_failure',
        eventType,
        errorMessage,
        errorStack,
        customerEmail,
        timestamp: new Date().toISOString(),
        eventId,
      });
      
      logStep("Admin notified about webhook failure");
    } catch (notifyError) {
      // Don't let notification failure affect webhook processing
      logStep("WARNING: Failed to send failure notification to admin");
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      stack: errorStack
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
