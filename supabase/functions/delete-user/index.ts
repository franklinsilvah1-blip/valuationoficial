import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-USER] ${step}${detailsStr}`);
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check if user is admin
    const { data: adminRole, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !adminRole) {
      throw new Error("Unauthorized: Admin access required");
    }
    logStep("Admin status verified");

    // Rate limit: 10 deletes per hour
    await checkRateLimit(user.id, "delete-user", 10, 60);
    logStep("Rate limit check passed");

    // Get userId from request body
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");
    logStep("User to delete", { userId });

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      throw new Error("Cannot delete your own account");
    }

    // Delete user using admin API
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      logStep("Error deleting user", { error: deleteError });
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    logStep("User deleted successfully", { userId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User deleted successfully" 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in delete-user", { message: errorMessage });
    
    const status = errorMessage.includes("Unauthorized") ? 403 
                  : errorMessage.includes("RATE_LIMIT_EXCEEDED") ? 429 
                  : 400;
    
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
