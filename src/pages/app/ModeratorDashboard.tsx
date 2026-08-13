import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileBarChart, MessageSquareOff, Users, DollarSign, TrendingDown, 
  TrendingUp, Calendar, AlertCircle, Clock, ExternalLink, UserX, Bell
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useCancellationNotifications } from "@/hooks/useCancellationNotifications";
import { cn } from "@/lib/utils";

const ModeratorDashboard = () => {
  // Ativar notificações em tempo real para cancelamentos
  useCancellationNotifications(true);
  // Stats de cancelamentos
  const { data: cancellationStats } = useQuery({
    queryKey: ["moderator-cancellation-stats"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subDays(monthStart, 1));
      const lastMonthEnd = endOfMonth(subDays(monthStart, 1));

      // Cancelamentos do mês atual
      const { data: currentMonth, error: currentError } = await supabase
        .from("cancellation_feedback")
        .select("id, reason, created_at")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      if (currentError) throw currentError;

      // Cancelamentos do mês passado
      const { data: lastMonth, error: lastError } = await supabase
        .from("cancellation_feedback")
        .select("id")
        .gte("created_at", lastMonthStart.toISOString())
        .lte("created_at", lastMonthEnd.toISOString());

      if (lastError) throw lastError;

      // Total de cancelamentos
      const { count: totalCancellations } = await supabase
        .from("cancellation_feedback")
        .select("id", { count: "exact", head: true });

      // Agrupar por motivo
      const reasonCounts: Record<string, number> = {};
      currentMonth?.forEach(item => {
        reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + 1;
      });

      const topReasons = Object.entries(reasonCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      return {
        currentMonthCount: currentMonth?.length || 0,
        lastMonthCount: lastMonth?.length || 0,
        totalCancellations: totalCancellations || 0,
        topReasons,
        trend: (currentMonth?.length || 0) - (lastMonth?.length || 0),
      };
    },
  });

  // Stats de usuários/assinantes
  const { data: userStats } = useQuery({
    queryKey: ["moderator-user-stats"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, plan, created_at");

      if (error) throw error;

      const total = profiles?.length || 0;
      const free = profiles?.filter(p => p.plan === "FREE" || p.plan === "START").length || 0;
      const paid = total - free;
      const thisMonth = profiles?.filter(p => {
        const createdAt = new Date(p.created_at);
        return createdAt >= startOfMonth(new Date());
      }).length || 0;

      // Distribuição por plano
      const planDistribution: Record<string, number> = {};
      profiles?.forEach(p => {
        planDistribution[p.plan] = (planDistribution[p.plan] || 0) + 1;
      });

      return { total, free, paid, thisMonth, planDistribution };
    },
  });

  // Cancelamentos recentes
  const { data: recentCancellations, isLoading: loadingCancellations } = useQuery({
    queryKey: ["moderator-recent-cancellations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_feedback")
        .select(`
          id, 
          reason, 
          details, 
          created_at,
          user_id
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Buscar nomes dos usuários
      const userIds = data?.map(c => c.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      return data?.map(c => ({
        ...c,
        user: profileMap.get(c.user_id),
      }));
    },
  });

  // Últimas assinaturas
  const { data: recentSubscriptions } = useQuery({
    queryKey: ["moderator-recent-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, plan, plan_start_at, created_at")
        .neq("plan", "FREE")
        .neq("plan", "START")
        .not("plan_start_at", "is", null)
        .order("plan_start_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data;
    },
  });

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      price: "Preço",
      not_using: "Não estava usando",
      found_alternative: "Encontrou alternativa",
      missing_features: "Falta funcionalidades",
      technical_issues: "Problemas técnicos",
      other: "Outro",
    };
    return labels[reason] || reason;
  };

  const getPlanBadge = (plan: string) => {
    const config: Record<string, { label: string; className: string }> = {
      START: { label: "Start", className: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
      PRO: { label: "Pro", className: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
      SPECIALIST: { label: "Especialista", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
      FALE_C_ESPECIALISTA: { label: "Consultoria", className: "bg-green-500/10 text-green-500 border-green-500/30" },
    };
    return config[plan] || { label: plan, className: "" };
  };

  const trendPercentage = cancellationStats?.lastMonthCount 
    ? ((cancellationStats.trend / cancellationStats.lastMonthCount) * 100).toFixed(0)
    : 0;

  return (
    <AppLayout title="Painel do Moderador">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Painel do Moderador</h1>
            <p className="text-muted-foreground">Acompanhe relatórios e cancelamentos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/admin/reports">
                <FileBarChart className="h-4 w-4 mr-2" />
                Relatórios Completos
              </Link>
            </Button>
            <Button asChild>
              <Link to="/app/admin/cancellations">
                <MessageSquareOff className="h-4 w-4 mr-2" />
                Ver Cancelamentos
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {userStats?.thisMonth || 0} novos este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinantes Pagos</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats?.paid || 0}</div>
              <p className="text-xs text-muted-foreground">
                {userStats?.total ? ((userStats.paid / userStats.total) * 100).toFixed(1) : 0}% conversão
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelamentos (Mês)</CardTitle>
              <MessageSquareOff className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cancellationStats?.currentMonthCount || 0}</div>
              <div className="flex items-center gap-1 text-xs">
                {(cancellationStats?.trend ?? 0) > 0 ? (
                  <TrendingUp className="h-3 w-3 text-destructive" />
                ) : (cancellationStats?.trend ?? 0) < 0 ? (
                  <TrendingDown className="h-3 w-3 text-green-500" />
                ) : null}
                <span className={cn(
                  (cancellationStats?.trend ?? 0) > 0 ? "text-destructive" : 
                  (cancellationStats?.trend ?? 0) < 0 ? "text-green-500" : "text-muted-foreground"
                )}>
                  {(cancellationStats?.trend ?? 0) > 0 ? "+" : ""}{cancellationStats?.trend || 0} vs mês anterior
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cancelamentos</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cancellationStats?.totalCancellations || 0}</div>
              <p className="text-xs text-muted-foreground">
                Desde o início
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cancelamentos Recentes */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cancelamentos Recentes</CardTitle>
                <CardDescription>Últimos feedbacks de cancelamento</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/app/admin/cancellations">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingCancellations ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : recentCancellations && recentCancellations.length > 0 ? (
                <div className="space-y-4">
                  {recentCancellations.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <MessageSquareOff className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {item.user?.name || item.user?.email || "Usuário"}
                          </p>
                          <Badge variant="outline">{getReasonLabel(item.reason)}</Badge>
                        </div>
                        {item.details && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.details}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquareOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum cancelamento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Principais Motivos de Cancelamento */}
          <Card>
            <CardHeader>
              <CardTitle>Motivos de Cancelamento</CardTitle>
              <CardDescription>Este mês</CardDescription>
            </CardHeader>
            <CardContent>
              {cancellationStats?.topReasons && cancellationStats.topReasons.length > 0 ? (
                <div className="space-y-4">
                  {cancellationStats.topReasons.map(([reason, count], index) => (
                    <div key={reason} className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{getReasonLabel(reason)}</p>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum cancelamento este mês
                </p>
              )}
            </CardContent>
          </Card>

          {/* Distribuição de Planos */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Planos</CardTitle>
              <CardDescription>Usuários por plano</CardDescription>
            </CardHeader>
            <CardContent>
              {userStats?.planDistribution ? (
                <div className="space-y-4">
                  {Object.entries(userStats.planDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([plan, count]) => {
                      const config = getPlanBadge(plan);
                      const percentage = userStats.total ? ((count / userStats.total) * 100).toFixed(1) : 0;
                      return (
                        <div key={plan} className="flex items-center gap-4">
                          <Badge variant="outline" className={config.className}>
                            {config.label}
                          </Badge>
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-medium w-16 text-right">
                            {count} ({percentage}%)
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum dado disponível
                </p>
              )}
            </CardContent>
          </Card>

          {/* Novas Assinaturas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Novas Assinaturas</CardTitle>
                <CardDescription>Últimas conversões</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/app/admin/reports">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentSubscriptions && recentSubscriptions.length > 0 ? (
                <div className="space-y-3">
                  {recentSubscriptions.slice(0, 5).map((sub) => {
                    const config = getPlanBadge(sub.plan);
                    return (
                      <div key={sub.id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {sub.name || sub.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sub.plan_start_at && format(new Date(sub.plan_start_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant="outline" className={config.className}>
                          {config.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma assinatura recente
                </p>
              )}
            </CardContent>
          </Card>

          {/* Alertas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Alertas
              </CardTitle>
              <CardDescription>Pontos de atenção</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(cancellationStats?.trend ?? 0) > 2 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 text-destructive">
                    <TrendingUp className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Alta nos cancelamentos</p>
                      <p className="text-xs opacity-80">
                        +{cancellationStats?.trend} cancelamentos comparado ao mês anterior
                      </p>
                    </div>
                  </div>
                )}
                {userStats?.paid && userStats.total && (userStats.paid / userStats.total) < 0.1 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 text-amber-600">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Taxa de conversão baixa</p>
                      <p className="text-xs opacity-80">
                        Apenas {((userStats.paid / userStats.total) * 100).toFixed(1)}% dos usuários são pagantes
                      </p>
                    </div>
                  </div>
                )}
                {(!cancellationStats?.trend || cancellationStats.trend <= 2) && 
                 (!userStats?.paid || !userStats.total || (userStats.paid / userStats.total) >= 0.1) && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 text-green-600">
                    <TrendingDown className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Tudo sob controle</p>
                      <p className="text-xs opacity-80">
                        Nenhum alerta crítico no momento
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <Link to="/app/admin/cancellations">
                  <MessageSquareOff className="h-4 w-4 mr-2" />
                  Analisar Cancelamentos
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/admin/reports">
                  <FileBarChart className="h-4 w-4 mr-2" />
                  Ver Relatórios Stripe
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ModeratorDashboard;
