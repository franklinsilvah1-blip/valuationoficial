import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Mapeamento dos product IDs para planos
const PRODUCT_TO_PLAN: Record<string, string> = {
  prod_TMWTUVuAcCM1Qg: "START",
  prod_TMWWN3NKrAoZYe: "PRO",
  prod_TdJ7Clh2GRzchP: "SPECIALIST",
  prod_TnV2XDNVvq4DPq: "TESTE", // Plano de teste antigo R$ 2/dia
  prod_TpKS0xmSbMgIq6: "TESTE", // Plano de teste novo R$ 2/semana
};

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
        const plan = PRODUCT_TO_PLAN[productId] || "FREE";
        
        // Validate timestamps before converting to ISO string
        const periodEnd = subscription.current_period_end;
        const periodStart = subscription.current_period_start;
        
        let subscriptionEnd: string;
        let subscriptionStart: string;
        
        if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_end, using fallback +90 days (quarterly)", { periodEnd });
          subscriptionEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        if (periodStart && typeof periodStart === 'number' && periodStart > 0) {
          subscriptionStart = new Date(periodStart * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_start, using current date", { periodStart });
          subscriptionStart = new Date().toISOString();
        }

        logStep("Subscription details retrieved", { plan, subscriptionId, productId, subscriptionEnd, subscriptionStart });

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

        const wasFreeBefore = profiles.plan === "FREE";

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
        if (wasFreeBefore && plan !== "FREE") {
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
        const plan = PRODUCT_TO_PLAN[productId] || "FREE";
        const status = subscription.status;
        
        // Validate timestamps before converting
        const periodEnd = subscription.current_period_end;
        const periodStart = subscription.current_period_start;
        
        let subscriptionEnd: string;
        let subscriptionStart: string;
        
        if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_end in subscription.updated, using +90 days", { periodEnd });
          subscriptionEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        if (periodStart && typeof periodStart === 'number' && periodStart > 0) {
          subscriptionStart = new Date(periodStart * 1000).toISOString();
        } else {
          subscriptionStart = new Date().toISOString();
        }

        logStep("Subscription updated", { email: customerEmail, plan, status, subscriptionEnd });

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
          // Set to FREE if subscription is canceled or expired
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({
              plan: "FREE",
              plan_start_at: null,
              plan_end_at: null,
            })
            .eq("id", profiles.id);

          if (updateError) {
            logStep("ERROR: Failed to update profile to FREE", { error: updateError });
            throw updateError;
          }

          logStep("Profile updated to FREE (subscription canceled/expired)");

          // Notify user about cancellation
          await notifyUserSubscriptionChange({
            userEmail: customerEmail,
            userName: profiles.name || undefined,
            notificationType: 'canceled',
            oldPlan,
            newPlan: 'FREE',
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
        const productId = subscription.items.data[0].price.product as string;
        const deletedPlan = PRODUCT_TO_PLAN[productId] || oldPlan;

        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            plan: "FREE",
            plan_start_at: null,
            plan_end_at: null,
          })
          .eq("id", profiles.id);

        if (updateError) {
          logStep("ERROR: Failed to update profile to FREE", { error: updateError });
          throw updateError;
        }

        logStep("Profile updated to FREE (subscription deleted)");

        // Notify user about subscription deletion
        await notifyUserSubscriptionChange({
          userEmail: customerEmail,
          userName: profiles.name || undefined,
          notificationType: 'canceled',
          oldPlan: deletedPlan,
          newPlan: 'FREE',
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
        const productId = subscription.items.data[0].price.product as string;
        const plan = PRODUCT_TO_PLAN[productId] || "FREE";
        
        // Validate timestamps before converting
        const periodEnd = subscription.current_period_end;
        const periodStart = subscription.current_period_start;
        
        let subscriptionEnd: string;
        let subscriptionStart: string;
        
        if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else {
          logStep("WARNING: Invalid period_end in invoice.payment_succeeded, using +90 days", { periodEnd });
          subscriptionEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        if (periodStart && typeof periodStart === 'number' && periodStart > 0) {
          subscriptionStart = new Date(periodStart * 1000).toISOString();
        } else {
          subscriptionStart = new Date().toISOString();
        }

        // Find and update user
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id")
          .eq("email", customerEmail)
          .maybeSingle();

        if (!profiles) {
          logStep("ERROR: No profile found for email", { email: customerEmail });
          break;
        }

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
        
        // Get subscription and plan details
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const productId = subscription.items.data[0].price.product as string;
        const plan = PRODUCT_TO_PLAN[productId] || "UNKNOWN";
        
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
