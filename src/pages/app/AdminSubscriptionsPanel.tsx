import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { 
  Users, 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CreditCard,
  UserX,
  Calendar,
  Settings
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminSubscriptionsPanel() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();

  // Fetch all profiles with subscription data
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["admin-profiles-subscriptions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, plan, plan_start_at, plan_end_at, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch cancellation feedback
  const { data: cancellations = [], isLoading: isLoadingCancellations } = useQuery({
    queryKey: ["admin-cancellations-summary"],
    enabled: isAdmin,
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("cancellation_feedback")
        .select("*")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = startOfMonth(now);
    const lastMonth = startOfMonth(subMonths(now, 1));
    const endLastMonth = endOfMonth(subMonths(now, 1));

    // Active subscribers (non-FREE plans)
    const activeSubscribers = profiles.filter(p => p.plan !== "FREE");
    
    // Free users
    const freeUsers = profiles.filter(p => p.plan === "FREE");

    // Plan breakdown
    const planCounts = {
      START: profiles.filter(p => p.plan === "START").length,
      PRO: profiles.filter(p => p.plan === "PRO").length,
      SPECIALIST: profiles.filter(p => p.plan === "SPECIALIST").length,
      FREE: profiles.filter(p => p.plan === "FREE").length,
    };

    // New subscribers this month
    const newThisMonth = activeSubscribers.filter(p => {
      if (!p.plan_start_at) return false;
      const startDate = new Date(p.plan_start_at);
      return startDate >= thisMonth;
    }).length;

    // New subscribers last month
    const newLastMonth = activeSubscribers.filter(p => {
      if (!p.plan_start_at) return false;
      const startDate = new Date(p.plan_start_at);
      return startDate >= lastMonth && startDate <= endLastMonth;
    }).length;

    // Growth rate
    const growthRate = newLastMonth > 0 
      ? ((newThisMonth - newLastMonth) / newLastMonth * 100).toFixed(1)
      : newThisMonth > 0 ? 100 : 0;

    // Expiring soon (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringSoon = activeSubscribers.filter(p => {
      if (!p.plan_end_at) return false;
      const endDate = new Date(p.plan_end_at);
      return endDate <= sevenDaysFromNow && endDate >= now;
    }).length;

    // Churn rate (cancellations this month / active at start of month)
    const cancelledThisMonth = cancellations.filter(c => {
      const cancelDate = new Date(c.created_at);
      return cancelDate >= thisMonth;
    }).length;
    
    const churnRate = activeSubscribers.length > 0 
      ? (cancelledThisMonth / (activeSubscribers.length + cancelledThisMonth) * 100).toFixed(1)
      : 0;

    return {
      totalSubscribers: activeSubscribers.length,
      freeUsers: freeUsers.length,
      planCounts,
      newThisMonth,
      growthRate: Number(growthRate),
      expiringSoon,
      cancelledThisMonth,
      churnRate: Number(churnRate),
    };
  }, [profiles, cancellations]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Estimated MRR based on plan prices (monthly values)
  const planPrices = {
    START: 49,
    PRO: 99,
    SPECIALIST: 199,
    FALE_C_ESPECIALISTA: 0, // Consultation, not recurring
  };

  const estimatedMRR = useMemo(() => {
    return (
      metrics.planCounts.START * planPrices.START +
      metrics.planCounts.PRO * planPrices.PRO +
      metrics.planCounts.SPECIALIST * planPrices.SPECIALIST
    );
  }, [metrics.planCounts]);

  if (adminLoading || !isAdmin) {
    return null;
  }

  const isLoading = isLoadingProfiles || isLoadingCancellations;

  return (
    <AppLayout title="Painel de Assinaturas">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app/admin">Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Painel de Assinaturas</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinantes Ativos</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{metrics.totalSubscribers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{metrics.newThisMonth} este mês
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR Estimado</CardTitle>
              <DollarSign className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(estimatedMRR)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    receita recorrente mensal
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={`border-orange-500/20 ${metrics.expiringSoon > 0 ? 'ring-2 ring-orange-500/30' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expirando em 7 dias</CardTitle>
              <Calendar className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-orange-600">{metrics.expiringSoon}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    assinaturas
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-red-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-red-600">{metrics.churnRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.cancelledThisMonth} cancelamentos este mês
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Plano</CardTitle>
            <CardDescription>Quantidade de assinantes em cada plano</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{metrics.freeUsers}</p>
                  <p className="text-sm text-muted-foreground">FREE</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                  <p className="text-2xl font-bold text-blue-600">{metrics.planCounts.START}</p>
                  <p className="text-sm text-muted-foreground">START</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 text-center">
                  <p className="text-2xl font-bold text-purple-600">{metrics.planCounts.PRO}</p>
                  <p className="text-sm text-muted-foreground">PRO</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-500/10 text-center">
                  <p className="text-2xl font-bold text-amber-600">{metrics.planCounts.SPECIALIST}</p>
                  <p className="text-sm text-muted-foreground">SPECIALIST</p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 text-center">
                  <p className="text-2xl font-bold text-green-600">{metrics.planCounts.FREE}</p>
                  <p className="text-sm text-muted-foreground">FREE</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/subscribers")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Lista de Assinantes</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/cancellations")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Cancelamentos</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/reports")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Relatórios Financeiros</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/clients")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Gerenciar Clientes</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group border-primary/30"
            onClick={() => navigate("/app/admin/plans")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                <span className="font-medium">Gerenciar Planos</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
