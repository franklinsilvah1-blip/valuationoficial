import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { HardDrive, Download, Shield, Database, Settings, RefreshCw, ArrowLeft, Calendar, Clock, Layers, RotateCcw, GitBranch, Trash2, Github, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
interface BackupSummary {
  date: string;
  critical: Record<string, { count?: number; error?: string }>;
  full: Record<string, { count?: number; error?: string; chunks?: number }>;
  started_at?: string;
  completed_at?: string;
}

interface CodeVersion {
  sha: string;
  date: string;
  message: string;
  author: string;
}

interface ManualBackupState {
  date: string;
  tables: number;
  records: number;
}

const AdminBackups = () => {
  const { isAdmin, loading } = useAdminCheck();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [backingUpCritical, setBackingUpCritical] = useState(false);
  const [backingUpFull, setBackingUpFull] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{ date: string; type: "critical" | "full"; tables: number; records: number } | null>(null);
  const [codeRestoreDialog, setCodeRestoreDialog] = useState<CodeVersion | null>(null);
  const [restoringCode, setRestoringCode] = useState(false);
  const [manualCritical, setManualCritical] = useState<ManualBackupState | null>(null);
  const [manualFull, setManualFull] = useState<ManualBackupState | null>(null);
  const [downloadingManual, setDownloadingManual] = useState<string | null>(null);

  const [versionDateFilter, setVersionDateFilter] = useState("");
  const [versionPage, setVersionPage] = useState(1);
  const VERSIONS_PER_PAGE = 10;

  const [backupEnabled, setBackupEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);

  // Load config from app_config
  const { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ["backup-config"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_config")
        .select("key, value")
        .in("key", ["backup_enabled", "backup_retention_days"]);
      return data || [];
    },
  });

  useEffect(() => {
    if (configData) {
      const enabled = configData.find((c) => c.key === "backup_enabled");
      const retention = configData.find((c) => c.key === "backup_retention_days");
      if (enabled) setBackupEnabled(enabled.value === "true");
      if (retention) setRetentionDays(parseInt(retention.value) || 30);
    }
  }, [configData]);

  // List backups from edge function
  const { data: backups, isLoading: loadingBackups, refetch: refetchBackups } = useQuery({
    queryKey: ["backup-list"],
    enabled: isAdmin,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-backups");
      if (error) throw error;
      return (data?.backups || []) as BackupSummary[];
    },
  });

  // List code versions from GitHub
  const { data: codeVersions, isLoading: loadingVersions, refetch: refetchVersions } = useQuery({
    queryKey: ["code-versions"],
    enabled: isAdmin,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-code-versions");
      if (error) throw error;
      return (data?.versions || []) as CodeVersion[];
    },
  });

  // Check GitHub connection status
  const { data: githubStatus, isLoading: loadingGithub } = useQuery({
    queryKey: ["github-status"],
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-github-status");
      if (error) throw error;
      return data as {
        connected: boolean;
        reason?: string;
        repo?: string;
        repo_url?: string;
        visibility?: string;
        default_branch?: string;
        updated_at?: string;
      };
    },
  });

  const handleRestoreCode = async (version: CodeVersion) => {
    try {
      setRestoringCode(true);
      setCodeRestoreDialog(null);
      const { data, error } = await supabase.functions.invoke("restore-code-version", {
        body: { sha: version.sha },
      });
      if (error) throw error;

      toast({
        title: "Código restaurado",
        description: `Site restaurado para a versão ${version.sha.substring(0, 7)}. O Lovable sincronizará automaticamente.`,
      });
      refetchVersions();
    } catch (error: any) {
      toast({ title: "Erro na restauração", description: error.message, variant: "destructive" });
    } finally {
      setRestoringCode(false);
    }
  };

  const handleBackup = async (type: "critical" | "full") => {
    const setter = type === "critical" ? setBackingUpCritical : setBackingUpFull;
    try {
      setter(true);
      const { data, error } = await supabase.functions.invoke("backup-database", {
        body: { type },
      });
      if (error) throw error;

      const section = type === "critical" ? data?.critical : data?.full;
      const tables = section ? Object.keys(section as Record<string, any>).filter((k: string) => (section as any)[k]?.count !== undefined).length : 0;
      const totalRows = section
        ? (Object.values(section as Record<string, any>) as any[]).reduce((sum: number, t: any) => sum + (t.count || 0), 0) as number
        : 0;

      const manualState: ManualBackupState = {
        date: data?.date || new Date().toISOString().split("T")[0],
        tables,
        records: totalRows,
      };

      if (type === "critical") {
        setManualCritical(manualState);
      } else {
        setManualFull(manualState);
      }

      toast({
        title: "Backup concluído",
        description: `${type === "critical" ? "Crítico" : "Completo"}: ${totalRows} registros exportados`,
      });
      refetchBackups();
    } catch (error: any) {
      toast({ title: "Erro no backup", description: error.message, variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  const handleDownloadManualBackup = async (type: "critical" | "full") => {
    const manual = type === "critical" ? manualCritical : manualFull;
    if (!manual) return;
    try {
      setDownloadingManual(type);
      const { data, error } = await supabase.functions.invoke("download-backup", {
        body: { date: manual.date, type },
      });
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data.files, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${type}-${manual.date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Download concluído", description: `Backup ${type} de ${manual.date} baixado com sucesso` });
    } catch (error: any) {
      toast({ title: "Erro no download", description: error.message, variant: "destructive" });
    } finally {
      setDownloadingManual(null);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      const now = new Date().toISOString();

      await supabase.from("app_config").upsert(
        { key: "backup_enabled", value: String(backupEnabled), updated_at: now },
        { onConflict: "key" }
      );
      await supabase.from("app_config").upsert(
        { key: "backup_retention_days", value: String(retentionDays), updated_at: now },
        { onConflict: "key" }
      );

      toast({ title: "Configurações salvas", description: "As configurações de backup foram atualizadas" });
      queryClient.invalidateQueries({ queryKey: ["backup-config"] });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDownloadBackup = async (date: string, type: "critical" | "full") => {
    const key = `${date}-${type}`;
    try {
      setDownloading(key);
      const { data, error } = await supabase.functions.invoke("download-backup", {
        body: { date, type },
      });
      if (error) throw error;

      // Create a blob and trigger download
      const blob = new Blob([JSON.stringify(data.files, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${type}-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Download concluído", description: `Backup ${type} de ${date} baixado com sucesso` });
    } catch (error: any) {
      toast({ title: "Erro no download", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleRestore = async (date: string, type: "critical" | "full") => {
    const key = `${date}-${type}`;
    try {
      setRestoring(key);
      setRestoreDialog(null);
      const { data, error } = await supabase.functions.invoke("restore-backup", {
        body: { date, type },
      });
      if (error) throw error;

      toast({
        title: "Backup restaurado",
        description: `${type === "critical" ? "Crítico" : "Completo"}: ${data.total_inserted} registros restaurados em ${Object.keys(data.results || {}).length} tabelas${data.skipped?.length ? ` (${data.skipped.length} tabelas ignoradas)` : ""}`,
      });
      refetchBackups();
    } catch (error: any) {
      toast({ title: "Erro na restauração", description: error.message, variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  const getTotalRecords = (section: Record<string, { count?: number }> | undefined) => {
    if (!section) return 0;
    return Object.values(section).reduce((sum, t) => sum + (t.count || 0), 0);
  };

  const getTableCount = (section: Record<string, { count?: number }> | undefined) => {
    if (!section) return 0;
    return Object.keys(section).filter((k) => section[k]?.count !== undefined).length;
  };

  if (loading || !isAdmin) return null;

  return (
    <AppLayout title="Backups">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/app/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">Backups do Banco de Dados</h2>
            <p className="text-muted-foreground text-sm">Gerencie backups manuais e automáticos salvos no GitHub</p>
          </div>
        </div>

        {/* 4 Cards Grid - 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: GitHub Connection Status */}
          <Card className={githubStatus?.connected ? "border-green-500/40 bg-green-50/50 dark:bg-green-950/20" : "border-destructive/40 bg-red-50/50 dark:bg-red-950/20"}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                <CardTitle className="text-base">Conexão GitHub</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loadingGithub ? (
                <Skeleton className="h-12 w-full" />
              ) : githubStatus?.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Conectado</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {githubStatus.repo} · {githubStatus.visibility} · branch: {githubStatus.default_branch}
                  </p>
                  {githubStatus.repo_url && (
                    <a href={githubStatus.repo_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <Github className="h-4 w-4" />
                        Abrir Repositório
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive">Desconectado</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{githubStatus?.reason || "Verifique as configurações"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Configuration */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Configurações da Rotina</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingConfig ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium text-sm whitespace-nowrap">Backup diário</Label>
                      <span className="text-xs text-muted-foreground">(03:00 UTC)</span>
                      <Switch checked={backupEnabled} onCheckedChange={setBackupEnabled} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="font-medium text-sm whitespace-nowrap">Retenção (dias)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={retentionDays}
                        onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
                        className="w-16 h-8"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveConfig} disabled={savingConfig} size="sm" className="w-full">
                    {savingConfig ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Backup Crítico */}
          {(() => {
            const renderBackupCard = (
              type: "critical" | "full",
              icon: React.ReactNode,
              title: string,
              description: string,
              manual: ManualBackupState | null,
              setManual: (v: ManualBackupState | null) => void,
              isBackingUp: boolean,
              buttonVariant: "default" | "secondary",
            ) => (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    {icon}
                    <CardTitle className="text-base">{title}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {manual ? (
                    <>
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Backup gerado: {manual.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Layers className="h-3.5 w-3.5 text-primary" />
                          <span>{manual.tables} tabelas · {manual.records.toLocaleString()} registros</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleDownloadManualBackup(type)}
                          disabled={downloadingManual !== null}
                          className="flex-1"
                          size="sm"
                        >
                          {downloadingManual === type ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Baixando...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => setManual(null)}
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleBackup(type)}
                      disabled={backingUpCritical || backingUpFull}
                      variant={buttonVariant}
                      className="w-full"
                    >
                      {isBackingUp ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <HardDrive className="h-4 w-4 mr-2" />
                          Gerar {title}
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );

            return (
              <>
                {renderBackupCard(
                  "critical",
                  <Shield className="h-5 w-5 text-primary" />,
                  "Backup Crítico",
                  "Tabelas essenciais (perfis, carteiras, movimentações, afiliados, blog)",
                  manualCritical,
                  setManualCritical,
                  backingUpCritical,
                  "default",
                )}
                {renderBackupCard(
                  "full",
                  <Database className="h-5 w-5 text-primary" />,
                  "Backup Completo",
                  "Todas as tabelas com redação de dados sensíveis",
                  manualFull,
                  setManualFull,
                  backingUpFull,
                  "secondary",
                )}
              </>
            );
          })()}
        </div>

        {/* Backup List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Backups Disponíveis</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchBackups()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBackups ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !backups || backups.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum backup encontrado no repositório GitHub
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Crítico</TableHead>
                      <TableHead>Completo</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead className="text-right">Download</TableHead>
                      <TableHead className="text-right">Restaurar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.map((backup) => {
                      const criticalTables = getTableCount(backup.critical);
                      const criticalRecords = getTotalRecords(backup.critical);
                      const fullTables = getTableCount(backup.full);
                      const fullRecords = getTotalRecords(backup.full);

                      let duration = "—";
                      if (backup.started_at && backup.completed_at) {
                        const ms =
                          new Date(backup.completed_at).getTime() -
                          new Date(backup.started_at).getTime();
                        duration = ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}min`;
                      }

                      return (
                        <TableRow key={backup.date}>
                          <TableCell className="font-medium">{backup.date}</TableCell>
                          <TableCell>
                            {criticalTables > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                {criticalTables} tabelas · {criticalRecords.toLocaleString()} reg.
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {fullTables > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                {fullTables} tabelas · {fullRecords.toLocaleString()} reg.
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{duration}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {criticalTables > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={downloading !== null}
                                  onClick={() => handleDownloadBackup(backup.date, "critical")}
                                  className="text-xs h-7 px-2"
                                >
                                  {downloading === `${backup.date}-critical` ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-3 w-3 mr-1" />
                                      Crítico
                                    </>
                                  )}
                                </Button>
                              )}
                              {fullTables > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={downloading !== null}
                                  onClick={() => handleDownloadBackup(backup.date, "full")}
                                  className="text-xs h-7 px-2"
                                >
                                  {downloading === `${backup.date}-full` ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-3 w-3 mr-1" />
                                      Completo
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {criticalTables > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={restoring !== null}
                                  onClick={() => setRestoreDialog({ date: backup.date, type: "critical", tables: criticalTables, records: criticalRecords })}
                                  className="text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  {restoring === `${backup.date}-critical` ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Crítico
                                    </>
                                  )}
                                </Button>
                              )}
                              {fullTables > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={restoring !== null}
                                  onClick={() => setRestoreDialog({ date: backup.date, type: "full", tables: fullTables, records: fullRecords })}
                                  className="text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  {restoring === `${backup.date}-full` ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Completo
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code Versions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Versões do Código-Fonte</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={versionDateFilter}
                  onChange={(e) => {
                    setVersionDateFilter(e.target.value);
                    setVersionPage(1);
                  }}
                  className="h-8 w-auto text-xs"
                />
                {versionDateFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setVersionDateFilter("");
                      setVersionPage(1);
                    }}
                  >
                    Limpar
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8" onClick={() => refetchVersions()}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Atualizar
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs">
              Commits dos últimos 30 dias no GitHub. Restaure o site para qualquer versão anterior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingVersions ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !codeVersions || codeVersions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma versão encontrada nos últimos 30 dias
              </p>
            ) : (() => {
              const filtered = versionDateFilter
                ? codeVersions.filter((v) => v.date.startsWith(versionDateFilter))
                : codeVersions;
              const totalPages = Math.ceil(filtered.length / VERSIONS_PER_PAGE);
              const startIndex = (versionPage - 1) * VERSIONS_PER_PAGE;
              const paged = filtered.slice(startIndex, startIndex + VERSIONS_PER_PAGE);

              if (filtered.length === 0) {
                return (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Nenhuma versão encontrada para a data selecionada
                  </p>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Mensagem</TableHead>
                          <TableHead>Autor</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paged.map((version) => {
                          const isFirst = codeVersions[0]?.sha === version.sha;
                          return (
                            <TableRow key={version.sha}>
                              <TableCell className="font-medium text-xs whitespace-nowrap">
                                {new Date(version.date).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                              <TableCell className="text-xs max-w-[300px] truncate" title={version.message}>
                                <div className="flex items-center gap-2">
                                  {isFirst && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      atual
                                    </Badge>
                                  )}
                                  {version.message.split("\n")[0].substring(0, 60)}
                                  {version.message.split("\n")[0].length > 60 ? "..." : ""}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{version.author}</TableCell>
                              <TableCell className="text-right">
                                {isFirst ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={restoringCode}
                                    onClick={() => setCodeRestoreDialog(version)}
                                    className="text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    {restoringCode ? (
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Restaurar
                                      </>
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Mostrando {startIndex + 1}-{Math.min(startIndex + VERSIONS_PER_PAGE, filtered.length)} de {filtered.length} versões
                    </span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={versionPage <= 1}
                          onClick={() => setVersionPage((p) => p - 1)}
                        >
                          Anterior
                        </Button>
                        <span className="px-2">
                          {versionPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={versionPage >= totalPages}
                          onClick={() => setVersionPage((p) => p + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* DB Restore Dialog */}
      <AlertDialog open={!!restoreDialog} onOpenChange={(open) => !open && setRestoreDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" />
              Restaurar Backup
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a restaurar o backup{" "}
                <strong>{restoreDialog?.type === "critical" ? "CRÍTICO" : "COMPLETO"}</strong> de{" "}
                <strong>{restoreDialog?.date}</strong>.
              </p>
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <p>• {restoreDialog?.tables} tabelas serão sobrescritas</p>
                <p>• {restoreDialog?.records.toLocaleString()} registros serão restaurados</p>
              </div>
              <p className="text-destructive font-medium">
                ⚠️ ATENÇÃO: Os dados atuais serão substituídos pelos dados deste backup. Esta ação não pode ser desfeita.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreDialog && handleRestore(restoreDialog.date, restoreDialog.type)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Code Restore Dialog */}
      <AlertDialog open={!!codeRestoreDialog} onOpenChange={(open) => !open && setCodeRestoreDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-destructive" />
              Restaurar Código-Fonte
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a restaurar o site para a versão de{" "}
                <strong>
                  {codeRestoreDialog &&
                    new Date(codeRestoreDialog.date).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </strong>
                .
              </p>
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <p>
                  <strong>Commit:</strong> {codeRestoreDialog?.message.split("\n")[0]}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  SHA: {codeRestoreDialog?.sha.substring(0, 12)}
                </p>
              </div>
              <p className="text-destructive font-medium">
                ⚠️ ATENÇÃO: O código atual será substituído por esta versão. Um novo commit será criado no histórico,
                permitindo reverter se necessário.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => codeRestoreDialog && handleRestoreCode(codeRestoreDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminBackups;
