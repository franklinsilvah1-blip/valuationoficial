import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCheck,
  ArrowRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function AdminAffiliatesPanel() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();

  // Fetch affiliates with profile data
  const { data: affiliates = [], isLoading: isLoadingAffiliates } = useQuery({
    queryKey: ["admin-affiliates"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: affiliatesData, error: affiliatesError } = await supabase
        .from("affiliates")
        .select("*")
        .order("created_at", { ascending: false });

      if (affiliatesError) throw affiliatesError;

      return affiliatesData || [];
    },
  });

  // Fetch all commissions
  const { data: commissions = [] } = useQuery({
    queryKey: ["admin-commissions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (commissionsError) throw commissionsError;
      return commissionsData || [];
    },
  });

  // Helper function to calculate days since last activity
  const getDaysSinceLastActivity = (affiliate: any): number => {
    const referenceDate = affiliate.last_revenue_at 
      ? new Date(affiliate.last_revenue_at) 
      : new Date(affiliate.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - referenceDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Check if affiliate is at risk (45+ days without revenue)
  const isAtRisk = (affiliate: any): boolean => {
    if (affiliate.status !== "active") return false;
    return getDaysSinceLastActivity(affiliate) >= 45;
  };

  // Calculate metrics
  const totalPendingCommissions = commissions
    .filter((c: any) => c.status === "pending")
    .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  const activeAffiliates = affiliates.filter((a: any) => a.status === "active").length;
  const pendingAffiliates = affiliates.filter((a: any) => a.status === "pending").length;
  const atRiskAffiliates = affiliates.filter((a: any) => isAtRisk(a)).length;
  const totalReferrals = affiliates.reduce((sum: number, a: any) => sum + (a.total_referrals || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Painel de Afiliados">
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
              <BreadcrumbPage>Painel de Afiliados</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Pending Affiliates Alert */}
        {pendingAffiliates > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    {pendingAffiliates} afiliado{pendingAffiliates > 1 ? 's' : ''} aguardando aprovação
                  </p>
                  <p className="text-sm text-yellow-700/80 dark:text-yellow-300/80">
                    Revise as solicitações pendentes
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10"
                  onClick={() => navigate("/app/admin/affiliates?status=pending")}
                >
                  Ver Pendentes
                </Button>
                <Button 
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => navigate("/app/admin/affiliates?status=pending&batch=true")}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Aprovar Todos ({pendingAffiliates})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card 
            className="border-primary/20 cursor-pointer hover:bg-primary/5 transition-colors"
            onClick={() => navigate("/app/admin/affiliates?status=active")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Afiliados Ativos</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeAffiliates}</div>
              <p className="text-xs text-muted-foreground mt-1">
                de {affiliates.length} total
              </p>
            </CardContent>
          </Card>

          <Card 
            className={`border-yellow-500/20 cursor-pointer transition-colors hover:bg-yellow-500/5 ${pendingAffiliates > 0 ? 'ring-2 ring-yellow-500/30' : ''}`}
            onClick={() => navigate("/app/admin/affiliates?status=pending")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aguardando Aprovação</CardTitle>
              <Clock className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{pendingAffiliates}</div>
              <p className="text-xs text-muted-foreground mt-1">
                solicitações pendentes
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-orange-500/20 cursor-pointer hover:bg-orange-500/5 transition-colors"
            onClick={() => navigate("/app/admin/affiliates?status=at_risk")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Risco de Inatividade</CardTitle>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{atRiskAffiliates}</div>
              <p className="text-xs text-muted-foreground mt-1">
                45+ dias sem receita
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-green-500/20 cursor-pointer hover:bg-green-500/5 transition-colors"
            onClick={() => navigate("/app/admin/affiliates/commissions")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <DollarSign className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(totalPendingCommissions)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                aguardando pagamento
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Indicações</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalReferrals}</div>
              <p className="text-xs text-muted-foreground mt-1">
                usuários indicados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/affiliates")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Gerenciar Afiliados</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/affiliates/analytics")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Analytics</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/affiliates/commissions")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Comissões</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate("/app/admin/affiliates/performance")}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Histórico</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
