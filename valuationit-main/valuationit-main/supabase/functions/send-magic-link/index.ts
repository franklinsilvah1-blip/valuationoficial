import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";

const LOGO_URL = "https://valuationit.com.br/logo.webp";

interface MagicLinkRequest {
  email: string;
  turnstileToken?: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MAGIC-LINK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, turnstileToken }: MagicLinkRequest = await req.json();
    logStep("Request received", { email });

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar Turnstile se token fornecido
    if (turnstileToken) {
      const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
      if (turnstileSecret) {
        logStep("Verifying Turnstile token");
        const formData = new FormData();
        formData.append("secret", turnstileSecret);
        formData.append("response", turnstileToken);

        const turnstileResponse = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          { method: "POST", body: formData }
        );

        const turnstileResult = await turnstileResponse.json();
        if (!turnstileResult.success) {
          logStep("Turnstile verification failed", turnstileResult);
          return new Response(
            JSON.stringify({ error: "Verificação de segurança falhou" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        logStep("Turnstile verified successfully");
      }
    }

    // Verificar se usuário existe (sem revelar informação)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, name")
      .eq("email", email)
      .maybeSingle();

    // Sempre retornar sucesso para evitar enumeração de emails
    if (!profile) {
      logStep("User not found, returning success anyway");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Se o email estiver cadastrado, você receberá um link de acesso." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Generating magic link", { userId: profile.id });

    // Gerar magic link
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: "https://valuationit.com.br/app/dashboard"
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      logStep("Error generating magic link", { error: linkError });
      throw new Error("Erro ao gerar link de acesso");
    }

    const magicLink = linkData.properties.action_link;
    logStep("Magic link generated successfully");

    // Buscar configuração de remetente
    const senderConfig = await getSenderConfig(supabaseClient);
    const userName = profile.name || "Investidor";

    // Gerar HTML do email - Cores primárias: preto (#1a1a1a) e dourado (#D4A506)
    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acesse sua conta - VALUATION</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td>
              <div style="background: #ffffff; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔐</div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">Acesse sua conta</h1>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Olá, <strong>${userName}</strong>!
              </p>
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Você solicitou um link de acesso à sua conta. Clique no botão abaixo para entrar:
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${magicLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                  Entrar na Minha Conta
                </a>
              </div>
              
              <p style="color: #D4A506; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                ⏰ <strong style="color: #1a1a1a;">Este link expira em 1 hora</strong> e só pode ser usado uma vez.
              </p>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Se o botão não funcionar, copie e cole este link no seu navegador:
              </p>
              <p style="color: #1a1a1a; font-size: 12px; word-break: break-all; background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 10px 0 0 0; border-left: 3px solid #D4A506;">
                ${magicLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 0;">
                🛡️ <strong>Dica de segurança:</strong> Se você não solicitou este link, ignore este email. Sua conta permanece segura.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <div style="text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px;">
                <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
                <p style="margin: 0 0 5px 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
                <p style="margin: 0 0 5px 0; color: #cccccc;">Este é um e-mail automático, por favor não responda.</p>
                <p style="margin: 0; color: #999999;">© ${new Date().getFullYear()} VALUATION Invest Tech. Todos os direitos reservados.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Enviar email
    const emailResult = await sendEmail({
      to: email,
      subject: "🔐 Seu link de acesso - VALUATION",
      html: emailHtml,
      from: senderConfig || undefined
    });

    if (!emailResult.success) {
      logStep("Error sending email", { error: emailResult.error });
      throw new Error("Erro ao enviar email");
    }

    logStep("Magic link email sent successfully", { messageId: emailResult.messageId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Se o email estiver cadastrado, você receberá um link de acesso." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error in magic link function", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: "Erro ao processar solicitação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
