import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, whatsapp, utm_source, utm_medium, utm_campaign, utm_content, landing_page, affiliate_code } = await req.json();

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "Nome e email são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert lead by email
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .upsert(
        {
          name,
          email: email.toLowerCase().trim(),
          whatsapp: whatsapp || null,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          utm_content: utm_content || null,
          landing_page: landing_page || "/lp",
          affiliate_code: affiliate_code || null,
          status: "new",
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (insertError) {
      console.error("[CAPTURE-LEAD] Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar lead" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[CAPTURE-LEAD] Lead captured:", lead.id);

    // Send welcome email
    const emailResult = await sendEmail({
      to: email,
      subject: "Bem-vindo à VALUATION! 🎉 Seu acesso gratuito está pronto",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;">
    <div style="background:linear-gradient(135deg,#1a1a1a,#000000);padding:40px 30px;text-align:center;">
      <h1 style="color:#DAA520;margin:0;font-size:28px;">VALUATION</h1>
      <p style="color:#ffffff;margin:8px 0 0;font-size:14px;">Invest Tech</p>
    </div>
    <div style="padding:30px;">
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Olá, ${name}! 👋</h2>
      <p style="color:#444;line-height:1.6;margin:0 0 16px;">
        Obrigado por se cadastrar! Você acaba de dar o primeiro passo para transformar seus investimentos com análises profissionais e carteiras recomendadas.
      </p>
      <h3 style="color:#1a1a1a;margin:24px 0 12px;">O que você pode fazer agora:</h3>
      <ul style="color:#444;line-height:1.8;padding-left:20px;">
        <li>📊 Explorar o <strong>Mercado de Ativos</strong> com análises completas</li>
        <li>📰 Ler nosso <strong>Blog</strong> com conteúdo educativo</li>
        <li>💼 Criar sua conta e acessar a <strong>Plataforma Completa</strong></li>
      </ul>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://valuationit.lovable.app/auth" style="display:inline-block;background:linear-gradient(135deg,#DAA520,#B8860B);color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
          Acessar a Plataforma Grátis
        </a>
      </div>
      <p style="color:#888;font-size:13px;text-align:center;margin-top:24px;">
        Dúvidas? Responda este e-mail ou acesse nosso site.
      </p>
    </div>
    <div style="background:#f0f0f0;padding:20px;text-align:center;">
      <p style="color:#888;font-size:12px;margin:0;">© 2026 VALUATION Invest Tech. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`,
    });

    if (!emailResult.success) {
      console.warn("[CAPTURE-LEAD] Email failed but lead was saved:", emailResult.error);
    }

    return new Response(
      JSON.stringify({ success: true, id: lead.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[CAPTURE-LEAD] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
