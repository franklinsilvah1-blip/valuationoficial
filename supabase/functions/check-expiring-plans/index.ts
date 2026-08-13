import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";

const LOGO_URL = "https://valuationit.com.br/logo.webp";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-EXPIRING-PLANS] ${step}${detailsStr}`);
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Validate cron secret to prevent unauthorized access
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
    logStep("SECURITY: Unauthorized access attempt - invalid cron secret");
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      }
    );
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Get sender config
    const senderConfig = await getSenderConfig(supabaseClient);

    // Calcular data de 5 dias no futuro
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(0, 0, 0, 0);

    const fiveDaysFromNowEnd = new Date(fiveDaysFromNow);
    fiveDaysFromNowEnd.setHours(23, 59, 59, 999);

    logStep("Checking for expiring plans", {
      targetDate: fiveDaysFromNow.toISOString(),
    });

    // Buscar perfis com planos que expiram em 5 dias
    const { data: expiringProfiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, name, plan, plan_end_at")
      .neq("plan", "FREE")
      .neq("plan", "START")
      .gte("plan_end_at", fiveDaysFromNow.toISOString())
      .lte("plan_end_at", fiveDaysFromNowEnd.toISOString());

    if (profilesError) throw profilesError;

    if (!expiringProfiles || expiringProfiles.length === 0) {
      logStep("No expiring plans found");
      return new Response(JSON.stringify({ 
        message: "No expiring plans",
        sent: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found expiring plans", { count: expiringProfiles.length });

    // Buscar emails dos usuários
    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];

    for (const profile of expiringProfiles) {
      try {
        // Buscar email do usuário
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(
          profile.id
        );

        if (userError || !userData?.user?.email) {
          logStep("User email not found", { userId: profile.id });
          emailsFailed.push(profile.id);
          continue;
        }

        const userEmail = userData.user.email;
        const userName = profile.name || userEmail.split("@")[0];
        const expirationDate = new Date(profile.plan_end_at!).toLocaleDateString("pt-BR");

        logStep("Sending notification email", { 
          email: userEmail, 
          plan: profile.plan,
          expiresAt: expirationDate 
        });

        // Template do e-mail com logo - Cores primárias: preto (#1a1a1a) e dourado (#D4A506)
        const emailContent = `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f8; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .email-wrapper { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
              .header { background: #ffffff; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb; }
              .header img { max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto; }
              .content { padding: 40px 30px; }
              .plan-badge { display: inline-block; background: #1a1a1a; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
              .warning-box { background: #fef3c7; border-left: 4px solid #D4A506; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #D4A506 0%, #B8920A 100%); color: #1a1a1a; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; box-shadow: 0 4px 12px rgba(212,165,6,0.3); }
              .footer { text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px; }
              .footer img { max-width: 100px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="email-wrapper">
                <div class="header">
                  <img src="${LOGO_URL}" alt="VALUATION Invest Tech">
                  <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">⚠️ Seu Plano Está Expirando</h1>
                </div>
                <div class="content">
                  <p>Olá, <strong>${userName}</strong>!</p>
                  
                  <div class="warning-box">
                    <strong>Atenção:</strong> Seu plano <span class="plan-badge">${profile.plan}</span> expirará em <strong>5 dias</strong>, no dia <strong>${expirationDate}</strong>.
                  </div>

                  <p>Para continuar aproveitando todos os benefícios do seu plano, renove sua assinatura antes da data de vencimento.</p>

                  <h3 style="color: #1a1a1a;">O que acontece se o plano expirar?</h3>
                  <ul>
                    <li>Acesso limitado às análises de ativos</li>
                    <li>Perda do acesso às carteiras recomendadas</li>
                    <li>Limite de 3 visualizações diárias</li>
                  </ul>

                  <p style="text-align: center;">
                    <a href="https://valuationit.com.br/assinatura" class="cta-button">
                      Renovar Agora
                    </a>
                  </p>

                  <p>Caso tenha alguma dúvida ou precise de ajuda, nossa equipe está à disposição!</p>

                  <p>Atenciosamente,<br><strong style="color: #D4A506;">Equipe VALUATION</strong></p>
                </div>
                <div class="footer">
                  <img src="${LOGO_URL}" alt="VALUATION">
                  <p style="margin: 0 0 5px 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
                  <p style="margin: 0; color: #cccccc;">Este é um e-mail automático, por favor não responda.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        // Enviar e-mail via Resend API
        const emailResult = await sendEmail({
          to: userEmail,
          subject: `⚠️ Seu plano ${profile.plan} expira em 5 dias`,
          html: emailContent,
          from: senderConfig ? {
            name: senderConfig.name,
            email: senderConfig.email,
          } : undefined,
        });

        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to send email");
        }

        emailsSent.push(userEmail);
        logStep("Email sent successfully", { email: userEmail, messageId: emailResult.messageId });

      } catch (emailError) {
        logStep("Failed to send email", { 
          userId: profile.id, 
          error: emailError instanceof Error ? emailError.message : String(emailError) 
        });
        emailsFailed.push(profile.id);
      }
    }

    logStep("Notification process completed", {
      total: expiringProfiles.length,
      sent: emailsSent.length,
      failed: emailsFailed.length,
    });

    return new Response(JSON.stringify({
      message: "Expiration notifications processed",
      total: expiringProfiles.length,
      sent: emailsSent.length,
      failed: emailsFailed.length,
      emailsSent,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-expiring-plans", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: "Failed to check expiring plans",
      details: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
