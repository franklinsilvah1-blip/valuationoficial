import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptPassword } from "../_shared/crypto.ts";

interface SMTPConfig {
  smtp_server: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  sender_name: string;
  sender_email: string;
  security_type: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) throw new Error("Não autenticado");

    // Check if user is admin
    const { data: isAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      throw new Error("Acesso negado");
    }

    const config: SMTPConfig = await req.json();

    // Validate required fields
    if (!config.smtp_server || !config.smtp_user || !config.smtp_password || !config.sender_email) {
      throw new Error("Campos obrigatórios ausentes");
    }

    // Encrypt the password before storing
    console.log("[SAVE-SMTP-CONFIG] Encrypting SMTP password...");
    const encryptedPassword = await encryptPassword(config.smtp_password);
    console.log("[SAVE-SMTP-CONFIG] Password encrypted successfully");

    // Check if config exists
    const { data: existing } = await supabaseClient
      .from("smtp_config")
      .select("id")
      .single();

    if (existing) {
      // Update existing config
      const { error: updateError } = await supabaseClient
        .from("smtp_config")
        .update({
          smtp_server: config.smtp_server,
          smtp_port: config.smtp_port,
          smtp_user: config.smtp_user,
          smtp_password: encryptedPassword,
          sender_name: config.sender_name,
          sender_email: config.sender_email,
          security_type: config.security_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      // Insert new config
      const { error: insertError } = await supabaseClient
        .from("smtp_config")
        .insert({
          smtp_server: config.smtp_server,
          smtp_port: config.smtp_port,
          smtp_user: config.smtp_user,
          smtp_password: encryptedPassword,
          sender_name: config.sender_name,
          sender_email: config.sender_email,
          security_type: config.security_type,
        });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Configuração SMTP salva com sucesso" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in save-smtp-config:", error);
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
