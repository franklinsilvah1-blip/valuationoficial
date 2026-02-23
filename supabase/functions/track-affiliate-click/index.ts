import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate and sanitize a URL string
const sanitizeUrl = (url: string | null, allowedDomain?: string): string | null => {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim().substring(0, 2048); // Max URL length
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (allowedDomain && !parsed.hostname.endsWith(allowedDomain)) return null;
    return trimmed;
  } catch {
    return null;
  }
};

// Validate string input with max length
const sanitizeString = (value: unknown, maxLength: number): string | null => {
  if (!value || typeof value !== "string") return null;
  return value.trim().substring(0, maxLength) || null;
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const affiliateCode = sanitizeString(body.affiliateCode, 50);

    if (!affiliateCode) {
      console.log("No affiliate code provided");
      return new Response(
        JSON.stringify({ success: false, error: "Affiliate code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate affiliate code format (alphanumeric only)
    if (!/^[A-Za-z0-9]+$/.test(affiliateCode)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid affiliate code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Tracking click for affiliate code: ${affiliateCode}`);

    // Find the affiliate by code
    const { data: affiliate, error: affiliateError } = await supabase
      .from("affiliates")
      .select("id, status")
      .eq("affiliate_code", affiliateCode.toUpperCase())
      .maybeSingle();

    if (affiliateError) {
      console.error("Error finding affiliate:", affiliateError);
      return new Response(
        JSON.stringify({ success: false, error: "Error finding affiliate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!affiliate) {
      console.log(`Affiliate not found for code: ${affiliateCode}`);
      return new Response(
        JSON.stringify({ success: false, error: "Affiliate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (affiliate.status !== "active") {
      console.log(`Affiliate is not active: ${affiliateCode}`);
      return new Response(
        JSON.stringify({ success: false, error: "Affiliate is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP and User Agent from server-side headers (don't trust client)
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      req.headers.get("cf-connecting-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Rate limit: max 10 clicks per IP per affiliate per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentClicks } = await supabase
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", affiliate.id)
      .eq("ip_address", ipAddress)
      .gte("created_at", oneHourAgo);

    if (recentClicks !== null && recentClicks >= 10) {
      console.log(`Rate limit exceeded for IP ${ipAddress} on affiliate ${affiliateCode}`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize client-supplied data; generate server-side session ID
    const sanitizedLandingPage = sanitizeUrl(body.landingPage);
    const sanitizedReferrer = sanitizeUrl(body.referrer);
    const serverSessionId = `${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;

    // Insert click record with validated data
    const { error: insertError } = await supabase
      .from("affiliate_clicks")
      .insert({
        affiliate_id: affiliate.id,
        affiliate_code: affiliateCode.toUpperCase(),
        ip_address: ipAddress,
        user_agent: userAgent.substring(0, 512),
        referrer: sanitizedReferrer,
        landing_page: sanitizedLandingPage,
        session_id: serverSessionId,
      });
    if (insertError) {
      console.error("Error inserting click:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Error recording click" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Click recorded successfully for affiliate: ${affiliateCode}`);

    return new Response(
      JSON.stringify({ success: true, message: "Click tracked successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
