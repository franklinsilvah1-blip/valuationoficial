import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";

type EmailType = "welcome" | "new_commission" | "commission_paid" | "approved" | "rejected";

interface AffiliateEmailRequest {
  affiliateId?: string;
  userId?: string;
  emailType: EmailType;
  commissionAmount?: number;
  affiliateCode?: string;
  referralLink?: string;
  rejectionReason?: string;
}

const LOGO_URL = "https://valuationit.com.br/logo.webp";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-AFFILIATE-EMAIL] ${step}${detailsStr}`);
};

// Cores primárias: preto (#1a1a1a) e dourado (#D4A506)
function generateEmailTemplate(title: string, headerColor: string, content: string, ctaText?: string, ctaLink?: string): string {
  const ctaButton = ctaText && ctaLink 
    ? `<div style="text-align: center;"><a href="${ctaLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); color: white; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">${ctaText}</a></div>`
    : "";

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f8; margin: 0; padding: 20px;"><div style="max-width: 600px; margin: 0 auto;"><div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);"><div style="background: #ffffff; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;"><img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;"><h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">${title}</h1></div><div style="padding: 40px 30px;">${content}${ctaButton}</div><div style="text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px;"><img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;"><p style="margin: 0 0 5px 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p><p style="margin: 0; color: #cccccc;">Este é um e-mail automático.</p></div></div></div></body></html>`;
}

function generateWelcomeEmail(name: string, code: string, link: string): { subject: string; html: string } {
  return { subject: "🎉 Bem-vindo ao Programa de Afiliados", html: generateEmailTemplate("Bem-vindo!", "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", `<p>Olá <strong>${name}</strong>,</p><p>Sua conta foi ativada!</p><p><strong>Código:</strong> ${code}</p><p><strong>Link:</strong> ${link}</p>`, "Acessar Painel", link) };
}

function generateNewCommissionEmail(name: string, amount: number): { subject: string; html: string } {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  return { subject: "🎉 Nova comissão gerada!", html: generateEmailTemplate("Nova Comissão!", "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", `<p>Olá <strong>${name}</strong>,</p><p>Você gerou uma comissão de <strong>${formatted}</strong>!</p>`, "Ver Comissões", "https://valuationit.com.br/app/afiliado") };
}

function generateCommissionPaidEmail(name: string, amount: number): { subject: string; html: string } {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  return { subject: "💸 Pagamento processado!", html: generateEmailTemplate("Pagamento!", "linear-gradient(135deg, #059669 0%, #10b981 100%)", `<p>Olá <strong>${name}</strong>,</p><p>Seu pagamento de <strong>${formatted}</strong> foi processado!</p>`, "Ver Histórico", "https://valuationit.com.br/app/afiliado") };
}

function generateApprovedEmail(name: string, code: string, link: string): { subject: string; html: string } {
  return { subject: "✅ Conta aprovada!", html: generateEmailTemplate("Aprovado!", "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", `<p>Olá <strong>${name}</strong>,</p><p>Sua conta foi aprovada!</p><p><strong>Código:</strong> ${code}</p><p><strong>Link:</strong> ${link}</p>`, "Acessar Painel", "https://valuationit.com.br/app/afiliado") };
}

function generateRejectedEmail(name: string, reason?: string): { subject: string; html: string } {
  return { subject: "❌ Solicitação não aprovada", html: generateEmailTemplate("Não Aprovado", "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)", `<p>Olá <strong>${name}</strong>,</p><p>Sua solicitação não foi aprovada.</p>${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ""}`, "Contato", "https://valuationit.com.br/contato") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    logStep("Function started");
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const data: AffiliateEmailRequest = await req.json();
    logStep("Request", { emailType: data.emailType });

    if (!data.emailType) throw new Error("emailType obrigatório");

    const senderConfig = await getSenderConfig(supabaseClient);
    let affiliateEmail = "", affiliateName = "", affiliateCode = "";

    if (data.affiliateId) {
      const { data: affiliate } = await supabaseClient.from("affiliates").select("affiliate_code, user_id").eq("id", data.affiliateId).single();
      if (!affiliate) throw new Error("Afiliado não encontrado");
      affiliateCode = affiliate.affiliate_code;
      const { data: profile } = await supabaseClient.from("profiles").select("name, email").eq("id", affiliate.user_id).single();
      affiliateEmail = profile?.email || "";
      affiliateName = profile?.name || "Afiliado";
    } else if (data.userId) {
      const { data: affiliate } = await supabaseClient.from("affiliates").select("affiliate_code").eq("user_id", data.userId).single();
      if (!affiliate) throw new Error("Afiliado não encontrado");
      affiliateCode = affiliate.affiliate_code;
      const { data: profile } = await supabaseClient.from("profiles").select("name, email").eq("id", data.userId).single();
      affiliateEmail = profile?.email || "";
      affiliateName = profile?.name || "Afiliado";
    } else throw new Error("affiliateId ou userId obrigatório");

    if (!affiliateEmail) throw new Error("E-mail não encontrado");

    const referralLink = data.referralLink || `https://valuationit.com.br?ref=${affiliateCode}`;
    let emailContent: { subject: string; html: string };

    switch (data.emailType) {
      case "welcome": emailContent = generateWelcomeEmail(affiliateName, affiliateCode, referralLink); break;
      case "new_commission": emailContent = generateNewCommissionEmail(affiliateName, data.commissionAmount || 0); break;
      case "commission_paid": emailContent = generateCommissionPaidEmail(affiliateName, data.commissionAmount || 0); break;
      case "approved": emailContent = generateApprovedEmail(affiliateName, affiliateCode, referralLink); break;
      case "rejected": emailContent = generateRejectedEmail(affiliateName, data.rejectionReason); break;
      default: throw new Error(`Tipo não suportado: ${data.emailType}`);
    }

    const result = await sendEmail({ to: affiliateEmail, subject: emailContent.subject, html: emailContent.html, from: senderConfig || undefined });
    if (!result.success) throw new Error(result.error);

    logStep("Email sent", { messageId: result.messageId });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro";
    logStep("ERROR", { error: msg });
    return new Response(JSON.stringify({ error: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
