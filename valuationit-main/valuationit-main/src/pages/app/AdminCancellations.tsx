import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquareOff, TrendingDown, Calendar, User, BarChart3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface CancellationFeedback {
  id: string;
  user_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  profile?: {
    name: string | null;
    email: string | null;
  };
}

interface ReasonCount {
  name: string;
  value: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(210, 70%, 50%)",
  "hsl(45, 90%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 80%, 50%)",
];

const AdminCancellations = () => {
  const [feedbacks, setFeedbacks] = useState<CancellationFeedback[]>([]);
  const [reasonCounts, setReasonCounts] = useState<ReasonCount[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      
      // Fetch feedbacks
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("cancellation_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (feedbackError) throw feedbackError;

      // Fetch profiles for the user_ids
      const userIds = [...new Set((feedbackData || []).map(f => f.user_id))];
      
      let profilesMap: Record<string, { name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);
        
        (profilesData || []).forEach(p => {
          profilesMap[p.id] = { name: p.name, email: p.email };
        });
      }

      // Combine feedbacks with profiles
      const feedbacksWithProfiles = (feedbackData || []).map(item => ({
        ...item,
        profile: profilesMap[item.user_id] || { name: null, email: null }
      }));

      setFeedbacks(feedbacksWithProfiles);

      // Calculate reason counts for chart
      const counts: Record<string, number> = {};
      feedbacksWithProfiles.forEach((f) => {
        counts[f.reason] = (counts[f.reason] || 0) + 1;
      });
      
      const chartData = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      
      setReasonCounts(chartData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar feedbacks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMostCommonReason = () => {
    if (reasonCounts.length === 0) return "N/A";
    return reasonCounts[0].name;
  };

  return (
    <AppLayout title="Feedbacks de Cancelamento">
      <div className="space-y-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquareOff className="h-8 w-8 text-destructive" />
            <h1 className="text-3xl md:text-4xl font-bold">Feedbacks de Cancelamento</h1>
          </div>
          <p className="text-muted-foreground">
            Analise os motivos de cancelamento para melhorar a retenção
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-destructive/10">
                      <TrendingDown className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Cancelamentos</p>
                      <p className="text-2xl font-bold">{feedbacks.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Motivo Principal</p>
                      <p className="text-lg font-bold truncate max-w-[180px]" title={getMostCommonReason()}>
                        {getMostCommonReason()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-amber-500/10">
                      <Calendar className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
                      <p className="text-2xl font-bold">
                        {feedbacks.filter(f => {
                          const date = new Date(f.created_at);
                          const thirtyDaysAgo = new Date();
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                          return date >= thirtyDaysAgo;
                        }).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart and Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Motivos</CardTitle>
                  <CardDescription>
                    Análise visual dos principais motivos de cancelamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reasonCounts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reasonCounts}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => 
                              `${name.substring(0, 15)}${name.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`
                            }
                          >
                            {reasonCounts.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => [`${value} cancelamento(s)`, 'Quantidade']}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ranking */}
              <Card>
                <CardHeader>
                  <CardTitle>Ranking de Motivos</CardTitle>
                  <CardDescription>
                    Motivos ordenados por frequência
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reasonCounts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reasonCounts.map((reason, index) => (
                        <div key={reason.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant={index === 0 ? "destructive" : "secondary"}
                              className="w-8 h-8 rounded-full flex items-center justify-center p-0"
                            >
                              {index + 1}
                            </Badge>
                            <span className="font-medium text-sm">{reason.name}</span>
                          </div>
                          <Badge variant="outline">{reason.value}x</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Feedbacks Table */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico Completo</CardTitle>
                <CardDescription>
                  Todos os feedbacks de cancelamento recebidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {feedbacks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquareOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum feedback de cancelamento encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Detalhes</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedbacks.map((feedback) => (
                          <TableRow key={feedback.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">
                                    {feedback.profile?.name || "Usuário"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {feedback.profile?.email || feedback.user_id.substring(0, 8) + "..."}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{feedback.reason}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {feedback.details ? (
                                <span className="text-sm text-muted-foreground line-clamp-2">
                                  {feedback.details}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">
                                  Sem detalhes
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {formatDate(feedback.created_at)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminCancellations;
