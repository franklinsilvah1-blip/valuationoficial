import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SKIP_TABLES = ["smtp_config", "app_config", "user_roles"];

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

    // Fetch backup files from GitHub
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
    const results: Record<string, { deleted: number; inserted: number; error?: string }> = {};
    let totalInserted = 0;
    let totalDeleted = 0;
    let skipped: string[] = [];

    for (const item of items) {
      if (item.type !== "file" || !item.name.endsWith(".json")) continue;
      const tableName = item.name.replace(".json", "");

      // Skip sensitive/config tables
      if (SKIP_TABLES.includes(tableName) || tableName === "summary") {
        skipped.push(tableName);
        continue;
      }

      try {
        // Fetch file content from GitHub
        const fileRes = await fetch(item.url, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        if (!fileRes.ok) {
          results[tableName] = { deleted: 0, inserted: 0, error: `GitHub fetch failed: ${fileRes.status}` };
          continue;
        }

        const fileData = await fileRes.json();
        const decoded = atob(fileData.content.replace(/\n/g, ""));
        const records = JSON.parse(decoded);

        if (!Array.isArray(records) || records.length === 0) {
          results[tableName] = { deleted: 0, inserted: 0, error: "Empty or invalid data" };
          continue;
        }

        // Check for redacted values - skip if found
        const hasRedacted = records.some((r: any) =>
          Object.values(r).some((v) => typeof v === "string" && v.includes("[REDACTED]"))
        );
        if (hasRedacted) {
          skipped.push(tableName);
          continue;
        }

        // Delete existing data
        const { count: deletedCount, error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all rows
          .select("id", { count: "exact", head: true });

        if (deleteError) {
          results[tableName] = { deleted: 0, inserted: 0, error: `Delete failed: ${deleteError.message}` };
          continue;
        }

        // Insert backup data in batches of 500
        let insertedCount = 0;
        const batchSize = 500;
        let insertError: string | undefined;

        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          const { error: batchError } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

          if (batchError) {
            insertError = `Insert batch failed at ${i}: ${batchError.message}`;
            break;
          }
          insertedCount += batch.length;
        }

        const deleted = deletedCount || 0;
        totalDeleted += deleted;
        totalInserted += insertedCount;
        results[tableName] = { deleted, inserted: insertedCount, ...(insertError && { error: insertError }) };
      } catch (err) {
        results[tableName] = { deleted: 0, inserted: 0, error: err.message };
      }
    }

    // Audit log
    await supabase.from("admin_audit_log").insert({
      user_id: user.id,
      action: "backup_restored",
      metadata: {
        date,
        type,
        total_inserted: totalInserted,
        total_deleted: totalDeleted,
        skipped,
        results,
        restored_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        date,
        type,
        total_inserted: totalInserted,
        total_deleted: totalDeleted,
        skipped,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Restore backup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
