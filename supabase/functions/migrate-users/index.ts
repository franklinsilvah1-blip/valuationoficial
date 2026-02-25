import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name");

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    const results: { email: string; status: string; error?: string }[] = [];
    const defaultPassword = "Valuation@2025";

    for (const profile of profiles) {
      if (!profile.email) {
        results.push({ email: "N/A", status: "skipped", error: "No email" });
        continue;
      }

      try {
        const { data, error } = await supabase.auth.admin.createUser({
          id: profile.id,
          email: profile.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: { name: profile.name },
        });

        if (error) {
          results.push({ email: profile.email, status: "error", error: error.message });
        } else {
          results.push({ email: profile.email, status: "created" });
        }
      } catch (err) {
        results.push({ email: profile.email, status: "error", error: String(err) });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const errors = results.filter((r) => r.status === "error").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return new Response(
      JSON.stringify({
        summary: { total: profiles.length, created, errors, skipped },
        details: results,
        note: `Senha temporária padrão: ${defaultPassword} — Os usuários devem resetar via "Esqueci minha senha".`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
