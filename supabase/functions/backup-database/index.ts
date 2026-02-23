import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CRITICAL_TABLES = [
  "profiles",
  "wallet_simulator",
  "wallet_items",
  "wallet_movements",
  "asset_favorites",
  "affiliates",
  "referrals",
  "commissions",
  "subscription_plans",
  "blog_posts",
  "categories",
  "blog_authors",
];

// Fields to redact from sensitive tables
const REDACTED_FIELDS: Record<string, string[]> = {
  smtp_config: ["smtp_password"],
  app_config: ["value"], // may contain secrets
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate: either cron secret OR authenticated admin
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization");
    
    let isAuthorized = false;
    
    // Check cron secret
    if (cronSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    }
    
    // Check if authenticated admin
    if (!isAuthorized && authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const authClient = createClient(supabaseUrl, serviceRoleKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user) {
        const { data: roles } = await authClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin");
        if (roles && roles.length > 0) {
          isAuthorized = true;
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for backup type
    let backupType = "both"; // "critical", "full", or "both"
    try {
      if (req.method === "POST") {
        const body = await req.json();
        if (body?.type && ["critical", "full", "both"].includes(body.type)) {
          backupType = body.type;
        }
      }
    } catch {
      // No body or invalid JSON, default to "both"
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const githubToken = Deno.env.get("GITHUB_BACKUP_TOKEN")!;
    const githubRepo = Deno.env.get("GITHUB_BACKUP_REPO")!;

    if (!githubToken || !githubRepo) {
      throw new Error("Missing GITHUB_BACKUP_TOKEN or GITHUB_BACKUP_REPO");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date().toISOString().split("T")[0];

    const summary: Record<string, any> = {
      date: today,
      started_at: new Date().toISOString(),
      critical: {},
      full: {},
    };

    // --- Backup 1: Critical tables ---
    if (backupType === "critical" || backupType === "both") {
      console.log("Starting critical tables backup...");
      for (const table of CRITICAL_TABLES) {
        try {
          const { data, error } = await supabase.from(table).select("*");
          if (error) {
            console.error(`Error reading ${table}:`, error.message);
            summary.critical[table] = { error: error.message };
            continue;
          }
          const rows = data || [];
          summary.critical[table] = { count: rows.length };

          await uploadToGitHub(
            githubToken,
            githubRepo,
            `backup/${today}/critical/${table}.json`,
            JSON.stringify(rows, null, 2),
            `Backup critical: ${table} (${rows.length} rows) - ${today}`
          );
          console.log(`Critical backup: ${table} - ${rows.length} rows`);
        } catch (e) {
          console.error(`Failed to backup critical table ${table}:`, e.message);
          summary.critical[table] = { error: e.message };
        }
      }
    }

    if (backupType === "full" || backupType === "both") {
      console.log("Starting full database backup...");

    // Get all table names from the public schema
    const { data: tablesData, error: tablesError } = await supabase.rpc(
      "get_all_table_names"
    );

    let allTables: string[];
    if (tablesError || !tablesData) {
      // Fallback: use known tables from types
      console.warn("Could not fetch table list dynamically, using known tables");
      allTables = [
        ...CRITICAL_TABLES,
        "admin_audit_log",
        "affiliate_clicks",
        "app_config",
        "asset_analyses",
        "asset_views",
        "assets",
        "blog_authors",
        "cancellation_feedback",
        "exclusive_videos",
        "import_jobs",
        "notification_group_members",
        "notification_groups",
        "post_categories",
        "profile_answers",
        "profile_options",
        "profile_questions",
        "push_notifications",
        "push_subscriptions",
        "rate_limit_log",
        "smtp_config",
        "sync_logs",
        "sync_queue",
        "tracking_events",
        "tracking_scripts",
        "user_roles",
      ];
      // Deduplicate
      allTables = [...new Set(allTables)];
    } else {
      allTables = tablesData.map((t: { table_name: string }) => t.table_name);
    }

    for (const table of allTables) {
      try {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.error(`Error reading ${table}:`, error.message);
          summary.full[table] = { error: error.message };
          continue;
        }

        let rows = data || [];

        // Redact sensitive fields
        const fieldsToRedact = REDACTED_FIELDS[table];
        if (fieldsToRedact && rows.length > 0) {
          rows = rows.map((row: Record<string, any>) => {
            const cleaned = { ...row };
            for (const field of fieldsToRedact) {
              if (field in cleaned) {
                cleaned[field] = "[REDACTED]";
              }
            }
            return cleaned;
          });
        }

        summary.full[table] = { count: rows.length };

        const jsonContent = JSON.stringify(rows, null, 2);

        // Split if > 50MB (GitHub limit is 100MB, keep margin)
        const MAX_SIZE = 50 * 1024 * 1024;
        if (jsonContent.length > MAX_SIZE) {
          const chunkSize = 5000;
          const totalChunks = Math.ceil(rows.length / chunkSize);
          for (let i = 0; i < totalChunks; i++) {
            const chunk = rows.slice(i * chunkSize, (i + 1) * chunkSize);
            await uploadToGitHub(
              githubToken,
              githubRepo,
              `backup/${today}/full/${table}_part${i + 1}.json`,
              JSON.stringify(chunk, null, 2),
              `Backup full: ${table} part ${i + 1}/${totalChunks} - ${today}`
            );
          }
          summary.full[table].chunks = totalChunks;
        } else {
          await uploadToGitHub(
            githubToken,
            githubRepo,
            `backup/${today}/full/${table}.json`,
            jsonContent,
            `Backup full: ${table} (${rows.length} rows) - ${today}`
          );
        }

        console.log(`Full backup: ${table} - ${rows.length} rows`);
      } catch (e) {
        console.error(`Failed to backup table ${table}:`, e.message);
        summary.full[table] = { error: e.message };
      }
    }
    } // end full backup block

    // Merge with existing summary if partial backup
    if (backupType !== "both") {
      try {
        const summaryUrl = `https://api.github.com/repos/${githubRepo}/contents/backup/${today}/summary.json`;
        const existingRes = await fetch(summaryUrl, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          const existingContent = JSON.parse(
            decodeURIComponent(escape(atob(existingData.content.replace(/\n/g, ""))))
          );
          if (backupType === "critical" && existingContent.full && Object.keys(existingContent.full).length > 0) {
            summary.full = existingContent.full;
          } else if (backupType === "full" && existingContent.critical && Object.keys(existingContent.critical).length > 0) {
            summary.critical = existingContent.critical;
          }
          // Preserve started_at from first backup of the day
          if (existingContent.started_at) {
            summary.first_backup_at = existingContent.first_backup_at || existingContent.started_at;
          }
        } else {
          await existingRes.text();
        }
      } catch (mergeErr) {
        console.error("Failed to merge existing summary:", mergeErr.message);
      }
    }

    // Upload summary
    summary.completed_at = new Date().toISOString();
    await uploadToGitHub(
      githubToken,
      githubRepo,
      `backup/${today}/summary.json`,
      JSON.stringify(summary, null, 2),
      `Backup summary - ${today}`
    );

    // --- Retention cleanup ---
    try {
      const { data: retentionConfig } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "backup_retention_days")
        .maybeSingle();

      const retentionDays = retentionConfig ? parseInt(retentionConfig.value) : 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      // List backup directories
      const backupsUrl = `https://api.github.com/repos/${githubRepo}/contents/backup`;
      const listRes = await fetch(backupsUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (listRes.ok) {
        const dirs = await listRes.json();
        const oldDirs = dirs.filter(
          (d: any) => d.type === "dir" && d.name < cutoffStr
        );

        for (const dir of oldDirs) {
          try {
            await deleteGitHubDirectory(githubToken, githubRepo, `backup/${dir.name}`);
            console.log(`Retention cleanup: deleted backups/${dir.name}`);
          } catch (cleanupErr) {
            console.error(`Failed to delete old backup ${dir.name}:`, cleanupErr.message);
          }
        }

        if (oldDirs.length > 0) {
          summary.retention_cleanup = { deleted: oldDirs.map((d: any) => d.name) };
        }
      } else {
        await listRes.text();
      }
    } catch (retentionErr) {
      console.error("Retention cleanup error:", retentionErr.message);
    }

    console.log("Backup completed successfully");

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Backup failed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function uploadToGitHub(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;

  // Check if file exists (to get SHA for update)
  let sha: string | undefined;
  try {
    const existing = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    } else {
      await existing.text(); // consume body
    }
  } catch {
    // File doesn't exist yet, that's fine
  }

  const body: Record<string, string> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error for ${path}: ${response.status} - ${errorText}`);
  } else {
    await response.text(); // consume body
  }
}

async function deleteGitHubDirectory(
  token: string,
  repo: string,
  dirPath: string
): Promise<void> {
  // List all files in the directory
  const url = `https://api.github.com/repos/${repo}/contents/${dirPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    await res.text();
    return;
  }

  const items = await res.json();

  for (const item of items) {
    if (item.type === "dir") {
      await deleteGitHubDirectory(token, repo, item.path);
    } else {
      const deleteRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${item.path}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Retention cleanup: delete ${item.path}`,
            sha: item.sha,
          }),
        }
      );
      if (!deleteRes.ok) {
        await deleteRes.text();
      } else {
        await deleteRes.text();
      }
    }
  }
}
