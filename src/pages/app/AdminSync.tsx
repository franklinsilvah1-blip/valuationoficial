import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, ExternalLink, Settings, AlertTriangle, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useEffect, useState } from "react";

const useDbStats = () => {
  return useQuery({
    queryKey: ["db-stats"],
    queryFn: async () => {
      const [assetsResult, analysesResult] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("asset_analyses").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalAssets: assetsResult.count || 0,
        totalAnalyses: analysesResult.count || 0,
      };
    },
  });
};

const useQueueStats = (enabled: boolean = true) => {
  const [hasError, setHasError] = useState(false);
  
  return useQuery({
    queryKey: ["sync-queue-stats"],
    enabled: enabled && !hasError,
    queryFn: async () => {
      // ✅ Buscar sync_log mais recente IN_PROGRESS ou QUEUED
      const { data: currentLog, error: logError } = await supabase
        .from("sync_logs")
        .select("*")
        .in("status", ["IN_PROGRESS", "QUEUED"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logError) {
        if (logError.message.includes('406')) {
          console.warn("[useQueueStats] RLS bloqueou acesso");
          setHasError(true);
          return null;
        }
        throw logError;
      }

      // Buscar apenas itens PENDING ou PROCESSING (ignorar FAILED/COMPLETED antigos)
      const { data, error } = await supabase
        .from("sync_queue")
        .select("status, created_at, sync_log_id")
        .in("status", ["PENDING", "PROCESSING"]);

      if (error) {
        if (error.message.includes('406')) {
          console.warn("[useQueueStats] RLS bloqueou acesso - aguardando auth");
          setHasError(true);
          return null;
        }
        throw error;
      }
      
      // Se não há sync ativo e não há itens na fila, retornar null
      if (!currentLog && (!data || data.length === 0)) {
        setHasError(false);
        return null;
      }

      // Calcular progresso baseado na sync_queue atual para este sync específico
      const pendingCount = data?.filter(i => i.status === 'PENDING').length || 0;
      const processingCount = data?.filter(i => i.status === 'PROCESSING').length || 0;
      
      // Buscar itens já processados (COMPLETED/FAILED) para este sync_log
      let completedCount = 0;
      let failedCount = 0;
      if (currentLog?.id) {
        const { data: doneItems } = await supabase
          .from("sync_queue")
          .select("status")
          .eq("sync_log_id", currentLog.id)
          .in("status", ["COMPLETED", "FAILED"]);
        completedCount = doneItems?.filter(i => i.status === 'COMPLETED').length || 0;
        failedCount = doneItems?.filter(i => i.status === 'FAILED').length || 0;
      }
      
      const processedCount = completedCount + failedCount;
      // Total = todos os itens desta sincronização
      const totalItems = pendingCount + processingCount + processedCount;

      setHasError(false);
      const stats = {
        total: totalItems > 0 ? totalItems : (currentLog?.total_rows || 0),
        pending: pendingCount,
        processing: processingCount,
        processed: processedCount,
        completed: completedCount,
        failed: failedCount,
      };

      return stats;
    },
    refetchInterval: hasError ? false : 3000,
  });
};

const useSyncNow = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-google-sheets", {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({
          title: "❌ Erro ao iniciar sincronização",
          description: data.message || "Não foi possível iniciar a sincronização.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Sincronização iniciada",
        description: `${data.totalRows || 0} linhas detectadas. Processamento em andamento...`,
        className: "bg-green-50 border-green-200 text-green-900",
      });

      queryClient.invalidateQueries({ queryKey: ["sync-history"] });
      queryClient.invalidateQueries({ queryKey: ["sync-queue-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["db-stats"] });
    },
    onError: (error: any) => {
      console.error("Sync error:", error);
      
      let errorMessage = "Erro desconhecido ao iniciar sincronização.";
      
      if (error?.message?.includes("already in progress")) {
        errorMessage = "⚠️ Já existe uma sincronização em andamento. Aguarde a conclusão.";
      } else if (error?.message?.includes("Queue is active")) {
        errorMessage = "⚠️ A fila de processamento está ativa. Aguarde a conclusão.";
      } else if (error?.message?.includes("timeout")) {
        errorMessage = "⏱️ Processo anterior travado. Aguarde o monitor limpar ou tente novamente em 2 minutos.";
      }

      toast({
        title: "❌ Falha na sincronização",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};

const useSyncStatus = (enabled: boolean = true) => {
  const [hasError, setHasError] = useState(false);
  
  return useQuery({
    queryKey: ["sync-status"],
    enabled: enabled && !hasError,
    queryFn: async () => {
      // Verificar lock
      const { data: lockData, error: lockError } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "sync_lock")
        .maybeSingle();

      if (lockError && lockError.message.includes('406')) {
        console.warn("[useSyncStatus] RLS bloqueou acesso - aguardando auth");
        setHasError(true);
        return { isActive: false, isStuck: false, isCancelling: false };
      }

      const lockActive = lockData?.value === "true";

      // Verificar fila ativa
      const { data: queueData, error: queueError } = await supabase
        .from("sync_queue")
        .select("id")
        .in("status", ["PENDING", "PROCESSING"])
        .limit(1)
        .maybeSingle();

      if (queueError && queueError.message.includes('406')) {
        console.warn("[useSyncStatus] RLS bloqueou acesso - aguardando auth");
        setHasError(true);
        return { isActive: false, isStuck: false, isCancelling: false };
      }

      const queueActive = queueData !== null;

      // Verificar sync_log IN_PROGRESS ou QUEUED
      const { data: logData, error: logError } = await supabase
        .from("sync_logs")
        .select("id, started_at, cancellation_requested")
        .eq("sync_type", "google_sheets")
        .in("status", ["IN_PROGRESS", "QUEUED"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logError && logError.message.includes('406')) {
        console.warn("[useSyncStatus] RLS bloqueou acesso - aguardando auth");
        setHasError(true);
        return { isActive: false, isStuck: false, isCancelling: false };
      }

      const hasInProgressLog = logData !== null;
      const hasQueueActivity = queueActive;
      const isCancelling = logData?.cancellation_requested || false;

      // ✅ FIX: Considerar travado apenas se > 10 min E sem itens pendentes na fila
      let isStuck = false;
      if (logData?.started_at) {
        const startedAt = new Date(logData.started_at);
        const now = new Date();
        const minutesRunning = (now.getTime() - startedAt.getTime()) / 1000 / 60;
        // Só é stuck se > 10 min E não há atividade na fila
        isStuck = minutesRunning > 10 && !queueActive;
      }

      setHasError(false);
      return {
        isActive: lockActive || hasInProgressLog || hasQueueActivity,
        isStuck,
        isCancelling,
        lockActive,
        queueActive,
        hasInProgressLog,
        hasQueueActivity,
        lastLogStarted: logData?.started_at || null,
      };
    },
    refetchInterval: hasError ? false : 10000,
  });
};

// Hook para buscar motivos de falha da última sincronização
const useLastSyncFailures = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["last-sync-failures"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("id, metadata, completed_at, status, failed, updated, total_rows, started_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const metadata = data.metadata as {
        top_errors?: Array<{ message: string; count: number }>;
        stats?: { completed: number; failed: number; total_processed: number; success_rate: string };
        final_status?: string;
      } | null;

      return {
        syncId: data.id,
        completedAt: data.completed_at,
        startedAt: data.started_at,
        status: data.status,
        failed: data.failed || 0,
        updated: data.updated || 0,
        totalRows: data.total_rows || 0,
        topErrors: metadata?.top_errors || [],
        finalStatus: metadata?.final_status || data.status,
      };
    },
    refetchInterval: 15000,
  });
};

// Hook para buscar duplicatas da última sincronização
const useLastSyncDuplicates = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["last-sync-duplicates"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("id, metadata, completed_at, status")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const metadata = data.metadata as {
        duplicatesFound?: number;
        duplicateCodes?: Array<{ codigo: string; linhas: number[] }>;
      } | null;

      return {
        syncId: data.id,
        completedAt: data.completed_at,
        status: data.status,
        duplicatesFound: metadata?.duplicatesFound || 0,
        duplicateCodes: metadata?.duplicateCodes || [],
      };
    },
    refetchInterval: 30000,
  });
};

// Hook para buscar ativos órfãos desativados na última sincronização
const useLastSyncOrphans = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["last-sync-orphans"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("id, metadata, completed_at, status")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const metadata = data.metadata as {
        orphansDeactivated?: number;
        orphanedAssets?: Array<{ codigo: string; nome: string }>;
      } | null;

      return {
        syncId: data.id,
        completedAt: data.completed_at,
        status: data.status,
        orphansDeactivated: metadata?.orphansDeactivated || 0,
        orphanedAssets: metadata?.orphanedAssets || [],
      };
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
};

const useForceCleanup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("force-sync-cleanup", {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast({
          title: "❌ Erro na limpeza",
          description: data.message || "Não foi possível executar a limpeza.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "🧹 Limpeza concluída",
        description: data.message,
        className: "bg-green-50 border-green-200 text-green-900",
      });

      // Atualizar todas as queries relevantes
      queryClient.invalidateQueries({ queryKey: ["sync-queue-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["db-stats"] });
    },
    onError: (error: any) => {
      console.error("Force cleanup error:", error);
      toast({
        title: "❌ Erro na limpeza forçada",
        description: error.message || "Erro desconhecido ao executar limpeza de emergência.",
        variant: "destructive",
      });
    },
  });
};

const AdminSync = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { data: dbStats } = useDbStats();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const queriesEnabled = !adminLoading && isAdmin;
  
  const { data: queueStats } = useQueueStats(queriesEnabled);
  const { data: syncStatus } = useSyncStatus(queriesEnabled);
  const { data: lastSyncDuplicates } = useLastSyncDuplicates(queriesEnabled);
  const { data: lastSyncOrphans } = useLastSyncOrphans(queriesEnabled);
  const { data: lastSyncFailures } = useLastSyncFailures(queriesEnabled);
  const syncNow = useSyncNow();
  const forceCleanup = useForceCleanup();

  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-queue-stats"] });
    queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    queryClient.invalidateQueries({ queryKey: ["db-stats"] });
    toast({
      title: "Dados atualizados",
      description: "Informações de sincronização recarregadas",
    });
  };

  if (adminLoading) {
    return (
      <AppLayout title="Verificando permissões...">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center py-8 text-muted-foreground">
            Verificando permissões...
          </p>
        </div>
      </AppLayout>
    );
  }

  const handleShowCronSetup = () => {
    // URL derivada de VITE_SUPABASE_URL — nunca hardcoded. Achado real: o
    // template anterior apontava para um project ref diferente do de
    // produção (mbnjjbtllzgatkjtsvrg), uma referência obsoleta que, se
    // copiada literalmente, criaria o cron job apontando para o projeto
    // Supabase errado.
    const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    const sql = `-- Configurar Cron Job para Processar Fila
-- Execute este SQL no banco de dados (Tab SQL Editor no Backend)

-- 1. Remover cron job antigo se existir
SELECT cron.unschedule('process-sync-queue-every-minute');

-- 2. Criar novo cron job
SELECT cron.schedule(
  'process-sync-queue-every-minute',
  '* * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url:='${functionsBaseUrl}/process-sync-queue',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', current_setting('app.settings.service_role_key', true)),
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- 3. Verificar se foi criado com sucesso
SELECT * FROM cron.job WHERE jobname = 'process-sync-queue-every-minute';`;

    navigator.clipboard.writeText(sql).then(() => {
      toast({
        title: "SQL copiado!",
        description: "Cole no SQL Editor do backend para configurar o cron job",
      });
    });
    
    alert(`SQL copiado para área de transferência!\n\nAgora:\n1. Abra o Backend (botão abaixo)\n2. Vá em SQL Editor\n3. Cole e execute o SQL\n\n${sql}`);
  };

  // Realtime listeners para atualizações instantâneas
  useEffect(() => {
    const channel = supabase
      .channel('sync-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_queue'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sync-queue-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Don't render while checking permissions
  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Sincronização Google Sheets">
      <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Sincronização Google Sheets</h1>
        <p className="text-muted-foreground mt-2">
          Sincronização automática com a planilha Google Sheets (fonte primária de dados)
        </p>
      </div>

        {/* Card de Estatísticas do Banco */}
        {dbStats && (
          <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    📊 Status do Banco de Dados
                  </CardTitle>
                  <CardDescription>
                    Estatísticas atuais do banco de dados
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["db-stats"] });
                      toast({
                        title: "🔄 Atualizando",
                        description: "Estatísticas sendo recarregadas...",
                      });
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!confirm("⚠️ ATENÇÃO: Esta ação irá DELETAR todos os ativos e análises do banco de dados!\n\nIsso não pode ser desfeito. Você terá que sincronizar novamente com a planilha para restaurar os dados.\n\nTem certeza que deseja continuar?")) {
                        return;
                      }

                      try {
                        const { error: analysesError } = await supabase
                          .from("asset_analyses")
                          .delete()
                          .neq("id", "00000000-0000-0000-0000-000000000000");

                        if (analysesError) throw analysesError;

                        const { error: assetsError } = await supabase
                          .from("assets")
                          .delete()
                          .neq("id", "00000000-0000-0000-0000-000000000000");

                        if (assetsError) throw assetsError;

                        toast({
                          title: "✅ Banco limpo com sucesso",
                          description: "Todos os ativos e análises foram removidos. Execute uma nova sincronização.",
                          className: "bg-green-50 border-green-200 text-green-900",
                        });

                        queryClient.invalidateQueries({ queryKey: ["db-stats"] });
                      } catch (error: any) {
                        toast({
                          title: "❌ Erro ao limpar banco",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    variant="destructive"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Banco
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <p className="text-4xl font-bold text-primary">{dbStats.totalAssets}</p>
                  <p className="text-sm text-muted-foreground mt-2">Ativos Cadastrados</p>
                  <p className="text-xs text-amber-600 mt-1">⚠️ Verificar se bate com planilha</p>
                </div>
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <p className="text-4xl font-bold text-primary">{dbStats.totalAnalyses}</p>
                  <p className="text-sm text-muted-foreground mt-2">Análises Ativas</p>
                  <p className="text-xs text-muted-foreground mt-1">Devem coincidir com ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerta de Processo Travado */}
        {syncStatus?.isStuck && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center gap-2">
                🚨 Processo Travado Detectado
              </CardTitle>
              <CardDescription className="text-red-700">
                Um processo de sincronização está travado há mais de 5 minutos sem progresso.
                Use o botão "Forçar Limpeza" para destravar o sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Última atualização: {syncStatus.lastLogStarted 
                    ? format(new Date(syncStatus.lastLogStarted), "HH:mm:ss", { locale: ptBR })
                    : "desconhecido"}
                </span>
              </div>
              {syncStatus.isCancelling && (
                <div className="mt-2 text-sm text-red-700 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Cancelamento em andamento...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Status de Sincronização</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleRefreshData}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Dados
                </Button>
                <Button
                  onClick={handleShowCronSetup}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Cron
                </Button>
                {syncStatus?.isStuck && (
                  <Button
                    onClick={() => {
                      if (confirm("🚨 Forçar limpeza do sistema?\n\nIsso irá:\n- Marcar processos órfãos como FAILED\n- Limpar fila de sincronização\n- Liberar lock travado\n\nUse apenas em emergências!")) {
                        forceCleanup.mutate();
                      }
                    }}
                    disabled={forceCleanup.isPending}
                    variant="destructive"
                    size="sm"
                  >
                    <AlertCircle className={`h-4 w-4 mr-2 ${forceCleanup.isPending ? 'animate-spin' : ''}`} />
                    {forceCleanup.isPending ? "Limpando..." : "Forçar Limpeza"}
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    // Validação dupla: checar lock E fila ativa
                    if (syncStatus?.isActive) {
                      toast({
                        title: "⚠️ Sincronização em andamento",
                        description: "Aguarde a conclusão ou o timeout de 60 segundos.",
                        variant: "destructive",
                      });
                      return;
                    }

                    // Validação extra: checar se há itens na fila
                    const { data: queueCheck } = await supabase
                      .from("sync_queue")
                      .select("id")
                      .in("status", ["PENDING", "PROCESSING"])
                      .limit(1);

                    if (queueCheck && queueCheck.length > 0) {
                      toast({
                        title: "⚠️ Fila de processamento ativa",
                        description: "Já existe uma sincronização em andamento. Aguarde a conclusão.",
                        variant: "destructive",
                      });
                      return;
                    }

                    syncNow.mutate();
                  }}
                  disabled={syncNow.isPending || syncStatus?.isActive}
                  className={syncStatus?.isCancelling ? "opacity-50" : ""}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${(syncNow.isPending || syncStatus?.isActive) ? 'animate-spin' : ''}`} />
                  {syncStatus?.isCancelling ? "Cancelando..." : (syncNow.isPending || syncStatus?.isActive) ? "Sincronizando..." : "Sincronizar Agora"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-4">
              Use o botão "Sincronizar Agora" acima para iniciar uma nova sincronização com o Google Sheets.
            </p>
          </CardContent>
        </Card>

        {queueStats && queueStats.total > 0 ? (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900 flex items-center gap-2">
                🔄 Processamento em Background
                <Badge variant="outline" className="text-xs bg-white">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Ao vivo
                </Badge>
              </CardTitle>
              <CardDescription className="text-blue-700">
                A fila está sendo processada automaticamente a cada minuto
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Barra de progresso visual principal */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    Progresso da Sincronização
                  </span>
                  <span className="text-sm font-mono font-bold text-blue-900">
                    {queueStats.processed} / {queueStats.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                    style={{ width: `${Math.min((queueStats.processed / queueStats.total) * 100, 100)}%` }}
                  >
                    {queueStats.processed > 0 && (
                      <span className="text-xs font-bold text-white drop-shadow">
                        {Math.round((queueStats.processed / queueStats.total) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-blue-600">
                  <span>
                    {queueStats.pending} pendentes • {queueStats.processing} processando
                  </span>
                  <span className="font-medium">
                    {queueStats.total - queueStats.processed} restantes
                  </span>
                </div>
              </div>

              {/* Estatísticas detalhadas */}
              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-blue-200">
                <div className="text-center p-3 bg-white/60 rounded-lg">
                  <p className="text-2xl font-bold text-blue-900">{queueStats.total}</p>
                  <p className="text-xs text-blue-700 mt-1">Total</p>
                </div>
                <div className="text-center p-3 bg-white/60 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{queueStats.pending}</p>
                  <p className="text-xs text-blue-700 mt-1">Na Fila</p>
                </div>
                <div className="text-center p-3 bg-white/60 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{queueStats.completed}</p>
                  <p className="text-xs text-blue-700 mt-1">Finalizados</p>
                </div>
                <div className="text-center p-3 bg-white/60 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{queueStats.failed}</p>
                  <p className="text-xs text-blue-700 mt-1">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          syncStatus?.isActive && (
            <Card className="mb-6 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-900">
                  🔄 Aguardando Processamento
                </CardTitle>
                <CardDescription className="text-yellow-700">
                  Uma sincronização está sendo preparada...
                </CardDescription>
              </CardHeader>
            </Card>
          )
        )}

        {/* Alerta de Fila Órfã */}
        {syncStatus?.hasQueueActivity && !syncStatus?.hasInProgressLog && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>⚠️ Fila Órfã Detectada</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                Existem {queueStats?.pending || 0} itens na fila sem sincronização ativa. 
                Use "Forçar Limpeza" ou inicie uma nova sincronização.
              </span>
              <Button
                onClick={() => {
                  if (confirm("🚨 Forçar limpeza da fila órfã?")) {
                    forceCleanup.mutate();
                  }
                }}
                disabled={forceCleanup.isPending}
                variant="destructive"
                size="sm"
                className="ml-4 shrink-0"
              >
                <AlertCircle className={`h-4 w-4 mr-2 ${forceCleanup.isPending ? 'animate-spin' : ''}`} />
                {forceCleanup.isPending ? "Limpando..." : "Forçar Limpeza"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Card de Motivos de Falha da Última Sincronização */}
        {lastSyncFailures && lastSyncFailures.failed > 0 && !syncStatus?.isActive && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-red-900 flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    {lastSyncFailures.status === 'FAILED' ? 'Sincronização Falhou' : 
                     lastSyncFailures.status === 'PARTIAL' ? 'Sincronização Parcial' : 
                     `${lastSyncFailures.failed} Falha(s) na Última Sincronização`}
                  </CardTitle>
                  <CardDescription className="text-red-700">
                    {lastSyncFailures.updated} sucesso(s) • {lastSyncFailures.failed} falha(s) de {lastSyncFailures.totalRows} total
                    {lastSyncFailures.completedAt && (
                      <> • {format(new Date(lastSyncFailures.completedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</>
                    )}
                  </CardDescription>
                </div>
                <Badge 
                  variant="outline" 
                  className={
                    lastSyncFailures.status === 'FAILED' ? 'bg-red-100 text-red-800 border-red-300' :
                    lastSyncFailures.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    'bg-green-100 text-green-800 border-green-300'
                  }
                >
                  {lastSyncFailures.status === 'FAILED' ? '❌ Falhou' :
                   lastSyncFailures.status === 'PARTIAL' ? '⚠️ Parcial' : 
                   `✅ ${lastSyncFailures.status}`}
                </Badge>
              </div>
            </CardHeader>
            {lastSyncFailures.topErrors.length > 0 && (
              <CardContent>
                <p className="text-sm font-medium text-red-800 mb-3">Top motivos de falha:</p>
                <div className="bg-white/70 rounded-lg border border-red-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-100/50">
                        <TableHead className="text-red-900 font-semibold">Erro</TableHead>
                        <TableHead className="text-red-900 font-semibold text-center w-24">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastSyncFailures.topErrors.map((err, idx) => (
                        <TableRow key={idx} className="hover:bg-red-50">
                          <TableCell className="font-mono text-xs text-red-700 break-all">
                            {err.message}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                              {err.count}x
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-red-600 mt-3">
                  Sync ID: <span className="font-mono">{lastSyncFailures.syncId}</span>
                </p>
              </CardContent>
            )}
          </Card>
        )}


        {/* Card de Duplicatas Detectadas */}
        {lastSyncDuplicates && lastSyncDuplicates.duplicatesFound > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {lastSyncDuplicates.duplicatesFound} Código(s) Duplicado(s) Detectado(s)
                  </CardTitle>
                  <CardDescription className="text-amber-700">
                    A planilha contém códigos B3 repetidos. Isso faz com que o banco tenha menos ativos que a planilha.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => {
                    const text = lastSyncDuplicates.duplicateCodes
                      .map(d => `${d.codigo}: linhas ${d.linhas.join(", ")}`)
                      .join("\n");
                    navigator.clipboard.writeText(text);
                    toast({
                      title: "📋 Copiado!",
                      description: "Lista de duplicatas copiada para área de transferência",
                    });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Lista
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white/70 rounded-lg border border-amber-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-100/50">
                      <TableHead className="text-amber-900 font-semibold">Código B3</TableHead>
                      <TableHead className="text-amber-900 font-semibold">Linhas na Planilha</TableHead>
                      <TableHead className="text-amber-900 font-semibold text-center">Ocorrências</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastSyncDuplicates.duplicateCodes.map((dup, idx) => (
                      <TableRow key={idx} className="hover:bg-amber-50">
                        <TableCell className="font-mono font-bold text-amber-800">
                          {dup.codigo}
                        </TableCell>
                        <TableCell className="text-amber-700">
                          {dup.linhas.join(", ")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                            {dup.linhas.length}x
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                💡 Corrija as duplicatas na planilha Google Sheets e execute uma nova sincronização.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Card de Ativos Órfãos Desativados */}
        {lastSyncOrphans && lastSyncOrphans.orphansDeactivated > 0 && (
          <Card className="mb-6 border-purple-200 bg-purple-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-purple-900 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {lastSyncOrphans.orphansDeactivated} Ativo(s) Órfão(s) Desativado(s)
                  </CardTitle>
                  <CardDescription className="text-purple-700">
                    Ativos removidos da planilha foram automaticamente desativados no banco de dados.
                  </CardDescription>
                </div>
                {lastSyncOrphans.orphanedAssets.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-purple-300 text-purple-800 hover:bg-purple-100"
                    onClick={() => {
                      const text = lastSyncOrphans.orphanedAssets
                        .map(a => `${a.codigo} - ${a.nome}`)
                        .join("\n");
                      navigator.clipboard.writeText(text);
                      toast({
                        title: "📋 Copiado!",
                        description: "Lista de ativos órfãos copiada para área de transferência",
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Lista
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {lastSyncOrphans.orphanedAssets.length > 0 ? (
                <>
                  <div className="bg-white/70 rounded-lg border border-purple-200 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-purple-100/50">
                          <TableHead className="text-purple-900 font-semibold">Código B3</TableHead>
                          <TableHead className="text-purple-900 font-semibold">Nome do Ativo</TableHead>
                          <TableHead className="text-purple-900 font-semibold text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lastSyncOrphans.orphanedAssets.map((asset, idx) => (
                          <TableRow key={idx} className="hover:bg-purple-50">
                            <TableCell className="font-mono font-bold text-purple-800">
                              {asset.codigo}
                            </TableCell>
                            <TableCell className="text-purple-700">
                              {asset.nome}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                                Desativado
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-purple-600 mt-3 flex items-center gap-1">
                    ℹ️ Estes ativos não estão mais na planilha e foram marcados como inativos automaticamente.
                  </p>
                </>
              ) : (
                <div className="text-center py-6 text-purple-700">
                  <p className="text-sm">
                    {lastSyncOrphans.orphansDeactivated} ativo(s) órfão(s) foi(foram) desativado(s), mas os detalhes não estão disponíveis.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">ℹ️ Informações Importantes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>• A sincronização automática ocorre <strong>todos os dias às 9:00</strong> (horário de Brasília)</p>
            <p>• Para datasets grandes (568+ linhas), o sistema usa <strong>processamento em fila</strong> automático</p>
            <p>• A fila é processada <strong>a cada minuto</strong> até completar todos os registros</p>
            <p>• Os dados são importados da planilha "<strong>Ativos</strong>" (colunas A até R)</p>
            <p>• Google Sheets é a <strong>fonte primária oficial</strong> de dados do sistema</p>
            <p>• Apenas administradores podem executar sincronizações manuais</p>
            <p className="flex items-center gap-2 pt-2">
              <a
                href="https://docs.google.com/spreadsheets/d/1U_2Jr2T7f6lPnaCZrSBaIQeiRXarNfq1PtYej7vIa3c/edit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                Abrir planilha no Google Sheets
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminSync;
