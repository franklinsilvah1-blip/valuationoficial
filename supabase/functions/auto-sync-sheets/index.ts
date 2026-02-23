import { corsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AUTO-SYNC] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Validate cron secret to prevent unauthorized access
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
    logStep("SECURITY: Unauthorized access attempt - invalid cron secret");
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      }
    );
  }

  logStep("Starting automatic sync", { timestamp: new Date().toISOString() });
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    logStep("ERROR: Missing environment variables");
    return new Response(
      JSON.stringify({ success: false, error: "Missing configuration" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }

  try {
    // Chamar sync-google-sheets usando service role
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-google-sheets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'X-Trigger-Type': 'cron'
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      logStep("Sync completed successfully", result);
      return new Response(
        JSON.stringify({ success: true, result }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      logStep("Sync failed", result);
      return new Response(
        JSON.stringify({ success: false, error: result }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
  } catch (error: any) {
    logStep("ERROR calling sync function", { error: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
