import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { key, value } = await req.json();

  if (!key || !value) {
    return new Response(JSON.stringify({ error: "key and value required" }), { status: 400 });
  }

  const { error } = await supabase
    .from("app_config")
    .update({ value })
    .eq("key", key);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, key }), {
    headers: { "Content-Type": "application/json" },
  });
});
