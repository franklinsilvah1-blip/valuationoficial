import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";

const LOGO_URL = "https://valuationit.com.br/logo.webp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error("Não autenticado");

    const { data: isAdmin } = await supabaseClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");

    const { testEmail } = await req.json();
    const senderConfig = await getSenderConfig(supabaseClient);

    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Teste de E-mail</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f8; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      <div style="background: #ffffff; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 3px solid #D4A506;">
        <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
        <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">✅ Teste de E-mail OK!</h1>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Se você recebeu este e-mail, a configuração de envio está funcionando corretamente.</p>
        <p style="font-size: 14px; color: #6b7280; margin: 0;"><strong>Data:</strong> ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
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

    const result = await sendEmail({
      to: testEmail,
      subject: "✅ Teste de E-mail - VALUATION",
      html: emailHtml,
      from: senderConfig || undefined,
    });

    if (!result.success) throw new Error(result.error);

    return new Response(JSON.stringify({ success: true, message: "E-mail enviado!" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro";
    return new Response(JSON.stringify({ error: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
