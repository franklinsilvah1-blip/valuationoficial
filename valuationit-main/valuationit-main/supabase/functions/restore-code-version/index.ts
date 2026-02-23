import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sha } = await req.json();
    if (!sha || typeof sha !== "string") {
      return new Response(JSON.stringify({ error: "SHA inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("GITHUB_BACKUP_TOKEN");
    const repo = Deno.env.get("GITHUB_BACKUP_REPO");

    if (!token || !repo) {
      return new Response(JSON.stringify({ error: "GitHub não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghHeaders = {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    // 1. Get the target commit to find its tree
    const commitRes = await fetch(
      `https://api.github.com/repos/${repo}/git/commits/${sha}`,
      { headers: ghHeaders }
    );

    if (!commitRes.ok) {
      return new Response(JSON.stringify({ error: `Commit não encontrado: ${commitRes.status}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const commitData = await commitRes.json();
    const treeSha = commitData.tree.sha;

    // 2. Get the current HEAD to use as parent
    const refRes = await fetch(
      `https://api.github.com/repos/${repo}/git/ref/heads/main`,
      { headers: ghHeaders }
    );

    let branch = "main";
    let currentHeadSha: string;

    if (refRes.ok) {
      const refData = await refRes.json();
      currentHeadSha = refData.object.sha;
    } else {
      // Try master branch
      const masterRes = await fetch(
        `https://api.github.com/repos/${repo}/git/ref/heads/master`,
        { headers: ghHeaders }
      );
      if (!masterRes.ok) {
        return new Response(JSON.stringify({ error: "Branch principal não encontrada" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      branch = "master";
      const masterData = await masterRes.json();
      currentHeadSha = masterData.object.sha;
    }

    // 3. Create a new commit pointing to the old tree
    const shortSha = sha.substring(0, 7);
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${repo}/git/commits`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `revert: Restaurar código para versão ${shortSha}\n\nRestaurado pelo painel admin por ${user.email}`,
          tree: treeSha,
          parents: [currentHeadSha],
        }),
      }
    );

    if (!newCommitRes.ok) {
      const errText = await newCommitRes.text();
      console.error("Failed to create commit:", errText);
      return new Response(JSON.stringify({ error: "Falha ao criar commit de restauração" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newCommit = await newCommitRes.json();

    // 4. Update branch ref to new commit
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({ sha: newCommit.sha }),
      }
    );

    if (!updateRefRes.ok) {
      const errText = await updateRefRes.text();
      console.error("Failed to update ref:", errText);
      return new Response(JSON.stringify({ error: "Falha ao atualizar branch" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Log in audit
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    await adminClient.from("admin_audit_log").insert({
      user_id: user.id,
      action: "code_version_restored",
      metadata: {
        target_sha: sha,
        target_message: commitData.message,
        previous_head: currentHeadSha,
        new_commit: newCommit.sha,
        branch,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        new_commit_sha: newCommit.sha,
        restored_to: sha,
        branch,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
