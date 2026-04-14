import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";
import { APP_URL } from "../_shared/constants.ts";

interface WelcomeEmailRequest {
  userId: string;
  plan: string;
}

const LOGO_URL = "https://valuationit.com.br/logo.webp";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-WELCOME-EMAIL] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard: only allow calls with service role key
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { userId, plan }: WelcomeEmailRequest = await req.json();
    logStep("Received request", { userId: userId?.slice(-4), plan });

    if (!userId || !plan) {
      throw new Error("userId e plan são obrigatórios");
    }

    // Get user data
    const { data: { user }, error: userError } = await supabaseClient.auth.admin.getUserById(userId);

    if (userError || !user) {
      logStep("ERROR: User not found", userError);
      throw new Error("Usuário não encontrado");
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .single();

    const userName = profile?.name || user.email;
    logStep("User data loaded", { userName: userName?.slice(0, 3) + "***" });

    // Get sender configuration
    const senderConfig = await getSenderConfig(supabaseClient);
    logStep("Sender config loaded");

    // Get plan details
    const planNames: Record<string, string> = {
      START: "Plano Start",
      PRO: "Plano Pro",
      SPECIALIST: "Plano Especialista",
      FREE: "Plano Free",
    };

    const planName = planNames[plan] || plan;

    // Prepare email content
    const loginUrl = `${APP_URL}/auth`;
    
    // Cores primárias: preto (#1a1a1a) e dourado (#D4A506)
    const emailHtml = `
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
            .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
            .credentials { background: #f8f9fa; padding: 20px; border-left: 4px solid #D4A506; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .footer { text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px; }
            .footer img { max-width: 100px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="email-wrapper">
              <div class="header">
                <img src="${LOGO_URL}" alt="VALUATION Invest Tech">
                <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">🎉 Bem-vindo ao VALUATION!</h1>
              </div>
              <div class="content">
                <p>Olá <strong>${userName}</strong>,</p>
                
                <p>Seja muito bem-vindo(a) ao <strong>${planName}</strong>! Estamos muito felizes em tê-lo(a) conosco.</p>
                
                <div class="credentials">
                  <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">🔐 Suas Credenciais de Acesso</h3>
                  <p style="margin: 0 0 10px 0;"><strong>E-mail:</strong> ${user.email}</p>
                  <p style="margin: 0;"><strong>Link de acesso:</strong></p>
                  <a href="${loginUrl}" class="button">Acessar Plataforma</a>
                </div>

                <h3 style="color: #1a1a1a;">📊 O que você pode fazer agora:</h3>
                <ul>
                  <li>Explorar análises completas de ativos</li>
                  <li>Acessar carteiras recomendadas</li>
                  <li>Responder o questionário de perfil de investidor</li>
                  ${plan !== "FREE" ? "<li>Acessar conteúdos exclusivos</li>" : ""}
                </ul>

                <p>Se tiver alguma dúvida, nossa equipe está à disposição para ajudar!</p>

                <p>Bons investimentos! 🚀</p>

                <p>Equipe <strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
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

    logStep("Sending email via Resend API");

    const emailResult = await sendEmail({
      to: user.email || "",
      subject: `🎉 Bem-vindo ao ${planName}!`,
      html: emailHtml,
      from: senderConfig || undefined,
    });

    if (!emailResult.success) {
      logStep("ERROR sending email", { error: emailResult.error });
      throw new Error(emailResult.error || "Erro ao enviar e-mail de boas-vindas");
    }

    logStep("Email sent successfully", { messageId: emailResult.messageId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "E-mail de boas-vindas enviado com sucesso!" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[SEND-WELCOME-EMAIL] Error:", error);
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
