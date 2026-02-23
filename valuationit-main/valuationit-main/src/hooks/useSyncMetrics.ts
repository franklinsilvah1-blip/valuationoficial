import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface SyncMetrics {
  totalSyncs: number;
  successRate: number;
  averageDuration: number;
  last24hVolume: number;
  last7daysData: Array<{
    date: string;
    syncs: number;
    success: number;
    failed: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  recentPerformance: Array<{
    timestamp: string;
    duration: number;
    status: string;
  }>;
}

export const useSyncMetrics = () => {
  const query = useQuery({
    queryKey: ["sync-metrics"],
    queryFn: async (): Promise<SyncMetrics> => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Buscar todos os syncs dos últimos 7 dias
      const { data: recentSyncs, error } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("sync_type", "google_sheets")
        .gte("created_at", last7d)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const syncs = recentSyncs || [];

      // Calcular total de syncs
      const totalSyncs = syncs.length;

      // Calcular taxa de sucesso
      const successfulSyncs = syncs.filter(s => s.status === "SUCCESS").length;
      const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

      // Calcular duração média (em segundos)
      const completedSyncs = syncs.filter(
        s => s.started_at && s.completed_at
      );
      const totalDuration = completedSyncs.reduce((acc, s) => {
        const start = new Date(s.started_at).getTime();
        const end = new Date(s.completed_at).getTime();
        return acc + (end - start);
      }, 0);
      const averageDuration = completedSyncs.length > 0 
        ? totalDuration / completedSyncs.length / 1000 
        : 0;

      // Volume últimas 24h
      const last24hSyncs = syncs.filter(
        s => new Date(s.created_at) >= new Date(last24h)
      );
      const last24hVolume = last24hSyncs.reduce(
        (acc, s) => acc + (s.total_rows || 0),
        0
      );

      // Dados dos últimos 7 dias (agrupados por dia)
      const last7daysData: Record<string, any> = {};
      syncs.forEach(sync => {
        const date = new Date(sync.created_at).toISOString().split("T")[0];
        if (!last7daysData[date]) {
          last7daysData[date] = { date, syncs: 0, success: 0, failed: 0 };
        }
        last7daysData[date].syncs++;
        if (sync.status === "SUCCESS") {
          last7daysData[date].success++;
        } else if (sync.status === "FAILED") {
          last7daysData[date].failed++;
        }
      });

      // Distribuição de status
      const statusCount: Record<string, number> = {};
      syncs.forEach(sync => {
        const status = sync.status || "UNKNOWN";
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      const statusDistribution = Object.entries(statusCount).map(
        ([status, count]) => ({ status, count })
      );

      // Performance recente (últimos 20 syncs completos)
      const recentPerformance = completedSyncs
        .slice(-20)
        .map(s => {
          const start = new Date(s.started_at).getTime();
          const end = new Date(s.completed_at).getTime();
          const duration = (end - start) / 1000;
          return {
            timestamp: s.created_at,
            duration,
            status: s.status,
          };
        });

      return {
        totalSyncs,
        successRate,
        averageDuration,
        last24hVolume,
        last7daysData: Object.values(last7daysData),
        statusDistribution,
        recentPerformance,
      };
    },
    refetchInterval: 30000, // Auto-refresh a cada 30 segundos
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("sync-metrics-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_logs",
        },
        () => {
          // Invalidar query quando houver mudanças
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return query;
};
