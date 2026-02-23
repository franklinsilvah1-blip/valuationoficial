// Centralized email sending utility using Resend HTTP API
// This replaces all direct SMTP connections which have proven unreliable
// in the Deno/Edge Functions environment due to TLS handshake issues.

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: {
    name: string;
    email: string;
  };
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using Resend HTTP API
 * More reliable than SMTP in edge function environments
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    console.error("[EMAIL] RESEND_API_KEY not configured");
    return {
      success: false,
      error: "RESEND_API_KEY não está configurada. Configure nas secrets do projeto.",
    };
  }

  // Build the from address
  const fromName = options.from?.name || "Franklin Silva";
  const fromEmail = options.from?.email || "noreply@valuationit.com.br";
  const from = `${fromName} <${fromEmail}>`;

  // Normalize recipients to array
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  console.log(`[EMAIL] Sending email via Resend`, {
    to: recipients.map(e => e.slice(0, 3) + "***").join(", "),
    subject: options.subject.slice(0, 50),
    from: fromName,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[EMAIL] Resend API error:", data);
      return {
        success: false,
        error: data.message || data.error || "Erro ao enviar e-mail via Resend",
      };
    }

    console.log(`[EMAIL] Email sent successfully`, { 
      messageId: data.id,
    });

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao enviar e-mail";
    console.error("[EMAIL] Exception sending email:", errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Helper to get sender configuration from smtp_config table
 * This maintains backward compatibility with existing SMTP configuration
 * while using only the sender identity (not the SMTP connection)
 */
export async function getSenderConfig(supabaseClient: any): Promise<{
  name: string;
  email: string;
} | null> {
  try {
    const { data: smtpConfig, error } = await supabaseClient
      .from("smtp_config")
      .select("sender_name, sender_email")
      .single();

    if (error || !smtpConfig) {
      console.warn("[EMAIL] No smtp_config found, using defaults");
      return null;
    }

    return {
      name: smtpConfig.sender_name,
      email: smtpConfig.sender_email,
    };
  } catch (error) {
    console.error("[EMAIL] Error fetching sender config:", error);
    return null;
  }
}
