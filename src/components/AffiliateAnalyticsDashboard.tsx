import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
  PieChart,
  Pie,
  ComposedChart
} from "recharts";
import { 
  format, 
  subDays, 
  subMonths, 
  startOfDay, 
  startOfMonth,
  startOfYear,
  endOfDay, 
  endOfMonth, 
  eachMonthOfInterval, 
  eachDayOfInterval,
  parseISO, 
  isWithinInterval,
  isAfter
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity, 
  Filter, 
  Trophy,
  Target,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  UserCheck,
  CreditCard,
  BarChart3,
  Zap
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface Affiliate {
  id: string;
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
  status: string;
  total_referrals: number;
  total_earnings: number;
  created_at: string;
  last_revenue_at: string | null;
  profile?: {
    name: string | null;
    email: string | null;
  };
}

interface Referral {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  status: string;
  converted_at: string | null;
  created_at: string;
}

interface Commission {
  id: string;
  affiliate_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface AffiliateClick {
  id: string;
  affiliate_id: string;
  affiliate_code: string;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  landing_page: string | null;
  session_id: string | null;
  created_at: string;
}

interface AffiliateAnalyticsDashboardProps {
  affiliates: Affiliate[];
  referrals: Referral[];
  commissions: Commission[];
  clicks?: AffiliateClick[];
  isLoading?: boolean;
}

type PeriodFilter = "today" | "7days" | "30days" | "6months" | "year";

const FUNNEL_COLORS = ["hsl(var(--primary))", "hsl(220 70% 50%)", "hsl(142.1 76.2% 36.3%)"];

export function AffiliateAnalyticsDashboard({ 
  affiliates,
  referrals, 
  commissions,
  clicks = [],
  isLoading 
}: AffiliateAnalyticsDashboardProps) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30days");

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    const end = endOfDay(now);
    let start: Date;

    switch (periodFilter) {
      case "today":
        start = startOfDay(now);
        break;
      case "7days":
        start = startOfDay(subDays(now, 7));
        break;
      case "30days":
        start = startOfDay(subDays(now, 30));
        break;
      case "6months":
        start = startOfMonth(subMonths(now, 6));
        break;
      case "year":
        start = startOfYear(now);
        break;
      default:
        start = startOfDay(subDays(now, 30));
    }

    return { start, end };
  }, [periodFilter]);

  // Filter data by period
  const filteredReferrals = useMemo(() => {
    return referrals.filter(r => {
      const createdAt = parseISO(r.created_at);
      return isWithinInterval(createdAt, dateRange);
    });
  }, [referrals, dateRange]);

  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => {
      const createdAt = parseISO(c.created_at);
      return isWithinInterval(createdAt, dateRange);
    });
  }, [commissions, dateRange]);

  // Filter clicks by period
  const filteredClicks = useMemo(() => {
    return clicks.filter(c => {
      const createdAt = parseISO(c.created_at);
      return isWithinInterval(createdAt, dateRange);
    });
  }, [clicks, dateRange]);

  // Calculate trend data for the period
  const trendData = useMemo(() => {
    const { start, end } = dateRange;
    const useMonthly = periodFilter === "6months" || periodFilter === "year";

    if (useMonthly) {
      const months = eachMonthOfInterval({ start, end });
      return months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthReferrals = referrals.filter(r => {
          const createdAt = parseISO(r.created_at);
          return isWithinInterval(createdAt, { start: monthStart, end: monthEnd });
        });

        const monthConversions = referrals.filter(r => {
          if (!r.converted_at) return false;
          const convertedAt = parseISO(r.converted_at);
          return isWithinInterval(convertedAt, { start: monthStart, end: monthEnd });
        });

        const monthCommissions = commissions.filter(c => {
          const createdAt = parseISO(c.created_at);
          return isWithinInterval(createdAt, { start: monthStart, end: monthEnd });
        });

        const totalCommissions = monthCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
        const paidCommissions = monthCommissions
          .filter(c => c.status === "paid")
          .reduce((sum, c) => sum + Number(c.amount), 0);

        // Estimate affiliate sales (commissions / avg commission rate ~10%)
        const estimatedAffiliateSales = totalCommissions > 0 ? totalCommissions * 10 : 0;

        return {
          period: format(month, "MMM/yy", { locale: ptBR }),
          periodFull: format(month, "MMMM yyyy", { locale: ptBR }),
          indicacoes: monthReferrals.length,
          conversoes: monthConversions.length,
          vendasAfiliados: estimatedAffiliateSales,
          comissoesPagas: paidCommissions,
          comissoesTotal: totalCommissions
        };
      });
    } else {
      const days = eachDayOfInterval({ start, end });
      return days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        const dayReferrals = referrals.filter(r => {
          const createdAt = parseISO(r.created_at);
          return isWithinInterval(createdAt, { start: dayStart, end: dayEnd });
        });

        const dayConversions = referrals.filter(r => {
          if (!r.converted_at) return false;
          const convertedAt = parseISO(r.converted_at);
          return isWithinInterval(convertedAt, { start: dayStart, end: dayEnd });
        });

        const dayCommissions = commissions.filter(c => {
          const createdAt = parseISO(c.created_at);
          return isWithinInterval(createdAt, { start: dayStart, end: dayEnd });
        });

        const totalCommissions = dayCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
        const paidCommissions = dayCommissions
          .filter(c => c.status === "paid")
          .reduce((sum, c) => sum + Number(c.amount), 0);

        const estimatedAffiliateSales = totalCommissions > 0 ? totalCommissions * 10 : 0;

        return {
          period: format(day, "dd/MM", { locale: ptBR }),
          periodFull: format(day, "dd 'de' MMMM", { locale: ptBR }),
          indicacoes: dayReferrals.length,
          conversoes: dayConversions.length,
          vendasAfiliados: estimatedAffiliateSales,
          comissoesPagas: paidCommissions,
          comissoesTotal: totalCommissions
        };
      });
    }
  }, [dateRange, referrals, commissions, periodFilter]);

  // Funnel data - Use real clicks if available, otherwise estimate
  const funnelData = useMemo(() => {
    const totalReferrals = filteredReferrals.length;
    const conversions = filteredReferrals.filter(r => r.converted_at).length;

    // Use real click data if available, otherwise estimate
    const totalClicks = filteredClicks.length > 0 
      ? filteredClicks.length 
      : (totalReferrals * 10); // Fallback estimate

    const hasRealClicks = filteredClicks.length > 0;

    return [
      { 
        name: hasRealClicks ? "Cliques Reais" : "Cliques Estimados", 
        value: totalClicks, 
        fill: FUNNEL_COLORS[0],
        isReal: hasRealClicks
      },
      { name: "Novos Registros", value: totalReferrals, fill: FUNNEL_COLORS[1], isReal: true },
      { name: "Assinaturas Convertidas", value: conversions, fill: FUNNEL_COLORS[2], isReal: true }
    ];
  }, [filteredReferrals, filteredClicks]);

  // Top 5 affiliates by revenue in the period
  const topAffiliates = useMemo(() => {
    const affiliateRevenue = new Map<string, { affiliate: Affiliate; revenue: number; sales: number }>();

    filteredCommissions.forEach(c => {
      const affiliate = affiliates.find(a => a.id === c.affiliate_id);
      if (!affiliate) return;

      const existing = affiliateRevenue.get(c.affiliate_id) || { 
        affiliate, 
        revenue: 0, 
        sales: 0 
      };
      existing.revenue += Number(c.amount);
      existing.sales += 1;
      affiliateRevenue.set(c.affiliate_id, existing);
    });

    return Array.from(affiliateRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredCommissions, affiliates]);

  // ROI Metrics
  const roiMetrics = useMemo(() => {
    const totalCommissionsPaid = filteredCommissions
      .filter(c => c.status === "paid")
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const totalCommissionsAll = filteredCommissions
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const newCustomersFromAffiliates = filteredReferrals.filter(r => r.converted_at).length;

    // CAC (Cost per Acquisition via Affiliates)
    const cac = newCustomersFromAffiliates > 0 
      ? totalCommissionsPaid / newCustomersFromAffiliates 
      : 0;

    // Estimated revenue from affiliates (commissions are typically 10% of sale)
    const estimatedAffiliateRevenue = totalCommissionsAll * 10;

    // This would need real platform revenue data
    // For now, we'll estimate total platform revenue as 3x affiliate revenue
    const estimatedTotalRevenue = estimatedAffiliateRevenue * 3;

    const revenueShare = estimatedTotalRevenue > 0 
      ? (estimatedAffiliateRevenue / estimatedTotalRevenue) * 100 
      : 0;

    // ROI calculation: (Revenue Generated - Cost) / Cost * 100
    const roi = totalCommissionsPaid > 0 
      ? ((estimatedAffiliateRevenue - totalCommissionsPaid) / totalCommissionsPaid) * 100 
      : 0;

    // Conversion rate
    const conversionRate = filteredReferrals.length > 0 
      ? (newCustomersFromAffiliates / filteredReferrals.length) * 100 
      : 0;

    return {
      cac,
      revenueShare,
      roi,
      conversionRate,
      totalCommissionsPaid,
      estimatedAffiliateRevenue,
      newCustomers: newCustomersFromAffiliates
    };
  }, [filteredCommissions, filteredReferrals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{payload[0]?.payload?.periodFull || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes("Vendas") || entry.name.includes("Comiss") 
                ? formatCurrency(entry.value) 
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case "today": return "Hoje";
      case "7days": return "Últimos 7 dias";
      case "30days": return "Últimos 30 dias";
      case "6months": return "Últimos 6 meses";
      case "year": return "Este ano";
      default: return "";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Período:</span>
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          {getPeriodLabel()}
        </Badge>
      </div>

      {/* ROI Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAC Médio</CardTitle>
            <Target className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(roiMetrics.cac)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Custo por aquisição via afiliados
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI do Programa</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-1 ${roiMetrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roiMetrics.roi >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              {roiMetrics.roi.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Retorno sobre investimento
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Share de Receita</CardTitle>
            <PieChartIcon className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {roiMetrics.revenueShare.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              % do faturamento via afiliados
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Percent className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {roiMetrics.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {roiMetrics.newCustomers} conversões de {filteredReferrals.length} indicações
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart - Vendas vs Comissões */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tendência: Vendas via Afiliados vs Comissões
            </CardTitle>
            <CardDescription>Comparativo de receita gerada e comissões pagas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="period" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    yAxisId="left"
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="vendasAfiliados" 
                    name="Vendas via Afiliados (est.)"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="comissoesPagas" 
                    name="Comissões Pagas"
                    stroke="hsl(142.1 76.2% 36.3%)" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(142.1 76.2% 36.3%)', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Funil de Conversão
            </CardTitle>
            <CardDescription>Eficiência do programa de afiliados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((item, index) => {
                const maxValue = funnelData[0].value || 1;
                const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const conversionFromPrevious = index > 0 && funnelData[index - 1].value > 0
                  ? ((item.value / funnelData[index - 1].value) * 100).toFixed(1)
                  : null;

                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{item.value.toLocaleString()}</span>
                        {conversionFromPrevious && (
                          <Badge variant="secondary" className="text-xs">
                            {conversionFromPrevious}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={percentage} 
                      className="h-3"
                      style={{ 
                        // @ts-ignore
                        '--progress-background': item.fill 
                      } as React.CSSProperties}
                    />
                  </div>
                );
              })}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de Conversão Total</span>
                  <span className="text-lg font-bold text-green-600">
                    {funnelData[0].value > 0 
                      ? ((funnelData[2].value / funnelData[0].value) * 100).toFixed(2) 
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Top Affiliates & Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Affiliates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top 5 Afiliados
            </CardTitle>
            <CardDescription>Maiores geradores de receita no período</CardDescription>
          </CardHeader>
          <CardContent>
            {topAffiliates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma comissão registrada no período</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topAffiliates.map((item, index) => (
                  <div 
                    key={item.affiliate.id} 
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(item.affiliate.profile?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.affiliate.profile?.name || "Afiliado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.sales} {item.sales === 1 ? 'venda' : 'vendas'} • Código: {item.affiliate.affiliate_code}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(item.revenue)}</p>
                      <p className="text-xs text-muted-foreground">em comissões</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Indicações e Conversões Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Indicações vs Conversões
            </CardTitle>
            <CardDescription>Evolução de indicações e conversões no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="period" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="indicacoes" 
                    name="Indicações"
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.3)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversoes" 
                    name="Conversões"
                    stroke="hsl(142.1 76.2% 36.3%)" 
                    fill="hsl(142.1 76.2% 36.3% / 0.3)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-500" />
            Resumo do Período
          </CardTitle>
          <CardDescription>Métricas consolidadas para {getPeriodLabel().toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <Zap className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{filteredClicks.length > 0 ? filteredClicks.length : '—'}</p>
              <p className="text-xs text-muted-foreground">
                {filteredClicks.length > 0 ? 'Cliques Reais' : 'Sem dados'}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{filteredReferrals.length}</p>
              <p className="text-xs text-muted-foreground">Indicações</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <UserCheck className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{roiMetrics.newCustomers}</p>
              <p className="text-xs text-muted-foreground">Conversões</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <CreditCard className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{filteredCommissions.length}</p>
              <p className="text-xs text-muted-foreground">Comissões</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{formatCurrency(roiMetrics.totalCommissionsPaid)}</p>
              <p className="text-xs text-muted-foreground">Pago em Comissões</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{formatCurrency(roiMetrics.estimatedAffiliateRevenue)}</p>
              <p className="text-xs text-muted-foreground">Receita Gerada (est.)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <Trophy className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">{affiliates.filter(a => a.status === 'active').length}</p>
              <p className="text-xs text-muted-foreground">Afiliados Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
