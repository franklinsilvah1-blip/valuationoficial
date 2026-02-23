import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Area
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Users, DollarSign, Activity } from "lucide-react";

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

interface AffiliatePerformanceChartsProps {
  referrals: Referral[];
  commissions: Commission[];
  isLoading?: boolean;
}

export function AffiliatePerformanceCharts({ 
  referrals, 
  commissions, 
  isLoading 
}: AffiliatePerformanceChartsProps) {
  // Generate last 12 months data
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 11),
      end: endOfMonth(now)
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Count referrals in this month
      const monthReferrals = referrals.filter(r => {
        const createdAt = parseISO(r.created_at);
        return isWithinInterval(createdAt, { start: monthStart, end: monthEnd });
      });

      // Count conversions in this month
      const monthConversions = referrals.filter(r => {
        if (!r.converted_at) return false;
        const convertedAt = parseISO(r.converted_at);
        return isWithinInterval(convertedAt, { start: monthStart, end: monthEnd });
      });

      // Sum commissions in this month
      const monthCommissions = commissions.filter(c => {
        const createdAt = parseISO(c.created_at);
        return isWithinInterval(createdAt, { start: monthStart, end: monthEnd });
      });

      const totalCommissions = monthCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
      const paidCommissions = monthCommissions
        .filter(c => c.status === "paid")
        .reduce((sum, c) => sum + Number(c.amount), 0);
      const pendingCommissions = monthCommissions
        .filter(c => c.status === "pending")
        .reduce((sum, c) => sum + Number(c.amount), 0);

      return {
        month: format(month, "MMM/yy", { locale: ptBR }),
        monthFull: format(month, "MMMM yyyy", { locale: ptBR }),
        indicacoes: monthReferrals.length,
        conversoes: monthConversions.length,
        comissoesTotal: totalCommissions,
        comissoesPagas: paidCommissions,
        comissoesPendentes: pendingCommissions,
        taxaConversao: monthReferrals.length > 0 
          ? Math.round((monthConversions.length / monthReferrals.length) * 100)
          : 0
      };
    });
  }, [referrals, commissions]);

  // Calculate growth metrics
  const growthMetrics = useMemo(() => {
    if (monthlyData.length < 2) return { referrals: 0, commissions: 0 };

    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];

    const referralGrowth = previousMonth.indicacoes > 0
      ? ((currentMonth.indicacoes - previousMonth.indicacoes) / previousMonth.indicacoes) * 100
      : currentMonth.indicacoes > 0 ? 100 : 0;

    const commissionGrowth = previousMonth.comissoesTotal > 0
      ? ((currentMonth.comissoesTotal - previousMonth.comissoesTotal) / previousMonth.comissoesTotal) * 100
      : currentMonth.comissoesTotal > 0 ? 100 : 0;

    return {
      referrals: Math.round(referralGrowth),
      commissions: Math.round(commissionGrowth)
    };
  }, [monthlyData]);

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
          <p className="font-medium text-foreground mb-2">{payload[0]?.payload?.monthFull}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes("Comiss") ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crescimento Indicações</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${growthMetrics.referrals >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthMetrics.referrals >= 0 ? '+' : ''}{growthMetrics.referrals}%
            </div>
            <p className="text-xs text-muted-foreground">vs mês anterior</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crescimento Comissões</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${growthMetrics.commissions >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthMetrics.commissions >= 0 ? '+' : ''}{growthMetrics.commissions}%
            </div>
            <p className="text-xs text-muted-foreground">vs mês anterior</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Indicações (12m)</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monthlyData.reduce((sum, m) => sum + m.indicacoes, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {monthlyData.reduce((sum, m) => sum + m.conversoes, 0)} convertidas
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comissões (12m)</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(monthlyData.reduce((sum, m) => sum + m.comissoesTotal, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(monthlyData.reduce((sum, m) => sum + m.comissoesPagas, 0))} pagas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referrals & Conversions Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Indicações e Conversões
            </CardTitle>
            <CardDescription>Evolução mensal de indicações e conversões</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="indicacoes" 
                    name="Indicações"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversoes" 
                    name="Conversões"
                    stroke="hsl(142.1 76.2% 36.3%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(142.1 76.2% 36.3%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Commissions Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Comissões ao Longo do Tempo
            </CardTitle>
            <CardDescription>Evolução mensal de comissões geradas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="comissoesPagas" 
                    name="Comissões Pagas"
                    stackId="1"
                    stroke="hsl(142.1 76.2% 36.3%)" 
                    fill="hsl(142.1 76.2% 36.3% / 0.6)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="comissoesPendentes" 
                    name="Comissões Pendentes"
                    stackId="1"
                    stroke="hsl(47.9 95.8% 53.1%)" 
                    fill="hsl(47.9 95.8% 53.1% / 0.6)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Taxa de Conversão
            </CardTitle>
            <CardDescription>Percentual de indicações que converteram em clientes pagantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="taxaConversao" 
                    name="Taxa de Conversão (%)"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Comparison Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Comparativo Mensal
            </CardTitle>
            <CardDescription>Indicações vs Conversões por mês</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="indicacoes" 
                    name="Indicações"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="conversoes" 
                    name="Conversões"
                    fill="hsl(142.1 76.2% 36.3%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
