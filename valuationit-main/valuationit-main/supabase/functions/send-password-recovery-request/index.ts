import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";

interface PasswordRecoveryRequestRequest {
  email: string;
  turnstileToken?: string;
}

const LOGO_URL = "https://valuationit.com.br/logo.webp";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PASSWORD-RECOVERY-REQUEST] ${step}${detailsStr}`);
};

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

    const { email, turnstileToken }: PasswordRecoveryRequestRequest = await req.json();
    logStep("Received request", { email: email?.slice(0, 3) + "***" });

    if (!email) {
      throw new Error("E-mail é obrigatório");
    }

    // Verify Turnstile CAPTCHA if provided
    if (turnstileToken) {
      logStep("Verifying Turnstile CAPTCHA");
      const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
      
      if (turnstileSecret) {
        const turnstileResponse = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${turnstileSecret}&response=${turnstileToken}`,
          }
        );
        
        const turnstileResult = await turnstileResponse.json();
        
        if (!turnstileResult.success) {
          logStep("CAPTCHA verification failed", turnstileResult);
          throw new Error("Verificação de segurança falhou. Por favor, tente novamente.");
        }
        logStep("CAPTCHA verified successfully");
      }
    }

    // Check if user exists (but don't reveal this to prevent enumeration)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, name")
      .eq("email", email)
      .maybeSingle();

    if (!profile) {
      // Return success to prevent user enumeration, but don't send email
      logStep("User not found, returning success to prevent enumeration");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Se o e-mail estiver cadastrado, você receberá um link de recuperação.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get sender configuration
    const senderConfig = await getSenderConfig(supabaseClient);
    logStep("Sender config loaded", { 
      senderName: senderConfig?.name || "default" 
    });

    // Generate password reset link with redirect to custom domain
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: "https://valuationit.com.br/reset-password"
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      logStep("ERROR generating reset link", linkError);
      throw new Error("Erro ao gerar link de recuperação");
    }

    const resetLink = linkData.properties.action_link;
    logStep("Reset link generated successfully");

    const userName = profile.name || email.split("@")[0];

    // Email HTML template with logo - Cores primárias: preto (#1a1a1a) e dourado (#D4A506)
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperação de Senha</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1a1a2e; 
              margin: 0;
              padding: 0;
              background-color: #f4f4f8;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px;
            }
            .email-wrapper {
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .header { 
              background: #ffffff; 
              color: #1a1a1a; 
              padding: 40px 30px; 
              text-align: center;
              border-bottom: 1px solid #e5e7eb;
            }
            .header img {
              max-width: 180px;
              height: auto;
              margin-bottom: 20px;
              display: block;
              margin-left: auto;
              margin-right: auto;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              color: #1a1a1a;
            }
            .header .icon {
              font-size: 48px;
              margin-bottom: 16px;
            }
            .content { 
              padding: 40px 30px;
            }
            .content p {
              margin: 0 0 20px 0;
              color: #374151;
              font-size: 16px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%);
              color: white !important;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .warning-box {
              background: #fef3c7;
              border-left: 4px solid #D4A506;
              padding: 16px 20px;
              border-radius: 0 8px 8px 0;
              margin: 24px 0;
            }
            .warning-box p {
              margin: 0;
              color: #92400e;
              font-size: 14px;
            }
            .link-fallback {
              background: #f3f4f6;
              padding: 12px 16px;
              border-radius: 8px;
              word-break: break-all;
              font-size: 12px;
              color: #1a1a1a;
              margin-top: 24px;
              border-left: 3px solid #D4A506;
            }
            .footer { 
              text-align: center; 
              padding: 24px;
              background: #1a1a1a;
              color: #ffffff; 
              font-size: 12px; 
            }
            .footer img {
              max-width: 100px;
              height: auto;
              margin-bottom: 10px;
              display: block;
              margin-left: auto;
              margin-right: auto;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="email-wrapper">
              <div class="header">
                <img src="${LOGO_URL}" alt="VALUATION Invest Tech">
                <div class="icon">🔐</div>
                <h1>Recuperação de Senha</h1>
              </div>
              <div class="content">
                <p>Olá <strong>${userName}</strong>,</p>
                
                <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>VALUATION Invest Tech</strong>.</p>
                
                <p>Clique no botão abaixo para criar uma nova senha:</p>
                
                <div class="button-container">
                  <a href="${resetLink}" class="button">Redefinir Minha Senha</a>
                </div>
                
                <div class="warning-box">
                  <p><strong>⚠️ Importante:</strong> Este link expira em <strong>1 hora</strong>. Se você não solicitou a recuperação de senha, ignore este e-mail.</p>
                </div>
                
                <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
                
                <div class="link-fallback">
                  ${resetLink}
                </div>
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
      to: email,
      subject: "🔐 Redefinição de Senha - VALUATION Invest Tech",
      html: emailHtml,
      from: senderConfig || undefined,
    });

    if (!emailResult.success) {
      logStep("ERROR sending email", { error: emailResult.error });
      throw new Error(emailResult.error || "Erro ao enviar e-mail de recuperação");
    }

    logStep("Email sent successfully", { messageId: emailResult.messageId });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Se o e-mail estiver cadastrado, você receberá um link de recuperação.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logStep("ERROR", { error: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
