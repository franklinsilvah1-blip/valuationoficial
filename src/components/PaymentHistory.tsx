import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Download, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

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

const PaymentHistory = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentHistory();
  }, []);

  const loadPaymentHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-history");

      if (error) throw error;

      setPayments(data.payments || []);
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      console.error("Error loading payment history:", error);
      toast.error("Erro ao carregar histórico de pagamentos");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      succeeded: { label: "Pago", variant: "default" },
      paid: { label: "Pago", variant: "default" },
      processing: { label: "Processando", variant: "secondary" },
      pending: { label: "Pendente", variant: "secondary" },
      failed: { label: "Falhou", variant: "destructive" },
      canceled: { label: "Cancelado", variant: "outline" },
      refunded: { label: "Reembolsado", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSubscriptionStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      active: { label: "Ativa", variant: "default" },
      trialing: { label: "Teste", variant: "secondary" },
      past_due: { label: "Vencida", variant: "destructive" },
      canceled: { label: "Cancelada", variant: "outline" },
      unpaid: { label: "Não paga", variant: "destructive" },
      incomplete: { label: "Incompleta", variant: "secondary" },
    };

    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency === "BRL" ? "BRL" : "USD",
    }).format(amount);
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      card: "Cartão",
      boleto: "Boleto",
      pix: "PIX",
      unknown: "Outro",
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0 && subscriptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum pagamento encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Subscriptions */}
      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assinaturas Ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">Plano {subscription.plan}</h3>
                    {getSubscriptionStatusBadge(subscription.status)}
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(subscription.amount, "BRL")}/
                    {subscription.interval === "month" ? "mês" : "ano"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Período atual</p>
                    <p className="font-medium">
                      {subscription.current_period_start && 
                        format(new Date(subscription.current_period_start), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}{" "}
                      -{" "}
                      {subscription.current_period_end && 
                        format(new Date(subscription.current_period_end), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                    </p>
                  </div>

                  {subscription.cancel_at && (
                    <div>
                      <p className="text-muted-foreground">Cancelamento agendado</p>
                      <p className="font-medium text-destructive">
                        {format(new Date(subscription.cancel_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{payment.description}</h3>
                      {getStatusBadge(payment.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Data:</span>{" "}
                        {payment.created && format(new Date(payment.created), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </div>
                      <div>
                        <span className="font-medium">Método:</span>{" "}
                        {getPaymentMethodLabel(payment.payment_method)}
                      </div>

                      {payment.period_start && payment.period_end && (
                        <div className="col-span-2">
                          <span className="font-medium">Período:</span>{" "}
                          {format(new Date(payment.period_start), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}{" "}
                          -{" "}
                          {format(new Date(payment.period_end), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right space-y-2">
                    <p className="text-lg font-bold">
                      {formatCurrency(payment.amount, payment.currency)}
                    </p>
                    {payment.invoice_pdf && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(payment.invoice_pdf, "_blank")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Recibo
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentHistory;
