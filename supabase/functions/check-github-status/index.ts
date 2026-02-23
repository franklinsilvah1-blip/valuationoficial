import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const githubToken = Deno.env.get("GITHUB_BACKUP_TOKEN");
    const githubRepo = Deno.env.get("GITHUB_BACKUP_REPO");

    if (!githubToken || !githubRepo) {
      return new Response(JSON.stringify({
        connected: false,
        reason: "GITHUB_BACKUP_TOKEN ou GITHUB_BACKUP_REPO não configurados",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check repo access
    const repoUrl = `https://api.github.com/repos/${githubRepo}`;
    const res = await fetch(repoUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({
        connected: false,
        reason: `Erro ao acessar repositório: ${res.status}`,
        repo: githubRepo,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoData = await res.json();

    return new Response(JSON.stringify({
      connected: true,
      repo: githubRepo,
      repo_url: repoData.html_url,
      visibility: repoData.private ? "privado" : "público",
      default_branch: repoData.default_branch,
      updated_at: repoData.updated_at,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ connected: false, reason: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
