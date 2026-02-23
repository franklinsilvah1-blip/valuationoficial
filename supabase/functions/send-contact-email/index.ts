import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const LOGO_URL = "https://valuationit.com.br/logo.webp";

// Input validation schema
const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  subject: z.string().trim().min(1, "Subject is required").max(200, "Subject must be less than 200 characters"),
  message: z.string().trim().min(1, "Message is required").max(5000, "Message must be less than 5000 characters"),
  turnstileToken: z.string().optional(),
});

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[SEND-CONTACT-EMAIL] Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse and validate request body
    const requestBody = await req.json();
    const validatedData = contactSchema.parse(requestBody);
    
    const { name, email, phone, subject, message, turnstileToken } = validatedData;

    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    
    console.log("[SEND-CONTACT-EMAIL] Request from IP", { ip: clientIP });

    // Verify Turnstile CAPTCHA token
    if (turnstileToken) {
      const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
      if (turnstileSecret) {
        const turnstileResponse = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              remoteip: clientIP,
            }),
          }
        );

        const turnstileResult = await turnstileResponse.json();
        
        if (!turnstileResult.success) {
          console.log("[SEND-CONTACT-EMAIL] CAPTCHA verification failed", turnstileResult);
          throw new Error("Verificação de segurança falhou. Por favor, tente novamente.");
        }
        
        console.log("[SEND-CONTACT-EMAIL] CAPTCHA verified successfully");
      }
    }

    // Check IP-based rate limit (5 requests per hour)
    try {
      await checkRateLimit(clientIP, "contact-form", 5, 60);
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMIT_EXCEEDED") {
        console.log("[SEND-CONTACT-EMAIL] Rate limit exceeded", { ip: clientIP });
        throw new Error("Muitas tentativas. Por favor, aguarde 1 hora antes de tentar novamente.");
      }
      throw error;
    }

    // Get SMTP configuration for sender info
    const { data: smtpConfig, error: configError } = await supabaseClient
      .from("smtp_config")
      .select("*")
      .single();

    if (configError || !smtpConfig) {
      console.error("SMTP configuration not found:", configError);
      throw new Error("SMTP_NOT_CONFIGURED");
    }

    const { maskName, maskEmail } = await import("../_shared/logger.ts");
    console.log(`Processing contact form from: ${maskName(name)} (${maskEmail(email)})`);

    // Create email HTML body with logo - Premium design with primary colors
    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Nova Mensagem de Contato</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f8; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      <div style="background: #ffffff; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 3px solid #D4A506;">
        <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
        <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">📬 Nova Mensagem de Contato</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h3 style="color: #374151; margin: 0 0 15px 0;">Informações do Contato</h3>
        <ul style="list-style: none; padding: 0; margin: 0 0 25px 0;">
          <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Nome:</strong> ${name}</li>
          <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Email:</strong> ${email}</li>
          <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Telefone:</strong> ${phone || "Não informado"}</li>
          <li style="padding: 8px 0;"><strong>Assunto:</strong> ${subject}</li>
        </ul>
        
        <h3 style="color: #374151; margin: 0 0 15px 0;">Mensagem</h3>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #D4A506;">
          <p style="margin: 0; color: #374151; white-space: pre-wrap;">${message}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          Esta mensagem foi enviada através do formulário de contato do site.<br>
          Por favor, responda diretamente para o email: <strong>${email}</strong>
        </p>
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

    // Create plain text version
    const emailText = `
Nova mensagem de contato recebida através do site VALUATION Invest tech

===================================
INFORMAÇÕES DO CONTATO
===================================

Nome: ${name}
Email: ${email}
Telefone: ${phone || "Não informado"}
Assunto: ${subject}

===================================
MENSAGEM
===================================

${message}

===================================

Esta mensagem foi enviada através do formulário de contato do site.
Por favor, responda diretamente para o email: ${email}
    `.trim();

    // Send email via Resend
    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: `${smtpConfig.sender_name} <${smtpConfig.sender_email}>`,
      to: [smtpConfig.sender_email],
      subject: `[Contato do Site] - ${subject}`,
      html: emailHtml,
      text: emailText,
      replyTo: email,
    });

    if (emailError) {
      console.error("Resend Error:", emailError);
      throw new Error("EMAIL_SEND_FAILED");
    }

    console.log("Email sent successfully via Resend:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Contact message sent successfully"
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
      }
    );

  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    
    const userMessage = mapErrorToUserMessage(error);
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        details: error.message 
      }),
      {
        status: error.message === "INVALID_REQUEST" ? 400 : 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
      }
    );
  }
};

Deno.serve(handler);
