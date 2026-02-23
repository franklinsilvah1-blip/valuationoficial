import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMinutes: number
): Promise<void> {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Check if user is admin - admins have no rate limit
  const { data: isAdmin } = await supabaseClient.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (isAdmin) {
    const { maskId } = await import("./logger.ts");
    console.log(`Rate limit bypassed for admin user: ${maskId(userId)}`);
    return;
  }

  const windowStart = new Date(Date.now() - windowMinutes * 60000);

  // Count requests in the time window
  const { count, error: countError } = await supabaseClient
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStart.toISOString());

  if (countError) {
    console.error("Rate limit check error:", countError);
    // FAIL CLOSED - block request on error to prevent bypass
    throw new Error("RATE_LIMIT_CHECK_FAILED");
  }

  if (count !== null && count >= maxRequests) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  // Log this request
  await supabaseClient.from("rate_limit_log").insert({
    user_id: userId,
    endpoint,
    window_start: new Date().toISOString(),
  });
}
