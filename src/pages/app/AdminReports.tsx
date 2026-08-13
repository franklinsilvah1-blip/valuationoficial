import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, Users, Calendar, Download, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface MonthlyRevenue {
  month: string;
  revenue: number;
  customers: number;
  start: number;
  pro: number;
  specialist: number;
}

interface PlanCount {
  start: number;
  pro: number;
  specialist: number;
  free: number;
  wealth: number;
}

interface Metrics {
  upgrades: number;
  downgrades: number;
  cancellations: number;
  churnRate: number;
  mrr: number;
}

const COLORS = {
  start: "#3b82f6",      // Azul
  pro: "#10b981",        // Verde
  specialist: "#f59e0b", // Laranja
  free: "#94a3b8",       // Cinza
  wealth: "#e11d48",     // Rosa/vermelho
};

const AdminReports = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activeCustomers, setActiveCustomers] = useState(0);
  const [planCounts, setPlanCounts] = useState<PlanCount>({ start: 0, pro: 0, specialist: 0, free: 0, wealth: 0 });
  const [metrics, setMetrics] = useState<Metrics>({ upgrades: 0, downgrades: 0, cancellations: 0, churnRate: 0, mrr: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Don't render while checking permissions
  if (adminLoading || !isAdmin) {
    return null;
  }

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke("stripe-reports");

      if (error) throw error;

      if (data) {
        // Format monthly data for display
        const formattedData = data.monthlyData.map((item: any) => ({
          month: new Date(item.month + "-01").toLocaleDateString("pt-BR", { 
            month: "short", 
            year: "numeric" 
          }),
          revenue: item.revenue,
          customers: item.customers,
          start: item.start,
          pro: item.pro,
          specialist: item.specialist,
        }));

        setMonthlyData(formattedData);
        setTotalRevenue(data.currentMonth.revenue);
        setActiveCustomers(data.currentMonth.customers);
        setPlanCounts(data.planCounts);
        setMetrics(data.metrics || { upgrades: 0, downgrades: 0, cancellations: 0, churnRate: 0, mrr: 0 });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar relatórios",
        description: error.message || "Não foi possível carregar os dados do Stripe",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    try {
      setExporting(true);
      
      // Prepare CSV content
      const headers = ["Mês", "Receita (R$)", "Clientes", "START", "PRO", "SPECIALIST"];
      const rows = monthlyData.map(row => [
        row.month,
        row.revenue.toFixed(2),
        row.customers,
        row.start,
        row.pro,
        row.specialist,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(",")),
        "",
        "Resumo",
        `Total Faturamento Mês Atual,${totalRevenue.toFixed(2)}`,
        `Total Clientes Ativos,${activeCustomers}`,
        `Clientes PRO,${planCounts.pro}`,
        `Clientes SPECIALIST,${planCounts.specialist}`,
        `Clientes WEALTH,${planCounts.wealth}`,
        `Clientes Gratuitos (START),${planCounts.free}`,
        "",
        "Métricas Consolidadas (Últimos 30 Dias)",
        `MRR,${metrics.mrr.toFixed(2)}`,
        `Upgrades,${metrics.upgrades}`,
        `Downgrades,${metrics.downgrades}`,
        `Cancelamentos,${metrics.cancellations}`,
        `Taxa de Churn,${metrics.churnRate.toFixed(2)}%`,
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Exportado com sucesso",
        description: "Relatório exportado em formato CSV",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    try {
      setExporting(true);
      
      // Create a printable HTML content
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório Financeiro</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
            .metric { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .metric-title { font-size: 12px; color: #666; margin-bottom: 5px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Relatório Financeiro</h1>
          <p>Data de geração: ${new Date().toLocaleDateString("pt-BR")}</p>
          
          <div class="metrics">
            <div class="metric">
              <div class="metric-title">Faturamento do Mês</div>
              <div class="metric-value">${formatCurrency(totalRevenue)}</div>
            </div>
            <div class="metric">
              <div class="metric-title">Clientes Ativos</div>
              <div class="metric-value">${activeCustomers}</div>
            </div>
            <div class="metric">
              <div class="metric-title">Ticket Médio</div>
              <div class="metric-value">${formatCurrency(activeCustomers > 0 ? totalRevenue / activeCustomers : 0)}</div>
            </div>
          </div>

          <h2>Métricas Consolidadas (Últimos 30 Dias)</h2>
          <div class="metrics" style="grid-template-columns: repeat(2, 1fr);">
            <div class="metric">
              <div class="metric-title">MRR</div>
              <div class="metric-value" style="color: #22c55e;">${formatCurrency(metrics.mrr)}</div>
            </div>
            <div class="metric">
              <div class="metric-title">Upgrades</div>
              <div class="metric-value" style="color: #22c55e;">${metrics.upgrades}</div>
            </div>
            <div class="metric">
              <div class="metric-title">Downgrades</div>
              <div class="metric-value" style="color: #f59e0b;">${metrics.downgrades}</div>
            </div>
            <div class="metric">
              <div class="metric-title">Cancelamentos</div>
              <div class="metric-value" style="color: #ef4444;">${metrics.cancellations}</div>
            </div>
            <div class="metric">
              <div class="metric-title">Taxa de Churn</div>
              <div class="metric-value" style="color: #ef4444;">${metrics.churnRate.toFixed(2)}%</div>
            </div>
          </div>

          <h2>Distribuição por Plano</h2>
          <table>
            <tr>
              <th>Plano</th>
              <th>Clientes</th>
            </tr>
            <tr>
              <td>START (grátis)</td>
              <td>${planCounts.free}</td>
            </tr>
            <tr>
              <td>PRO</td>
              <td>${planCounts.pro}</td>
            </tr>
            <tr>
              <td>SPECIALIST</td>
              <td>${planCounts.specialist}</td>
            </tr>
            <tr>
              <td>WEALTH</td>
              <td>${planCounts.wealth}</td>
            </tr>
          </table>

          <h2>Faturamento Mensal</h2>
          <table>
            <tr>
              <th>Mês</th>
              <th>Receita</th>
              <th>Clientes</th>
              <th>START</th>
              <th>PRO</th>
              <th>SPECIALIST</th>
            </tr>
            ${monthlyData.map(row => `
              <tr>
                <td>${row.month}</td>
                <td>${formatCurrency(row.revenue)}</td>
                <td>${row.customers}</td>
                <td>${row.start}</td>
                <td>${row.pro}</td>
                <td>${row.specialist}</td>
              </tr>
            `).join("")}
          </table>

          <div class="footer">
            <p>Relatório gerado automaticamente pela plataforma</p>
          </div>
        </body>
        </html>
      `;

      // Open print dialog
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }

      toast({
        title: "Gerando PDF",
        description: "Abrindo diálogo de impressão",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <AppLayout title="Relatórios Financeiros">
      <div className="container py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-8 w-8 text-primary" />
                <h1 className="text-3xl md:text-4xl font-bold">Relatórios Financeiros</h1>
              </div>
              <p className="text-muted-foreground">Dados em tempo real do Stripe</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={exportToCSV}
                disabled={loading || exporting || monthlyData.length === 0}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
              <Button
                onClick={exportToPDF}
                disabled={loading || exporting || monthlyData.length === 0}
                variant="outline"
              >
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button onClick={loadReports} disabled={loading}>
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* Cards de métricas principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Faturamento do Mês</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receita acumulada no mês atual
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeCustomers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clientes com planos ativos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(activeCustomers > 0 ? totalRevenue / activeCustomers : 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Média por cliente ativo
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Métricas Consolidadas */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Métricas Consolidadas (Últimos 30 Dias)</CardTitle>
                <CardDescription>
                  Movimentações de planos e receita recorrente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">MRR</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(metrics.mrr)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Receita recorrente mensal
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Upgrades</div>
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.upgrades}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Melhorias de plano
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Downgrades</div>
                    <div className="text-2xl font-bold text-amber-600">
                      {metrics.downgrades}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Reduções de plano
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Cancelamentos</div>
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.cancellations}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Planos cancelados
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Taxa de Churn</div>
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.churnRate.toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Percentual de perda
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Distribuição de Clientes por Plano */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Distribuição de Clientes por Plano</CardTitle>
                <CardDescription>
                  Total de clientes ativos em cada plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex justify-center items-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "START (grátis)", value: planCounts.free, color: COLORS.free },
                            { name: "PRO", value: planCounts.pro, color: COLORS.pro },
                            { name: "SPECIALIST", value: planCounts.specialist, color: COLORS.specialist },
                            { name: "WEALTH", value: planCounts.wealth, color: COLORS.wealth },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[planCounts.free, planCounts.pro, planCounts.specialist, planCounts.wealth].map((_, index) => (
                            <Cell key={`cell-${index}`} fill={[COLORS.free, COLORS.pro, COLORS.specialist, COLORS.wealth][index]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Clientes</TableHead>
                          <TableHead className="text-right">Percentual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { name: "START (grátis)", count: planCounts.free, color: COLORS.free },
                          { name: "PRO", count: planCounts.pro, color: COLORS.pro },
                          { name: "SPECIALIST", count: planCounts.specialist, color: COLORS.specialist },
                          { name: "WEALTH", count: planCounts.wealth, color: COLORS.wealth },
                        ].map((plan) => {
                          const total = planCounts.free + planCounts.pro + planCounts.specialist + planCounts.wealth;
                          const percentage = total > 0 ? (plan.count / total) * 100 : 0;
                          return (
                            <TableRow key={plan.name}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: plan.color }}
                                  />
                                  {plan.name}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{plan.count}</TableCell>
                              <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de faturamento mensal */}
            <Card>
              <CardHeader>
                <CardTitle>Faturamento Mensal</CardTitle>
                <CardDescription>
                  Evolução da receita e clientes ao longo dos meses (dados do Stripe)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum dado disponível ainda
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "revenue") return [formatCurrency(value), "Receita"];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" fill={COLORS.start} name="Receita (R$)" />
                      <Bar dataKey="customers" fill={COLORS.pro} name="Total Clientes" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminReports;
