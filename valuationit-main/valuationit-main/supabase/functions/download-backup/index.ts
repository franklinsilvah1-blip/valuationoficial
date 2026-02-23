import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { date, type } = await req.json();
    if (!date || !type || !["critical", "full"].includes(type)) {
      return new Response(JSON.stringify({ error: "Missing date or type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const githubToken = Deno.env.get("GITHUB_BACKUP_TOKEN")!;
    const githubRepo = Deno.env.get("GITHUB_BACKUP_REPO")!;

    // List files in the backup directory
    const dirUrl = `https://api.github.com/repos/${githubRepo}/contents/backup/${date}/${type}`;
    const dirRes = await fetch(dirUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!dirRes.ok) {
      const errText = await dirRes.text();
      throw new Error(`Backup not found: ${dirRes.status} - ${errText}`);
    }

    const items = await dirRes.json();
    const files: Record<string, any> = {};

    // Fetch each file's content
    for (const item of items) {
      if (item.type !== "file") continue;
      try {
        const fileRes = await fetch(item.url, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          const decoded = atob(fileData.content.replace(/\n/g, ""));
          const tableName = item.name.replace(".json", "");
          files[tableName] = JSON.parse(decoded);
        } else {
          await fileRes.text();
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    return new Response(JSON.stringify({ date, type, files }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Download backup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
