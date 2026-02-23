import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle, XCircle, Loader2, Database, Download } from "lucide-react";

const TABLES_TO_MIGRATE = [
  "categories",
  "blog_authors",
  "subscription_plans",
  "profile_questions",
  "profile_options",
  "app_config",
  "notification_groups",
  "tracking_scripts",
  "smtp_config",
  "profiles",
  "user_roles",
  "admin_audit_log",
  "assets",
  "asset_analyses",
  "exclusive_videos",
  "asset_favorites",
  "asset_views",
  "wallet_simulator",
  "wallet_items",
  "wallet_movements",
  "blog_posts",
  "post_categories",
  "affiliates",
  "affiliate_clicks",
  "referrals",
  "commissions",
  "notification_group_members",
  "push_subscriptions",
  "push_notifications",
  "tracking_events",
  "leads",
  "cancellation_feedback",
  "profile_answers",
  "rate_limit_log",
  "sync_logs",
  "sync_queue",
  "import_jobs",
] as const;

type LogEntry = {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "warn";
};

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    // Postgres array literal
    const items = value.map((v) =>
      typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : String(v)
    );
    return `'${`{${items.join(",")}}`}'`;
  }
  if (typeof value === "object") {
    // JSONB
    const json = JSON.stringify(value).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  // String — escape single quotes
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

function buildInsert(table: string, row: Record<string, unknown>): string {
  // Remove site_id
  const entries = Object.entries(row).filter(([key]) => key !== "site_id");
  const cols = entries.map(([k]) => `"${k}"`).join(", ");
  const vals = entries.map(([, v]) => escapeSQL(v)).join(", ");
  return `INSERT INTO public."${table}" (${cols}) VALUES (${vals});`;
}

export default function AdminMigration() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState<string | null>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("pt-BR");
    setLogs((prev) => [...prev, { time, message, type }]);
  }, []);

  const generateSQL = useCallback(async () => {
    setRunning(true);
    setLogs([]);
    setProgress(0);

    const sqlParts: string[] = [
      "-- ===========================================",
      "-- Migração Valuation IT — gerado em " + new Date().toISOString(),
      "-- ===========================================",
      "",
      "BEGIN;",
      "",
    ];

    const total = TABLES_TO_MIGRATE.length;
    let totalRows = 0;

    for (let i = 0; i < total; i++) {
      const table = TABLES_TO_MIGRATE[i];
      setCurrentTable(table);
      addLog(`📦 Lendo "${table}"...`, "info");

      const { data, error } = await (supabase.from(table) as any).select("*");

      if (error) {
        addLog(`❌ Erro ao ler "${table}": ${error.message}`, "error");
        setProgress(((i + 1) / total) * 100);
        continue;
      }

      if (!data || data.length === 0) {
        addLog(`⚠️ "${table}" vazia, pulando.`, "warn");
        setProgress(((i + 1) / total) * 100);
        continue;
      }

      sqlParts.push(`-- Tabela: ${table} (${data.length} registros)`);
      for (const row of data) {
        sqlParts.push(buildInsert(table, row));
      }
      sqlParts.push("");

      totalRows += data.length;
      addLog(`✅ "${table}": ${data.length} registros processados.`, "success");
      setProgress(((i + 1) / total) * 100);
    }

    sqlParts.push("COMMIT;");

    // Download
    const blob = new Blob([sqlParts.join("\n")], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "migracao_valuation.sql";
    a.click();
    URL.revokeObjectURL(url);

    addLog(`🏁 Arquivo gerado com ${totalRows} registros no total!`, "success");
    setCurrentTable(null);
    setRunning(false);
  }, [addLog]);

  const logIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
      case "warn": return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
      default: return <Database className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Ferramenta de Migração — SQL Dump
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Lê todas as tabelas do banco original e gera um arquivo <code>.sql</code> com INSERTs
            prontos para executar no banco da VPS. A coluna <code>site_id</code> é omitida.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={generateSQL} disabled={running} size="lg">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando {currentTable}...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Gerar Arquivo SQL de Migração
                </>
              )}
            </Button>
            {running && <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>}
          </div>

          {(running || progress > 0) && <Progress value={progress} className="h-3" />}

          {logs.length > 0 && (
            <ScrollArea className="h-80 rounded-md border p-3 bg-muted/30">
              <div className="space-y-1.5 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {logIcon(log.type)}
                    <span className="text-muted-foreground">[{log.time}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
