import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";
import { secureLog, maskId } from "../_shared/logger.ts";

const LOGO_URL = "https://valuationit.com.br/logo.webp";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface AffiliateActivity {
  id: string;
  user_id: string;
  affiliate_code: string;
  status: string;
  last_revenue_at: string | null;
  last_inactivity_notification: string | null;
  created_at: string;
}

interface ProcessingStats {
  total: number;
  notified_60_days: number;
  notified_75_days: number;
  suspended_90_days: number;
  skipped: number;
  errors: Array<{ affiliateId: string; error: string }>;
}

type NotificationType = "60_days" | "75_days" | "90_days_deactivated";

function getDaysSinceLastActivity(affiliate: AffiliateActivity): number {
  // Use last_revenue_at if exists, otherwise use created_at
  const referenceDate = affiliate.last_revenue_at 
    ? new Date(affiliate.last_revenue_at) 
    : new Date(affiliate.created_at);
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - referenceDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

function generateInactivityEmail(
  name: string, 
  affiliateCode: string, 
  type: NotificationType,
  daysInactive: number
): { subject: string; html: string } {
  const panelUrl = "https://valuationit.com.br/app/afiliado";
  const supportEmail = "afiliados@valuationit.com.br";

  let subject: string;
  let headerIcon: string;
  let mainMessage: string;
  let ctaText: string;
  let ctaUrl: string;
  let footerMessage: string;

  switch (type) {
    case "60_days":
      subject = "💭 Sentimos sua falta! Como podemos te ajudar?";
      headerIcon = "💭";
      mainMessage = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.7;">
          Percebemos que faz <strong>${daysInactive} dias</strong> desde sua última comissão como afiliado.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.7;">
          Queremos te ajudar a voltar a vender! Que tal revisitar suas estratégias de divulgação?
        </p>
        <div style="background: #f0f9ff; border-left: 4px solid #D4A506; padding: 15px 20px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #1a1a1a; font-size: 14px;">
            💡 <strong>Dica:</strong> Compartilhe seu link nas redes sociais, grupos de investimento ou com amigos que se interessam pelo mercado financeiro!
          </p>
        </div>
      `;
      ctaText = "Acessar Meu Painel";
      ctaUrl = panelUrl;
      footerMessage = "Estamos aqui para te ajudar a ter sucesso!";
      break;

    case "75_days":
      subject = "⚠️ Alerta: Sua conta de afiliado será pausada em 15 dias";
      headerIcon = "⚠️";
      mainMessage = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.7;">
          Sua conta de afiliado está inativa há <strong>${daysInactive} dias</strong>.
        </p>
        <div style="background: #fef3c7; border: 1px solid #D4A506; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #92400e; font-size: 18px; font-weight: 600;">
            ⏰ Você tem 15 dias para gerar uma nova comissão
          </p>
          <p style="margin: 10px 0 0 0; color: #b45309; font-size: 14px;">
            Caso contrário, sua conta será automaticamente pausada por inatividade.
          </p>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 16px; color: #374151; line-height: 1.7;">
          Não deixe isso acontecer! Volte a divulgar seu link e continue ganhando comissões.
        </p>
      `;
      ctaText = "Reativar Minha Conta";
      ctaUrl = panelUrl;
      footerMessage = "Ainda dá tempo de reverter essa situação!";
      break;

    case "90_days_deactivated":
      subject = "😔 Sua conta de afiliado foi suspensa";
      headerIcon = "😔";
      mainMessage = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.7;">
          Devido à inatividade de mais de <strong>90 dias</strong>, sua conta de afiliado foi suspensa automaticamente.
        </p>
        <div style="background: #f3f4f6; border: 1px solid #d1d5db; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; color: #374151; font-size: 16px; font-weight: 600;">
            O que isso significa?
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
            <li>Seu link de afiliado está temporariamente desativado</li>
            <li>Novas indicações não serão contabilizadas</li>
            <li>Suas comissões pendentes permanecerão disponíveis por 12 meses</li>
          </ul>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 16px; color: #374151; line-height: 1.7;">
          <strong>Quer voltar a ser um parceiro?</strong> Entre em contato com nosso suporte para reativar sua conta.
        </p>
      `;
      ctaText = "Falar com Suporte";
      ctaUrl = `mailto:${supportEmail}?subject=Reativar%20conta%20de%20afiliado&body=Olá,%20gostaria%20de%20reativar%20minha%20conta%20de%20afiliado.%20Meu%20código%20é:%20${affiliateCode}`;
      footerMessage = "Esperamos te ver de volta em breve!";
      break;
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
              <div style="font-size: 48px; margin-bottom: 15px;">${headerIcon}</div>
              <h1 style="color: #1a1a1a; margin: 0; font-size: 24px; font-weight: 700;">
                ${type === "60_days" ? "Sentimos sua falta!" : type === "75_days" ? "Atenção Necessária" : "Conta Suspensa"}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Olá, <strong style="color: #D4A506;">${name || 'Afiliado'}</strong>!
              </p>
              
              ${mainMessage}

              <!-- Affiliate Code -->
              <div style="text-align: center; margin: 25px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Seu código de afiliado:</p>
                <code style="display: inline-block; background: #f3f4f6; padding: 8px 20px; border-radius: 6px; font-size: 16px; font-weight: 600; color: #374151; letter-spacing: 1px;">
                  ${affiliateCode}
                </code>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align: center;">
              <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                ${ctaText}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 25px 30px; text-align: center;">
              <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #cccccc;">
                ${footerMessage}
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © ${new Date().getFullYear()} <strong style="color: #D4A506;">VALUATION Invest Tech</strong>. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return { subject, html };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stats: ProcessingStats = {
    total: 0,
    notified_60_days: 0,
    notified_75_days: 0,
    suspended_90_days: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Verify CRON_SECRET
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret || cronSecret !== expectedSecret) {
      console.error("Unauthorized: Invalid or missing CRON_SECRET");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== CHECK AFFILIATE ACTIVITY STARTED ===");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get sender config
    const senderConfig = await getSenderConfig(supabase);

    // Fetch all active affiliates
    const { data: affiliates, error: affiliatesError } = await supabase
      .from("affiliates")
      .select("id, user_id, affiliate_code, status, last_revenue_at, last_inactivity_notification, created_at")
      .eq("status", "active");

    if (affiliatesError) {
      console.error("Error fetching affiliates:", affiliatesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch affiliates", stats }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!affiliates || affiliates.length === 0) {
      console.log("No active affiliates to process");
      return new Response(
        JSON.stringify({ message: "No active affiliates to process", stats }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    stats.total = affiliates.length;
    console.log(`Found ${stats.total} active affiliates to check`);

    // Process each affiliate
    for (const affiliate of affiliates as AffiliateActivity[]) {
      try {
        const daysInactive = getDaysSinceLastActivity(affiliate);
        const lastNotification = affiliate.last_inactivity_notification;

        secureLog.info("Checking affiliate activity", { 
          affiliateId: affiliate.id, 
          daysInactive,
          lastNotification 
        });

        let notificationType: NotificationType | null = null;

        // Determine which notification to send based on inactivity days (60/75/90 days policy)
        if (daysInactive >= 90) {
          // 90+ days: Suspend and notify
          if (lastNotification !== "90_days_deactivated") {
            notificationType = "90_days_deactivated";
          }
        } else if (daysInactive >= 75) {
          // 75-89 days: Warning notification (15 days before suspension)
          if (lastNotification !== "75_days" && lastNotification !== "90_days_deactivated") {
            notificationType = "75_days";
          }
        } else if (daysInactive >= 60) {
          // 60-74 days: First alert notification
          if (!lastNotification) {
            notificationType = "60_days";
          }
        }

        if (!notificationType) {
          stats.skipped++;
          continue;
        }

        // Fetch affiliate's profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", affiliate.user_id)
          .maybeSingle();

        if (profileError || !profile?.email) {
          console.warn(`Skipping affiliate ${maskId(affiliate.id)}: No email found`);
          stats.skipped++;
          continue;
        }

        // Generate email
        const { subject, html } = generateInactivityEmail(
          profile.name || "Afiliado",
          affiliate.affiliate_code,
          notificationType,
          daysInactive
        );

        // Send email via Resend API
        const emailResult = await sendEmail({
          to: profile.email,
          subject,
          html,
          from: senderConfig ? {
            name: senderConfig.name,
            email: senderConfig.email,
          } : undefined,
        });

        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to send email");
        }

        // Update affiliate record
        const updateData: Record<string, any> = {
          last_inactivity_notification: notificationType,
        };

        // If 90 days, also suspend the affiliate
        if (notificationType === "90_days_deactivated") {
          updateData.status = "inactive";
        }

        await supabase
          .from("affiliates")
          .update(updateData)
          .eq("id", affiliate.id);

        // Update stats
        switch (notificationType) {
          case "60_days":
            stats.notified_60_days++;
            break;
          case "75_days":
            stats.notified_75_days++;
            break;
          case "90_days_deactivated":
            stats.suspended_90_days++;
            break;
        }

        secureLog.info("Notification sent", { 
          affiliateId: affiliate.id, 
          type: notificationType,
          email: profile.email 
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        stats.errors.push({ affiliateId: affiliate.id, error: errorMessage });
        
        secureLog.error("Failed to process affiliate", error, { 
          affiliateId: affiliate.id 
        });
      }
    }

    // Log final stats
    console.log("=== CHECK AFFILIATE ACTIVITY COMPLETED ===");
    console.log(`Total: ${stats.total}`);
    console.log(`60-day notifications: ${stats.notified_60_days}`);
    console.log(`75-day warnings: ${stats.notified_75_days}`);
    console.log(`90-day suspensions: ${stats.suspended_90_days}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Affiliate activity check completed",
        stats: {
          total: stats.total,
          notified_60_days: stats.notified_60_days,
          notified_75_days: stats.notified_75_days,
          suspended_90_days: stats.suspended_90_days,
          skipped: stats.skipped,
          errors: stats.errors.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("=== CHECK AFFILIATE ACTIVITY CRITICAL ERROR ===", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        stats,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
