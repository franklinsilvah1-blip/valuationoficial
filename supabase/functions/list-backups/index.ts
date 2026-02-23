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

    const githubToken = Deno.env.get("GITHUB_BACKUP_TOKEN")!;
    const githubRepo = Deno.env.get("GITHUB_BACKUP_REPO")!;

    if (!githubToken || !githubRepo) {
      throw new Error("Missing GITHUB_BACKUP_TOKEN or GITHUB_BACKUP_REPO");
    }

    // List directories inside backups/
    const url = `https://api.github.com/repos/${githubRepo}/contents/backup`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({ backups: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
    }

    const contents = await response.json();
    const dirs = contents.filter((item: any) => item.type === "dir");

    // Fetch summary.json for each backup date (limit to last 30)
    const sortedDirs = dirs
      .map((d: any) => d.name)
      .sort()
      .reverse()
      .slice(0, 30);

    const backups = [];

    for (const date of sortedDirs) {
      try {
        const summaryUrl = `https://api.github.com/repos/${githubRepo}/contents/backup/${date}/summary.json`;
        const summaryRes = await fetch(summaryUrl, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (summaryRes.ok) {
          const summaryFile = await summaryRes.json();
          const decoded = atob(summaryFile.content.replace(/\n/g, ""));
          const summary = JSON.parse(decoded);
          backups.push({ date, ...summary });
        } else {
          await summaryRes.text();
          backups.push({ date, critical: {}, full: {} });
        }
      } catch {
        backups.push({ date, critical: {}, full: {} });
      }
    }

    return new Response(JSON.stringify({ backups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("List backups error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
