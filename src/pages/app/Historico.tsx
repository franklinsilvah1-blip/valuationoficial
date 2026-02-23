import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Download, CreditCard, Calendar, CheckCircle2, XCircle, Clock, Settings, ExternalLink, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CancellationSurveyDialog } from "@/components/CancellationSurveyDialog";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  description: string;
  payment_method: string;
  invoice_pdf?: string;
  period_start?: string | null;
  period_end?: string | null;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at: string | null;
  canceled_at: string | null;
  amount: number;
  interval: string;
}

const Historico = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [showCancellationSurvey, setShowCancellationSurvey] = useState(false);
  const { toast } = useToast();

  const openCustomerPortal = async () => {
    try {
      setLoadingPortal(true);
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao abrir portal",
        description: error.message || "Não foi possível abrir o portal de gerenciamento",
        variant: "destructive",
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleCancellationConfirm = async (reason: string, details?: string) => {
    try {
      setLoadingPortal(true);
      
      // Save feedback to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("cancellation_feedback").insert({
          user_id: user.id,
          reason,
          details,
        });
      }

      // Close dialog and open portal
      setShowCancellationSurvey(false);
      
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível continuar",
        variant: "destructive",
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  useEffect(() => {
    loadPaymentHistory();
  }, []);

  const loadPaymentHistory = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke("payment-history");

      if (error) throw error;

      if (data) {
        setPayments(data.payments || []);
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar histórico",
        description: error.message || "Não foi possível carregar o histórico de pagamentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: string = "BRL") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
      succeeded: { label: "Pago", variant: "default" },
      paid: { label: "Pago", variant: "default" },
      processing: { label: "Processando", variant: "secondary" },
      requires_payment_method: { label: "Aguardando", variant: "outline" },
      requires_confirmation: { label: "Aguardando", variant: "outline" },
      requires_action: { label: "Ação Necessária", variant: "destructive" },
      canceled: { label: "Cancelado", variant: "destructive" },
      failed: { label: "Falhou", variant: "destructive" },
      active: { label: "Ativo", variant: "default" },
      past_due: { label: "Vencido", variant: "destructive" },
      unpaid: { label: "Não Pago", variant: "destructive" },
      incomplete: { label: "Incompleto", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    if (["succeeded", "paid", "active"].includes(status)) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (["canceled", "failed", "past_due", "unpaid"].includes(status)) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      card: "Cartão",
      boleto: "Boleto",
      pix: "PIX",
      unknown: "Não especificado",
    };
    return methods[method] || method;
  };

  return (
    <AppLayout title="Histórico">
      <div className="space-y-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Receipt className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Histórico de Pagamentos</h1>
          </div>
          <p className="text-muted-foreground">Visualize todas as suas transações e assinaturas</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="payments">Pagamentos ({payments.length})</TabsTrigger>
              <TabsTrigger value="subscriptions">Assinaturas ({subscriptions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Pagamentos</CardTitle>
                  <CardDescription>
                    Todos os pagamentos realizados na plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum pagamento encontrado</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(payment.status)}
                                  {getStatusBadge(payment.status)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {formatDate(payment.created)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{payment.description}</div>
                                  {payment.period_start && payment.period_end && (
                                    <div className="text-xs text-muted-foreground">
                                      Período: {new Date(payment.period_start).toLocaleDateString("pt-BR")} até{" "}
                                      {new Date(payment.period_end).toLocaleDateString("pt-BR")}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                                  {getPaymentMethodLabel(payment.payment_method)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(payment.amount, payment.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {payment.invoice_pdf && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(payment.invoice_pdf, "_blank")}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-6 space-y-6">
              {/* Card de Gerenciamento */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Settings className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-1">Gerenciar Assinatura</h3>
                        <p className="text-sm text-muted-foreground">
                          Altere seu plano, atualize a forma de pagamento ou cancele sua assinatura
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button 
                        onClick={openCustomerPortal} 
                        disabled={loadingPortal}
                      >
                        {loadingPortal ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        )}
                        Gerenciar no Portal
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setShowCancellationSurvey(true)} 
                        disabled={loadingPortal}
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      >
                        Cancelar Plano
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assinaturas Ativas</CardTitle>
                  <CardDescription>
                    Visualize suas assinaturas e renovações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {subscriptions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma assinatura encontrada</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {subscriptions.map((sub) => (
                        <Card key={sub.id} className="shadow-card">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-bold">Plano {sub.plan}</h3>
                                  {getStatusBadge(sub.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(sub.amount)} / {sub.interval === "month" ? "mês" : "trimestre"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold">{formatCurrency(sub.amount)}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                              <div>
                                <p className="text-muted-foreground">Início do período</p>
                                <p className="font-medium">{formatDate(sub.current_period_start)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Fim do período</p>
                                <p className="font-medium">{formatDate(sub.current_period_end)}</p>
                              </div>
                              {sub.canceled_at && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground">Cancelada em</p>
                                  <p className="font-medium text-destructive">{formatDate(sub.canceled_at)}</p>
                                </div>
                              )}
                              {sub.cancel_at && !sub.canceled_at && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground">Será cancelada em</p>
                                  <p className="font-medium">{formatDate(sub.cancel_at)}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={openCustomerPortal}
                                disabled={loadingPortal}
                              >
                                {loadingPortal ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Settings className="h-4 w-4 mr-2" />
                                )}
                                Gerenciar Assinatura
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <CancellationSurveyDialog
        open={showCancellationSurvey}
        onOpenChange={setShowCancellationSurvey}
        onConfirm={handleCancellationConfirm}
        loading={loadingPortal}
      />
    </AppLayout>
  );
};

export default Historico;
