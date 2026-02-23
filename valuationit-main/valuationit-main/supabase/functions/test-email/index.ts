import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";

const LOGO_URL = "https://valuationit.com.br/logo.webp";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      throw new Error("Unauthorized - Admin only");
    }

    const { emailType, testEmail } = await req.json();

    if (!emailType || !testEmail) {
      throw new Error("emailType and testEmail are required");
    }

    const { maskEmail } = await import("../_shared/logger.ts");
    console.log(`[TEST-EMAIL] Testing ${emailType} to ${maskEmail(testEmail)}`);

    // Get sender config
    const senderConfig = await getSenderConfig(supabase);

    let result;

    switch (emailType) {
      case "welcome":
        result = await sendWelcomeTest(testEmail, senderConfig);
        break;
      case "admin-webhook-failure":
      case "admin-payment-failure":
      case "admin-sync-failure":
        result = await sendAdminNotificationTest(testEmail, emailType, senderConfig);
        break;
      case "password-recovery":
        result = await sendPasswordRecoveryTest(testEmail, senderConfig);
        break;
      case "sync-notification":
        result = await sendSyncNotificationTest(testEmail, senderConfig);
        break;
      case "contact":
        result = await sendContactTest(testEmail, senderConfig);
        break;
      case "expiring-plans":
        result = await sendExpiringPlansTest(testEmail, senderConfig);
        break;
      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email de teste enviado com sucesso", result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[TEST-EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface SenderConfig {
  name: string;
  email: string;
}

function generateEmailWrapper(title: string, content: string, _headerColor: string = "#ffffff"): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f8; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      <div style="background: #ffffff; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 3px solid #D4A506;">
        <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
        <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">${title}</h1>
      </div>
      <div style="padding: 40px 30px;">
        ${content}
      </div>
      <div style="text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px;">
        <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
        <p style="margin: 0 0 5px 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
        <p style="margin: 0; color: #cccccc;">Este é um e-mail automático.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendWelcomeTest(testEmail: string, senderConfig: SenderConfig | null) {
  const content = `
    <p style="font-size: 16px; color: #374151;"><strong>Este é um email de teste.</strong></p>
    <p style="font-size: 16px; color: #374151;">Olá! Estamos felizes em ter você conosco.</p>
    <p style="font-size: 16px; color: #374151;">Seu plano foi ativado com sucesso.</p>
    <p style="font-size: 16px; color: #374151;">Aproveite todas as análises e recursos exclusivos!</p>
  `;

  const result = await sendEmail({
    to: testEmail,
    subject: "[TESTE] 🎉 Bem-vindo ao VALUATION!",
    html: generateEmailWrapper("🎉 Bem-vindo!", content),
    from: senderConfig ? {
      name: senderConfig.name,
      email: senderConfig.email,
    } : undefined,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  return { sent: true, messageId: result.messageId };
}

async function sendAdminNotificationTest(testEmail: string, type: string, senderConfig: SenderConfig | null) {
  const subjects = {
    "admin-webhook-failure": "🚨 Falha no Webhook do Stripe",
    "admin-payment-failure": "💳 Falha em Pagamento Recorrente",
    "admin-sync-failure": "⚠️ Falha na Sincronização",
  };

  const content = `
    <p style="font-size: 16px; color: #374151;"><strong>Este é um email de teste.</strong></p>
    <p style="font-size: 16px; color: #374151;">Tipo: ${type}</p>
    <p style="font-size: 16px; color: #374151;">Data: ${new Date().toLocaleString("pt-BR")}</p>
    <p style="font-size: 16px; color: #374151;">Detalhes: Este seria um alerta sobre um problema no sistema.</p>
  `;

  const result = await sendEmail({
    to: testEmail,
    subject: `[TESTE] ${subjects[type as keyof typeof subjects]}`,
    html: generateEmailWrapper("Notificação Administrativa (TESTE)", content, "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"),
    from: senderConfig ? {
      name: senderConfig.name,
      email: senderConfig.email,
    } : undefined,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  return { sent: true, messageId: result.messageId };
}

async function sendPasswordRecoveryTest(testEmail: string, senderConfig: SenderConfig | null) {
  const content = `
    <p style="font-size: 16px; color: #374151;"><strong>Este é um email de teste.</strong></p>
    <p style="font-size: 16px; color: #374151;">Você solicitou a recuperação de senha.</p>
    <p style="font-size: 16px; color: #374151;">Clique no link abaixo para redefinir sua senha:</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="#" style="display: inline-block; padding: 14px 32px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Redefinir Senha</a>
    </div>
    <p style="font-size: 14px; color: #6b7280;">Se você não solicitou isso, ignore este email.</p>
  `;

  const result = await sendEmail({
    to: testEmail,
    subject: "[TESTE] 🔐 Recuperação de Senha",
    html: generateEmailWrapper("🔐 Recuperação de Senha (TESTE)", content),
    from: senderConfig ? {
      name: senderConfig.name,
      email: senderConfig.email,
    } : undefined,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  return { sent: true, messageId: result.messageId };
}

async function sendSyncNotificationTest(testEmail: string, senderConfig: SenderConfig | null) {
  const content = `
    <p style="font-size: 16px; color: #374151;"><strong>Este é um email de teste.</strong></p>
    <p style="font-size: 16px; color: #374151;">A sincronização do Google Sheets foi concluída com sucesso.</p>
    <ul style="font-size: 16px; color: #374151;">
      <li>Registros inseridos: 10</li>
      <li>Registros atualizados: 5</li>
      <li>Erros: 0</li>
    </ul>
    <p style="font-size: 14px; color: #6b7280;">Data: ${new Date().toLocaleString("pt-BR")}</p>
  `;

  const result = await sendEmail({
    to: testEmail,
    subject: "[TESTE] ✅ Sincronização Concluída",
    html: generateEmailWrapper("✅ Sincronização Concluída (TESTE)", content, "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"),
    from: senderConfig ? {
      name: senderConfig.name,
      email: senderConfig.email,
    } : undefined,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  return { sent: true, messageId: result.messageId };
}

async function sendContactTest(testEmail: string, senderConfig: SenderConfig | null) {
  const content = `
    <p style="font-size: 16px; color: #374151;"><strong>Este é um email de teste.</strong></p>
    <p style="font-size: 16px; color: #374151;">Obrigado por entrar em contato!</p>
    <p style="font-size: 16px; color: #374151;">Recebemos sua mensagem e responderemos em breve.</p>
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #D4A506; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Dados do contato:</strong></p>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Nome: João da Silva</li>
        <li>Email: joao@exemplo.com</li>
        <li>Mensagem: Esta é uma mensagem de teste.</li>
      </ul>
    </div>
  `;

  const result = await sendEmail({
    to: testEmail,
    subject: "[TESTE] 📬 Recebemos sua Mensagem",
    html: generateEmailWrapper("📬 Contato Recebido (TESTE)", content),
    from: senderConfig ? {
      name: senderConfig.name,
      email: senderConfig.email,
    } : undefined,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  return { sent: true, messageId: result.messageId };
}

async function sendExpiringPlansTest(testEmail: string, senderConfig: SenderConfig | null) {
  const content = `
    <p style="font-size: 16px; color: #374151;"><strong>Este é um email de teste.</strong></p>
    <p style="font-size: 16px; color: #374151;">Olá! Seu plano PRO expira em <strong>7 dias</strong>.</p>
    <p style="font-size: 16px; color: #374151;">Data de expiração: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")}</p>
    <p style="font-size: 16px; color: #374151;">Renove agora para continuar aproveitando todos os benefícios!</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://valuationit.com.br/assinatura" style="display: inline-block; padding: 14px 32px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Renovar Plano</a>
    </div>
  `;

  const result = await sendEmail({
    to: testEmail,
    subject: "[TESTE] ⏰ Seu Plano Expira em 7 Dias",
    html: generateEmailWrapper("⏰ Seu Plano Está Expirando (TESTE)", content, "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"),
    from: senderConfig ? {
      name: senderConfig.name,
      email: senderConfig.email,
    } : undefined,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  return { sent: true, messageId: result.messageId };
}
