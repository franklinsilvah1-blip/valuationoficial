import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-NOTIFICATION] ${step}${detailsStr}`);
};

const LOGO_URL = "https://valuationit.com.br/logo.webp";

interface WebhookFailureNotification {
  type: 'webhook_failure';
  eventType: string;
  errorMessage: string;
  errorStack?: string;
  customerEmail?: string;
  timestamp: string;
  eventId: string;
  attemptNumber?: number;
}

interface PaymentFailureNotification {
  type: 'payment_failure';
  customerEmail: string;
  customerName?: string;
  plan: string;
  amount: number;
  currency: string;
  failureMessage: string;
  invoiceId: string;
  subscriptionId: string;
  timestamp: string;
  attemptCount?: number;
}

interface SyncFailureNotification {
  type: 'sync_failure';
  errorMessage: string;
  errorStack?: string;
  userEmail?: string;
  timestamp: string;
  syncType: string;
}

interface AffiliateRequestNotification {
  type: 'affiliate_request';
  userName: string;
  userEmail: string;
  affiliateCode: string;
  timestamp: string;
}

type NotificationData = WebhookFailureNotification | PaymentFailureNotification | SyncFailureNotification | AffiliateRequestNotification;

function generateWebhookFailureHTML(data: WebhookFailureNotification): string {
  const formattedDate = new Date(data.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Falha no Webhook</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: #ffffff; color: #1a1a1a; padding: 30px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; margin-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">🚨 Alerta: Falha no Webhook</h1>
    </div>
    
    <div style="padding: 40px;">
      <p style="color: #374151; font-size: 14px; line-height: 24px; margin: 0 0 24px;">
        Um webhook do Stripe falhou ao processar. Ação manual pode ser necessária.
      </p>

      <div style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #991b1b; font-size: 16px; font-weight: bold; margin: 0 0 16px;">
          Detalhes da Falha
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Tipo de Evento:</strong> ${data.eventType}
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>ID do Evento:</strong> ${data.eventId}
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Data/Hora:</strong> ${formattedDate}
        </p>
        
        ${data.customerEmail ? `
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Email do Cliente:</strong> ${data.customerEmail}
        </p>
        ` : ''}
        
        ${data.attemptNumber ? `
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Tentativa #:</strong> ${data.attemptNumber}
        </p>
        ` : ''}
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        
        <p style="color: #991b1b; font-size: 14px; font-weight: bold; margin: 16px 0 8px;">
          Mensagem de Erro:
        </p>
        <pre style="background-color: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin: 8px 0;">${data.errorMessage}</pre>
        
        ${data.errorStack ? `
        <p style="color: #991b1b; font-size: 14px; font-weight: bold; margin: 16px 0 8px;">
          Stack Trace:
        </p>
        <pre style="background-color: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin: 8px 0;">${data.errorStack}</pre>
        ` : ''}
      </div>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #374151; font-size: 14px; margin: 0 0 12px;"><strong>Ações Recomendadas:</strong></p>
        <p style="color: #374151; font-size: 13px; margin: 6px 0;">• Verificar logs detalhados no Supabase Edge Functions</p>
        <p style="color: #374151; font-size: 13px; margin: 6px 0;">• Se for problema de cliente, usar sincronização manual</p>
        <p style="color: #374151; font-size: 13px; margin: 6px 0;">• Verificar se há outros webhooks falhando</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://dashboard.stripe.com/events/${data.eventId}" style="background-color: #635BFF; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; margin: 8px 4px; font-size: 14px; font-weight: bold;">Ver Evento no Stripe</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <div style="text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px;">
        <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; margin-bottom: 10px;">
        <p style="margin: 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
        <p style="margin: 5px 0 0 0; color: #cccccc;">Esta é uma notificação automática do sistema de webhooks do Stripe.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

function generatePaymentFailureHTML(data: PaymentFailureNotification): string {
  const formattedDate = new Date(data.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: data.currency.toUpperCase(),
  }).format(data.amount / 100);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Falha no Pagamento</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: #ffffff; color: #1a1a1a; padding: 30px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; margin-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">💳 Alerta: Falha no Pagamento</h1>
    </div>
    
    <div style="padding: 40px;">
      <p style="color: #374151; font-size: 14px; line-height: 24px; margin: 0 0 24px;">
        Um pagamento recorrente falhou. O cliente pode perder acesso ao plano.
      </p>

      <div style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #991b1b; font-size: 16px; font-weight: bold; margin: 0 0 16px;">Informações do Cliente</p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Email:</strong> ${data.customerEmail}
        </p>
        
        ${data.customerName ? `
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Nome:</strong> ${data.customerName}
        </p>
        ` : ''}
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Plano:</strong> ${data.plan}
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        
        <p style="color: #991b1b; font-size: 16px; font-weight: bold; margin: 0 0 16px;">Detalhes do Pagamento</p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Valor:</strong> ${formattedAmount}
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Data/Hora:</strong> ${formattedDate}
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Invoice ID:</strong> ${data.invoiceId}
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Subscription ID:</strong> ${data.subscriptionId}
        </p>
        
        ${data.attemptCount ? `
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Tentativa #:</strong> ${data.attemptCount}
        </p>
        ` : ''}
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        
        <p style="color: #991b1b; font-size: 14px; font-weight: bold; margin: 16px 0 8px;">Motivo da Falha:</p>
        <pre style="background-color: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin: 8px 0;">${data.failureMessage}</pre>
      </div>

      <div style="background-color: #fffbeb; border: 2px solid #fde68a; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #92400e; font-size: 16px; font-weight: bold; margin: 0 0 12px;">⚠️ Atenção</p>
        <p style="color: #78350f; font-size: 13px; margin: 8px 0;">
          O Stripe tentará cobrar automaticamente nos próximos dias. Se todas as tentativas falharem, a assinatura será cancelada.
        </p>
        <p style="color: #78350f; font-size: 13px; margin: 8px 0;"><strong>Ações recomendadas:</strong></p>
        <p style="color: #78350f; font-size: 13px; margin: 6px 0 6px 16px;">• Entrar em contato com o cliente para atualizar forma de pagamento</p>
        <p style="color: #78350f; font-size: 13px; margin: 6px 0 6px 16px;">• Verificar se o cartão expirou ou foi bloqueado</p>
        <p style="color: #78350f; font-size: 13px; margin: 6px 0 6px 16px;">• Monitorar próximas tentativas de cobrança</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://dashboard.stripe.com/invoices/${data.invoiceId}" style="background-color: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; margin: 8px 4px; font-size: 14px; font-weight: bold;">Ver Invoice no Stripe</a>
        <a href="https://dashboard.stripe.com/subscriptions/${data.subscriptionId}" style="background-color: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; margin: 8px 4px; font-size: 14px; font-weight: bold;">Ver Assinatura</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <div style="text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px;">
        <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; margin-bottom: 10px;">
        <p style="margin: 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
        <p style="margin: 5px 0 0 0; color: #cccccc;">Esta é uma notificação automática do sistema de pagamentos.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

function generateSyncFailureHTML(data: SyncFailureNotification): string {
  const formattedDate = new Date(data.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Falha na Sincronização</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: #ffffff; color: #1a1a1a; padding: 30px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; margin-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">⚠️ Alerta: Falha na Sincronização</h1>
    </div>
    
    <div style="padding: 40px;">
      <p style="color: #374151; font-size: 14px; line-height: 24px; margin: 0 0 24px;">
        Uma sincronização com o Stripe falhou. Verifique se há problemas de conectividade ou configuração.
      </p>

      <div style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #991b1b; font-size: 16px; font-weight: bold; margin: 0 0 16px;">
          Detalhes da Falha
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Tipo de Sincronização:</strong> ${data.syncType}
        </p>
        
        ${data.userEmail ? `
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Email do Usuário:</strong> ${data.userEmail}
        </p>
        ` : ''}
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Data/Hora:</strong> ${formattedDate}
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
        
        <p style="color: #991b1b; font-size: 14px; font-weight: bold; margin: 16px 0 8px;">
          Mensagem de Erro:
        </p>
        <pre style="background-color: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin: 8px 0;">${data.errorMessage}</pre>
        
        ${data.errorStack ? `
        <p style="color: #991b1b; font-size: 14px; font-weight: bold; margin: 16px 0 8px;">
          Stack Trace:
        </p>
        <pre style="background-color: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; margin: 8px 0;">${data.errorStack}</pre>
        ` : ''}
      </div>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #374151; font-size: 14px; margin: 0 0 12px;"><strong>Ações Recomendadas:</strong></p>
        <p style="color: #374151; font-size: 13px; margin: 6px 0;">• Verificar se o Stripe API está acessível</p>
        <p style="color: #374151; font-size: 13px; margin: 6px 0;">• Confirmar validade do STRIPE_SECRET_KEY</p>
        <p style="color: #374151; font-size: 13px; margin: 6px 0;">• Verificar logs detalhados no Supabase Edge Functions</p>
        <p style="color: #374151; font-size: 13px; margin: 6px 0;">• Tentar sincronização manual se necessário</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://dashboard.stripe.com/" style="background-color: #635BFF; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; margin: 8px 4px; font-size: 14px; font-weight: bold;">Acessar Stripe</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <div style="text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px;">
        <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; margin-bottom: 10px;">
        <p style="margin: 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
        <p style="margin: 5px 0 0 0; color: #cccccc;">Esta é uma notificação automática do sistema de sincronização.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

function generateAffiliateRequestHTML(data: AffiliateRequestNotification): string {
  const formattedDate = new Date(data.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nova Solicitação de Afiliado</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: #ffffff; color: #1a1a1a; padding: 30px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; margin-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">🤝 Nova Solicitação de Afiliado</h1>
    </div>
    
    <div style="padding: 40px;">
      <p style="color: #374151; font-size: 14px; line-height: 24px; margin: 0 0 24px;">
        Um novo usuário solicitou participar do Programa de Afiliados e aguarda sua aprovação.
      </p>

      <div style="background-color: #f0f9ff; border: 2px solid #bfdbfe; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #1e40af; font-size: 16px; font-weight: bold; margin: 0 0 16px;">
          Informações do Solicitante
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Nome:</strong> ${data.userName}
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Email:</strong> ${data.userEmail}
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Código Reservado:</strong> <code style="background-color: #1e40af; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${data.affiliateCode}</code>
        </p>
        
        <p style="color: #374151; font-size: 13px; margin: 8px 0;">
          <strong>Data da Solicitação:</strong> ${formattedDate}
        </p>
      </div>

      <div style="background-color: #fffbeb; border: 2px solid #fde68a; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #92400e; font-size: 14px; font-weight: bold; margin: 0 0 12px;">⚡ Ação Necessária</p>
        <p style="color: #78350f; font-size: 13px; margin: 8px 0;">
          Acesse o painel administrativo para aprovar ou rejeitar esta solicitação.
        </p>
        <p style="color: #78350f; font-size: 13px; margin: 8px 0;">
          O usuário receberá um e-mail automático quando você aprovar a conta.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://valuationit.com.br/app/admin/affiliates" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; display: inline-block; margin: 8px 4px; font-size: 14px; font-weight: bold;">Revisar Solicitação</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

      <div style="text-align: center; padding: 24px; background: #f8f9fa; color: #6b7280; font-size: 12px;">
        <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; opacity: 0.7; margin-bottom: 10px;">
        <p style="margin: 0;"><strong>VALUATION Invest Tech</strong></p>
        <p style="margin: 5px 0 0 0;">Esta é uma notificação automática do Programa de Afiliados.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Validate cron secret to prevent unauthorized access
  // Note: This function can also be called by other edge functions with service role
  const authHeader = req.headers.get('Authorization');
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  // Allow if either valid cron secret OR service role token
  const isValidCronSecret = cronSecret && expectedSecret && cronSecret === expectedSecret;
  const isServiceRole = authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey);
  
  if (!isValidCronSecret && !isServiceRole) {
    logStep("SECURITY: Unauthorized access attempt - invalid credentials");
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      }
    );
  }

  try {
    logStep("Admin notification function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const notificationData: NotificationData = await req.json();
    logStep("Received notification", { type: notificationData.type });

    // Get admin email from config
    const { data: adminConfig, error: adminError } = await supabaseClient
      .from("app_config")
      .select("value")
      .eq("key", "admin_email")
      .maybeSingle();

    if (adminError || !adminConfig) {
      logStep("WARNING: Admin email not configured");
      return new Response(JSON.stringify({ 
        success: false,
        message: "Admin email not configured. Please add 'admin_email' to app_config table." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const adminEmail = adminConfig.value;
    logStep("Admin email found", { email: adminEmail });

    // Get sender config
    const senderConfig = await getSenderConfig(supabaseClient);

    // Generate email based on notification type
    let htmlContent: string;
    let subject: string;

    if (notificationData.type === 'webhook_failure') {
      subject = `🚨 Falha no Webhook - ${notificationData.eventType}`;
      htmlContent = generateWebhookFailureHTML(notificationData);
    } else if (notificationData.type === 'payment_failure') {
      subject = `💳 Falha no Pagamento - ${notificationData.customerEmail}`;
      htmlContent = generatePaymentFailureHTML(notificationData);
    } else if (notificationData.type === 'sync_failure') {
      subject = `⚠️ Falha na Sincronização - ${notificationData.syncType}`;
      htmlContent = generateSyncFailureHTML(notificationData);
    } else if (notificationData.type === 'affiliate_request') {
      subject = `🤝 Nova Solicitação de Afiliado - ${notificationData.userName}`;
      htmlContent = generateAffiliateRequestHTML(notificationData);
    } else {
      throw new Error(`Unknown notification type: ${(notificationData as any).type}`);
    }

    logStep("Email template generated", { subject });

    // Send email via Resend API
    const emailResult = await sendEmail({
      to: adminEmail,
      subject,
      html: htmlContent,
      from: senderConfig ? {
        name: senderConfig.name,
        email: senderConfig.email,
      } : undefined,
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email");
    }

    logStep("Admin notification email sent successfully", { messageId: emailResult.messageId });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Admin notified successfully",
      sentTo: adminEmail,
      messageId: emailResult.messageId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[ADMIN-NOTIFICATION] ERROR:", errorMessage);
    console.error("[ADMIN-NOTIFICATION] STACK:", errorStack);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      stack: errorStack
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
