import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { decryptPassword } from "../_shared/crypto.ts";

interface SubscriptionNotificationRequest {
  userEmail: string;
  userName?: string;
  notificationType: 'canceled' | 'updated' | 'downgraded' | 'upgraded';
  oldPlan?: string;
  newPlan?: string;
  effectiveDate?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-SUBSCRIPTION-NOTIFICATION] ${step}${detailsStr}`);
};

const planNames: Record<string, string> = {
  START: "Plano Start",
  PRO: "Plano Pro",
  SPECIALIST: "Plano Especialista",
  FREE: "Plano Free",
};

// Cores primárias: preto (#1a1a1a) e dourado (#D4A506)
function generateEmailContent(data: SubscriptionNotificationRequest, loginUrl: string): { subject: string; html: string } {
  const userName = data.userName || data.userEmail;
  const oldPlanName = data.oldPlan ? planNames[data.oldPlan] || data.oldPlan : '';
  const newPlanName = data.newPlan ? planNames[data.newPlan] || data.newPlan : '';
  
  let subject = '';
  let title = '';
  let mainMessage = '';
  let details = '';
  let ctaText = '';
  let headerIcon = '📝';
  
  switch (data.notificationType) {
    case 'canceled':
      subject = '😢 Sua assinatura foi cancelada';
      title = 'Assinatura Cancelada';
      headerIcon = '😢';
      mainMessage = `
        <p>Sua assinatura do plano <strong>${oldPlanName}</strong> foi cancelada.</p>
        <p>Você será movido para o plano gratuito e perderá acesso às funcionalidades premium.</p>
      `;
      details = `
        <h3 style="color: #1a1a1a;">⚠️ O que muda agora:</h3>
        <ul>
          <li>Acesso limitado às análises de ativos</li>
          <li>Sem acesso às carteiras recomendadas premium</li>
          <li>Sem acesso aos conteúdos exclusivos</li>
        </ul>
        <p>Sentiremos sua falta! Se mudar de ideia, você pode assinar novamente a qualquer momento.</p>
      `;
      ctaText = 'Reativar Assinatura';
      break;
      
    case 'upgraded':
      subject = `🚀 Parabéns! Seu plano foi atualizado para ${newPlanName}`;
      title = 'Plano Atualizado!';
      headerIcon = '🚀';
      mainMessage = `
        <p>Ótimas notícias! Seu plano foi atualizado de <strong>${oldPlanName}</strong> para <strong>${newPlanName}</strong>.</p>
        <p>Agora você tem acesso a ainda mais funcionalidades!</p>
      `;
      details = `
        <h3 style="color: #1a1a1a;">✨ Novos benefícios disponíveis:</h3>
        <ul>
          <li>Análises de ativos ainda mais completas</li>
          <li>Carteiras recomendadas adicionais</li>
          <li>Recursos exclusivos do novo plano</li>
        </ul>
        <p>Aproveite ao máximo sua nova assinatura!</p>
      `;
      ctaText = 'Explorar Novo Plano';
      break;
      
    case 'downgraded':
      subject = `📝 Seu plano foi alterado para ${newPlanName}`;
      title = 'Plano Alterado';
      headerIcon = '📝';
      mainMessage = `
        <p>Seu plano foi alterado de <strong>${oldPlanName}</strong> para <strong>${newPlanName}</strong>.</p>
        <p>As mudanças já estão ativas na sua conta.</p>
      `;
      details = `
        <h3 style="color: #1a1a1a;">📋 Informações importantes:</h3>
        <ul>
          <li>Você mantém acesso aos recursos do plano ${newPlanName}</li>
          <li>Algumas funcionalidades do plano anterior podem não estar mais disponíveis</li>
        </ul>
        <p>Se tiver dúvidas, entre em contato conosco!</p>
      `;
      ctaText = 'Ver Meu Plano';
      break;
      
    case 'updated':
    default:
      subject = '📝 Sua assinatura foi atualizada';
      title = 'Assinatura Atualizada';
      headerIcon = '📝';
      mainMessage = `
        <p>Sua assinatura foi atualizada com sucesso.</p>
        ${newPlanName ? `<p>Seu plano atual é: <strong>${newPlanName}</strong></p>` : ''}
      `;
      details = `
        <p>Acesse sua conta para ver todos os detalhes da sua assinatura.</p>
      `;
      ctaText = 'Ver Detalhes';
      break;
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f8; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .email-wrapper { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: #ffffff; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb; }
          .content { padding: 40px 30px; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
          .info-box { background: #f8f9fa; padding: 20px; border-left: 4px solid #D4A506; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .footer { text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-wrapper">
            <div class="header">
              <div style="font-size: 48px; margin-bottom: 16px;">${headerIcon}</div>
              <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">${title}</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${userName}</strong>,</p>
              
              ${mainMessage}
              
              <div class="info-box">
                ${details}
              </div>

              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">${ctaText}</a>
              </div>

              <p>Atenciosamente,<br>Equipe <strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
            </div>
            <div class="footer">
              <p style="margin: 0 0 5px 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
              <p style="margin: 0; color: #cccccc;">Este é um e-mail automático. Se você não solicitou esta alteração, entre em contato conosco.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
  
  return { subject, html };
}

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

    const data: SubscriptionNotificationRequest = await req.json();
    logStep("Received request", { type: data.notificationType, email: data.userEmail?.substring(0, 5) + '***' });

    if (!data.userEmail || !data.notificationType) {
      throw new Error("userEmail e notificationType são obrigatórios");
    }

    // Get SMTP configuration
    const { data: smtpConfig, error: smtpError } = await supabaseClient
      .from("smtp_config")
      .select("*")
      .single();

    if (smtpError || !smtpConfig) {
      logStep("ERROR: SMTP config not found", smtpError);
      throw new Error("Configuração SMTP não encontrada");
    }

    // Decrypt the SMTP password
    const decryptedPassword = await decryptPassword(smtpConfig.smtp_password);

    logStep("SMTP config loaded", {
      server: smtpConfig.smtp_server,
      port: smtpConfig.smtp_port,
    });

    // Generate email content
    const loginUrl = `${req.headers.get("origin") || "https://valuationit.com.br"}/app/historico`;
    const { subject, html } = generateEmailContent(data, loginUrl);

    // Send email using SMTP
    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.smtp_server,
        port: smtpConfig.smtp_port,
        tls: smtpConfig.security_type === "TLS",
        auth: {
          username: smtpConfig.smtp_user,
          password: decryptedPassword,
        },
      },
    });

    logStep("Sending email...");

    await client.send({
      from: `${smtpConfig.sender_name} <${smtpConfig.sender_email}>`,
      to: data.userEmail,
      subject,
      html,
    });

    await client.close();

    logStep("Email sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notificação de assinatura enviada com sucesso!" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    logStep("ERROR", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
