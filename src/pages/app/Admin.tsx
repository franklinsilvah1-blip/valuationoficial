import { AppLayout } from "@/components/AppLayout";
import { AdminAuditLog } from "@/components/AdminAuditLog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, Database, Users, FileText, Bell, RefreshCw, Bug, Code, Mail, 
  BookOpen, MessageCircle, Save, UserCheck, UserPlus, TrendingUp, DollarSign,
  Gift, ArrowUpRight, ArrowDownRight, Percent, Activity, Clock, HardDrive
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/utils/formatters";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ChartPeriod = "6months" | "1month" | "1week";

const Admin = () => {
  const { isAdmin, loading } = useAdminCheck();
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [communityLink, setCommunityLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [salesWhatsappNumber, setSalesWhatsappNumber] = useState("");
  const [savingSalesWhatsapp, setSavingSalesWhatsapp] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("6months");
  const { toast } = useToast();

  // Fetch active clients count
  const { data: activeClientsCount = 0, isLoading: loadingClients } = useQuery({
    queryKey: ["admin-active-clients"],
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .neq("plan", "FREE")
        .neq("plan", "START");

      if (error) {
        console.error("Error fetching active clients:", error);
        return 0;
      }
      return count || 0;
    }
  });

  // Fetch new registrations (last 7 days)
  const { data: newRegistrationsCount = 0, isLoading: loadingRegistrations } = useQuery({
    queryKey: ["admin-new-registrations"],
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin,
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString());

      if (error) {
        console.error("Error fetching new registrations:", error);
        return 0;
      }
      return count || 0;
    }
  });

  // Fetch most simulated asset
  const { data: mostSimulatedAsset, isLoading: loadingAsset } = useQuery({
    queryKey: ["admin-most-simulated-asset"],
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin,
    queryFn: async () => {
      // Count wallet_items grouped by asset_id
      const { data: walletItems, error } = await supabase
        .from("wallet_items")
        .select("asset_id");

      if (error || !walletItems) {
        console.error("Error fetching wallet items:", error);
        return null;
      }

      // Count occurrences of each asset
      const assetCounts: Record<string, number> = {};
      walletItems.forEach(item => {
        assetCounts[item.asset_id] = (assetCounts[item.asset_id] || 0) + 1;
      });

      // Find the most common asset
      let maxCount = 0;
      let topAssetId = "";
      Object.entries(assetCounts).forEach(([assetId, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topAssetId = assetId;
        }
      });

      if (!topAssetId) return null;

      // Get asset details
      const { data: asset } = await supabase
        .from("assets")
        .select("codigo_b3, nome")
        .eq("id", topAssetId)
        .single();

      return asset ? { codigo: asset.codigo_b3, nome: asset.nome, count: maxCount } : null;
    }
  });

  // Fetch monthly revenue from Stripe
  const { data: stripeData, isLoading: loadingRevenue } = useQuery({
    queryKey: ["admin-stripe-reports"],
    staleTime: 10 * 60 * 1000,
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-reports");
      if (error) {
        console.error("Error fetching Stripe reports:", error);
        return null;
      }
      return data;
    }
  });

  // Fetch affiliate stats
  const { data: affiliateStats, isLoading: loadingAffiliates } = useQuery({
    queryKey: ["admin-affiliate-stats"],
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin,
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Total affiliates
      const { count: totalAffiliates } = await supabase
        .from("affiliates")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Referrals this month
      const { count: monthlyReferrals } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Conversions (commissions) this month
      const { data: monthlyCommissions } = await supabase
        .from("commissions")
        .select("amount")
        .gte("created_at", thirtyDaysAgo.toISOString());

      const totalCommissions = monthlyCommissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      // Clicks this month
      const { count: monthlyClicks } = await supabase
        .from("affiliate_clicks")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

      return {
        totalAffiliates: totalAffiliates || 0,
        monthlyReferrals: monthlyReferrals || 0,
        monthlyCommissions: totalCommissions,
        monthlyClicks: monthlyClicks || 0,
        conversionRate: monthlyClicks && monthlyClicks > 0 
          ? ((monthlyReferrals || 0) / monthlyClicks * 100).toFixed(1)
          : "0"
      };
    }
  });

  // Fetch today's stats
  const { data: todayStats, isLoading: loadingToday } = useQuery({
    queryKey: ["admin-today-stats"],
    staleTime: 2 * 60 * 1000,
    enabled: isAdmin,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // New users today
      const { count: newUsersToday } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());

      // Asset views today
      const { count: viewsToday } = await supabase
        .from("asset_views")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());

      return {
        newUsersToday: newUsersToday || 0,
        viewsToday: viewsToday || 0
      };
    }
  });

  // Fetch admin profile name
  const { data: adminProfile } = useQuery({
    queryKey: ["admin-profile", user?.id],
    staleTime: 60 * 60 * 1000,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user!.id)
        .single();
      return data;
    }
  });

  // Process chart data based on selected period
  const chartData = useMemo(() => {
    if (!stripeData) return [];

    const now = new Date();
    
    if (chartPeriod === "6months") {
      // Use monthly data for 6 months view
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      return (stripeData.monthlyData || [])
        .filter((item: any) => {
          const itemDate = new Date(item.month + "-01");
          return itemDate >= sixMonthsAgo;
        })
        .map((item: any) => ({
          label: new Date(item.month + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          revenue: item.revenue,
        }));
    } else if (chartPeriod === "1month") {
      // Use daily data for last month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      return (stripeData.dailyData || [])
        .filter((item: any) => {
          const itemDate = new Date(item.date);
          return itemDate >= oneMonthAgo;
        })
        .map((item: any) => ({
          label: new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
          revenue: item.revenue,
        }));
    } else {
      // Use daily data for last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      return (stripeData.dailyData || [])
        .filter((item: any) => {
          const itemDate = new Date(item.date);
          return itemDate >= oneWeekAgo;
        })
        .map((item: any) => ({
          label: new Date(item.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
          revenue: item.revenue,
        }));
    }
  }, [stripeData, chartPeriod]);

  // Calculate period total revenue
  const periodTotalRevenue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.revenue, 0);
  }, [chartData]);

  useEffect(() => {
    if (isAdmin) {
      loadCommunityLink();
      loadAdminEmail();
      loadSalesWhatsappNumber();
    }
  }, [isAdmin]);

  const loadCommunityLink = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "community_whatsapp_link")
      .maybeSingle();

    if (data) setCommunityLink(data.value);
  };

  const loadSalesWhatsappNumber = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "sales_whatsapp_number")
      .maybeSingle();

    if (data) setSalesWhatsappNumber(data.value);
  };

  const handleSaveSalesWhatsappNumber = async () => {
    // Normaliza para formato internacional: só dígitos, sem espaços,
    // parênteses, traços ou "+". Tamanho plausível de E.164 (DDI+DDD+número).
    const digitsOnly = salesWhatsappNumber.replace(/\D/g, "");
    if (!digitsOnly || digitsOnly.length < 10 || digitsOnly.length > 15) {
      toast({
        title: "Número inválido",
        description: "Informe o número com DDI e DDD, só dígitos, entre 10 e 15 dígitos (ex: 5511999999999)",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingSalesWhatsapp(true);

      const { error } = await supabase
        .from("app_config")
        .upsert({
          key: "sales_whatsapp_number",
          value: digitsOnly,
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (error) throw error;

      setSalesWhatsappNumber(digitsOnly);
      toast({
        title: "Número atualizado",
        description: "O número de WhatsApp comercial (CTA \"Falar com Especialista\") foi salvo com sucesso",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSavingSalesWhatsapp(false);
    }
  };

  const handleClearSalesWhatsappNumber = async () => {
    try {
      setSavingSalesWhatsapp(true);
      const { error } = await supabase
        .from("app_config")
        .delete()
        .eq("key", "sales_whatsapp_number");

      if (error) throw error;

      setSalesWhatsappNumber("");
      toast({
        title: "Número removido",
        description: "O CTA \"Falar com Especialista\" voltará a usar o formulário de contato até um novo número ser configurado.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao remover",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSavingSalesWhatsapp(false);
    }
  };

  const loadAdminEmail = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "admin_email")
      .maybeSingle();
    
    if (data) setAdminEmail(data.value);
  };

  const isValidEmail = (email: string): boolean => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email.trim());
  };

  const handleSaveAdminEmail = async () => {
    if (!adminEmail.trim()) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEmail(adminEmail)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email no formato correto",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingEmail(true);
      
      const { error } = await supabase
        .from("app_config")
        .upsert({ 
          key: "admin_email", 
          value: adminEmail.trim(),
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

      if (error) throw error;

      toast({
        title: "Email atualizado",
        description: "O email de notificações foi salvo com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const isValidWhatsAppLink = (link: string): boolean => {
    const whatsappPattern = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/;
    return whatsappPattern.test(link.trim());
  };

  const handleSaveCommunityLink = async () => {
    if (!communityLink.trim()) {
      toast({
        title: "Link inválido",
        description: "Por favor, insira um link da comunidade",
        variant: "destructive",
      });
      return;
    }

    if (!isValidWhatsAppLink(communityLink)) {
      toast({
        title: "Link inválido",
        description: "O link deve ser no formato: https://chat.whatsapp.com/...",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingLink(true);
      
      const { error } = await supabase
        .from("app_config")
        .upsert({ 
          key: "community_whatsapp_link", 
          value: communityLink,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

      if (error) throw error;

      toast({
        title: "Link atualizado",
        description: "O link da comunidade foi salvo com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingLink(false);
    }
  };

  // Don't render while checking permissions
  if (loading || !isAdmin) {
    return null;
  }

  const handleTestExpirationNotifications = async () => {
    try {
      setTesting(true);
      
      const { data, error } = await supabase.functions.invoke("check-expiring-plans");

      if (error) throw error;

      toast({
        title: "Notificações processadas",
        description: `${data.sent || 0} e-mail(s) enviado(s) de ${data.total || 0} plano(s) expirando`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao testar notificações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleManualBackup = async () => {
    try {
      setBackingUp(true);
      const { data, error } = await supabase.functions.invoke("backup-database");

      if (error) throw error;

      const criticalCount = data?.critical ? Object.values(data.critical).reduce((sum: number, t: any) => sum + (t.count || 0), 0) : 0;
      const fullCount = data?.full ? Object.values(data.full).reduce((sum: number, t: any) => sum + (t.count || 0), 0) : 0;

      toast({
        title: "Backup concluído",
        description: `Crítico: ${criticalCount} registros | Completo: ${fullCount} registros exportados para GitHub`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no backup",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBackingUp(false);
    }
  };

  const adminSections = [
    {
      title: "Google Sheets Sync",
      description: "Sincronização automática com planilha Google Sheets",
      icon: <RefreshCw className="h-8 w-8 text-primary" />,
      link: "/app/admin/sync",
    },
    {
      title: "Clientes",
      description: "Gerencie clientes e visualize status",
      icon: <Users className="h-8 w-8 text-primary" />,
      link: "/app/admin/clients",
    },
    {
      title: "Relatórios",
      description: "Visualize faturamento e estatísticas",
      icon: <FileText className="h-8 w-8 text-primary" />,
      link: "/app/admin/reports",
    },
    {
      title: "Configuração SMTP",
      description: "Configure envio de e-mails",
      icon: <Database className="h-8 w-8 text-primary" />,
      link: "/app/admin/smtp",
    },
    {
      title: "Debug de Dados",
      description: "Valide qualidade dos dados importados",
      icon: <Bug className="h-8 w-8 text-primary" />,
      link: "/app/admin/debug",
    },
    {
      title: "Pixels e Scripts",
      description: "Configure Google Analytics, GTM e outros",
      icon: <Code className="h-8 w-8 text-primary" />,
      link: "/app/admin/tracking",
    },
    {
      title: "Gerenciar Emails",
      description: "Visualize tipos de emails e configurações",
      icon: <Mail className="h-8 w-8 text-primary" />,
      link: "/app/admin/emails",
    },
    {
      title: "Gerenciar Blog",
      description: "Crie e publique artigos do blog",
      icon: <BookOpen className="h-8 w-8 text-primary" />,
      link: "/app/admin/blog",
    },
  ];

  const monthlyRevenue = stripeData?.currentMonth?.revenue || 0;
  const previousMonthRevenue = stripeData?.previousMonth?.revenue || 0;
  const revenueGrowth = previousMonthRevenue > 0 
    ? (((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1)
    : "0";
  const isRevenueUp = Number(revenueGrowth) >= 0;

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const adminName = adminProfile?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Admin";
  const currentDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <AppLayout title="Administração">
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                {getGreeting()}, {adminName}! 👋
              </h1>
              <p className="text-muted-foreground mt-1 capitalize">{currentDate}</p>
            </div>
            
            {/* Quick Today Stats */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 border">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Novos hoje</p>
                  {loadingToday ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <p className="font-semibold">{todayStats?.newUsersToday || 0} usuários</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 border">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Visualizações hoje</p>
                  {loadingToday ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <p className="font-semibold">{todayStats?.viewsToday || 0} ativos</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 - Clientes Ativos */}
          <Link to="/app/admin/clients">
            <Card className="hover:shadow-elevated transition-all duration-300 cursor-pointer h-full border-primary/10 hover:border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Clientes Ativos</p>
                    {loadingClients ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <p className="text-4xl font-bold text-foreground">{activeClientsCount}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Total de assinantes ativos</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <UserCheck className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 2 - Novos Cadastros */}
          <Link to="/app/admin/users">
            <Card className="hover:shadow-elevated transition-all duration-300 cursor-pointer h-full border-primary/10 hover:border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Novos Cadastros</p>
                    {loadingRegistrations ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <p className="text-4xl font-bold text-foreground">{newRegistrationsCount}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
                  </div>
                  <div className="p-3 bg-secondary/10 rounded-xl">
                    <UserPlus className="h-6 w-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 3 - Ativos Mais Simulados */}
          <Card className="border-primary/10">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Ativo Mais Simulado</p>
                  {loadingAsset ? (
                    <Skeleton className="h-10 w-32" />
                  ) : mostSimulatedAsset ? (
                    <p className="text-2xl font-bold text-foreground">
                      {mostSimulatedAsset.codigo}
                      <span className="text-lg font-normal text-muted-foreground ml-2">
                        ({mostSimulatedAsset.count}x)
                      </span>
                    </p>
                  ) : (
                    <p className="text-xl font-medium text-muted-foreground">Sem dados</p>
                  )}
                  <p className="text-xs text-muted-foreground">Ativo mais consultado no simulador</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 - Faturamento Mensal */}
          <Link to="/app/admin/reports">
            <Card className="hover:shadow-elevated transition-all duration-300 cursor-pointer h-full border-primary/10 hover:border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Faturamento Mensal</p>
                    {loadingRevenue ? (
                      <Skeleton className="h-10 w-28" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground">{formatCurrency(monthlyRevenue)}</p>
                    )}
                    <div className="flex items-center gap-1">
                      {isRevenueUp ? (
                        <ArrowUpRight className="h-3 w-3 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                      )}
                      <span className={`text-xs ${isRevenueUp ? "text-green-500" : "text-red-500"}`}>
                        {revenueGrowth}% vs mês anterior
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-xl">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Affiliate Program Stats */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Programa de Afiliados</h2>
            <Link to="/app/admin/affiliates">
              <Badge variant="outline" className="ml-2 cursor-pointer hover:bg-primary/10">
                Ver detalhes →
              </Badge>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-primary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Afiliados Ativos</p>
                    {loadingAffiliates ? (
                      <Skeleton className="h-7 w-12 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{affiliateStats?.totalAffiliates || 0}</p>
                    )}
                  </div>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Cliques (30d)</p>
                    {loadingAffiliates ? (
                      <Skeleton className="h-7 w-12 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{affiliateStats?.monthlyClicks || 0}</p>
                    )}
                  </div>
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                    {loadingAffiliates ? (
                      <Skeleton className="h-7 w-12 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{affiliateStats?.conversionRate}%</p>
                    )}
                  </div>
                  <Percent className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Comissões (30d)</p>
                    {loadingAffiliates ? (
                      <Skeleton className="h-7 w-16 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{formatCurrency(affiliateStats?.monthlyCommissions || 0)}</p>
                    )}
                  </div>
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Revenue Chart */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Evolução do Faturamento</CardTitle>
                <CardDescription>
                  Total no período: <span className="font-semibold text-foreground">{formatCurrency(periodTotalRevenue)}</span>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={chartPeriod === "1week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod("1week")}
                >
                  7 dias
                </Button>
                <Button
                  variant={chartPeriod === "1month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod("1month")}
                >
                  30 dias
                </Button>
                <Button
                  variant={chartPeriod === "6months" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartPeriod("6months")}
                >
                  6 meses
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRevenue ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      tickFormatter={(value) => `R$${value}`}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado de faturamento disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Sections */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Ferramentas de Gestão</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {adminSections.map((section, index) => (
              <Card
                key={index}
                className="shadow-card hover:shadow-elevated transition-all duration-300"
              >
                <CardHeader className="pb-2">
                  <div className="mb-2">{section.icon}</div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="text-xs">{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link to={section.link}>
                    <Button variant="default" size="sm" className="w-full">
                      Acessar
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}

            {/* Card para testar notificações de expiração */}
            <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="mb-2">
                  <Bell className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-base">Testar Notificações</CardTitle>
                <CardDescription className="text-xs">
                  Enviar alertas de expiração (auto às 9h)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={handleTestExpirationNotifications} 
                  disabled={testing}
                  variant="default" 
                  size="sm"
                  className="w-full"
                >
                  {testing ? "Enviando..." : "Testar Agora"}
                </Button>
              </CardContent>
            </Card>

            {/* Card para backup - link para página dedicada */}
            <Link to="/app/admin/backups">
              <Card className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="mb-2">
                    <HardDrive className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-base">Backups</CardTitle>
                  <CardDescription className="text-xs">
                    Gerencie backups manuais e automáticos
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button variant="outline" size="sm" className="w-full">
                    Gerenciar Backups
                  </Button>
                </CardContent>
              </Card>
            </Link>

            {/* Card para editar link da comunidade WhatsApp */}
            <Card className="shadow-card hover:shadow-elevated transition-all duration-300 col-span-1 md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="mb-2">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-base">Comunidade WhatsApp</CardTitle>
                <CardDescription className="text-xs">
                  Link da comunidade para assinantes
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Input
                  value={communityLink}
                  onChange={(e) => setCommunityLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="text-xs"
                />
                <Button 
                  onClick={handleSaveCommunityLink} 
                  disabled={savingLink}
                  variant="default" 
                  size="sm"
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingLink ? "Salvando..." : "Salvar"}
                </Button>
              </CardContent>
            </Card>

            {/* Card para editar número de WhatsApp comercial (CTA "Falar com Especialista" / WEALTH) */}
            <Card className="shadow-card hover:shadow-elevated transition-all duration-300 col-span-1 md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="mb-2">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-base">WhatsApp Comercial (WEALTH)</CardTitle>
                <CardDescription className="text-xs">
                  Número usado no CTA "Falar com Especialista". Sem número configurado, o botão leva ao formulário de contato.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Input
                  value={salesWhatsappNumber}
                  onChange={(e) => setSalesWhatsappNumber(e.target.value)}
                  placeholder="5511999999999 (DDI+DDD+número)"
                  className="text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveSalesWhatsappNumber}
                    disabled={savingSalesWhatsapp}
                    variant="default"
                    size="sm"
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savingSalesWhatsapp ? "Salvando..." : "Salvar"}
                  </Button>
                  {salesWhatsappNumber && (
                    <Button
                      onClick={handleClearSalesWhatsappNumber}
                      disabled={savingSalesWhatsapp}
                      variant="outline"
                      size="sm"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card para editar email de notificações */}
            <Card className="shadow-card hover:shadow-elevated transition-all duration-300 col-span-1 md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="mb-2">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-base">Email de Notificações</CardTitle>
                <CardDescription className="text-xs">
                  Receba alertas de novos afiliados e eventos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="text-xs"
                />
                <Button 
                  onClick={handleSaveAdminEmail} 
                  disabled={savingEmail}
                  variant="default" 
                  size="sm"
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingEmail ? "Salvando..." : "Salvar"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Audit Log Section */}
        <div>
          <AdminAuditLog />
        </div>
      </div>
    </AppLayout>
  );
};

export default Admin;