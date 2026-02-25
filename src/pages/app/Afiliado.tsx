import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Users, Clock, CheckCircle, Gift, Link2, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

export default function Afiliado() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCopied, setIsCopied] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Fetch affiliate data
  const { data: affiliate, isLoading: isLoadingAffiliate } = useQuery({
    queryKey: ["affiliate", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching affiliate:", error);
        throw error;
      }
      return data;
    },
  });

  // Fetch commissions
  const { data: commissions = [], isLoading: isLoadingCommissions } = useQuery({
    queryKey: ["commissions", affiliate?.id],
    enabled: !!affiliate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select(`
          *,
          referrals (
            referred_user_id,
            created_at
          )
        `)
        .eq("affiliate_id", affiliate!.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching commissions:", error);
        throw error;
      }
      return data || [];
    },
  });

  // Fetch referrals count
  const { data: referralsCount = 0 } = useQuery({
    queryKey: ["referrals-count", affiliate?.id],
    enabled: !!affiliate?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("affiliate_id", affiliate!.id);

      if (error) {
        console.error("Error fetching referrals count:", error);
        return 0;
      }
      return count || 0;
    },
  });

  // Calculate commissions by status
  const pendingCommissions = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0);
  
  const paidCommissions = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  // Request affiliate activation (creates with 'pending' status for manual approval)
  const activateAffiliate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("request_affiliate_activation");

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Fetch the newly created affiliate to get the code
      const { data: newAffiliate } = await supabase
        .from("affiliates")
        .select("affiliate_code")
        .eq("user_id", user!.id)
        .single();

      // Fetch user profile for the notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", user!.id)
        .single();

      queryClient.invalidateQueries({ queryKey: ["affiliate", user?.id] });
      toast.success("Solicitação enviada! Aguarde a aprovação do administrador.");

      // Send notification to admin (non-blocking)
      try {
        await supabase.functions.invoke("send-admin-notification", {
          body: {
            type: "affiliate_request",
            userName: profile?.name || profile?.email || "Usuário",
            userEmail: profile?.email || user?.email || "",
            affiliateCode: newAffiliate?.affiliate_code || "N/A",
            timestamp: new Date().toISOString(),
          },
        });
      } catch (emailError) {
        console.warn("Failed to send admin notification:", emailError);
      }
    },
    onError: (error: any) => {
      console.error("Error requesting affiliate activation:", error);
      toast.error("Erro ao solicitar ativação. Tente novamente.");
    },
  });

  const handleCopyLink = () => {
    const link = `${window.location.origin}/auth?ref=${affiliate?.affiliate_code}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    toast.success("Link copiado para a área de transferência!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Aprovada</Badge>;
      case "paid":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Paga</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoadingAffiliate) {
    return (
      <AppLayout title="Programa de Afiliados">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </AppLayout>
    );
  }

  // User is not an affiliate yet
  if (!affiliate) {
    return (
      <AppLayout title="Programa de Afiliados">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-lg w-full border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Gift className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Torne-se um Afiliado</CardTitle>
              <CardDescription className="text-base">
                Ganhe comissões indicando novos usuários para a plataforma. Compartilhe seu link exclusivo e receba uma porcentagem de cada assinatura realizada.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <ul className="text-sm text-muted-foreground space-y-2 w-full">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Receba 10% de comissão por indicação
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Link de indicação exclusivo
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Acompanhe suas indicações em tempo real
                </li>
              </ul>
              
              {/* Terms Checkbox */}
              <div className="flex items-start space-x-3 w-full pt-4 border-t">
                <Checkbox 
                  id="terms" 
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label 
                    htmlFor="terms" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    Li e concordo com os{" "}
                    <Link 
                      to="/termos-afiliado" 
                      target="_blank"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Termos do Programa de Afiliados
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ao ativar, você concorda com as regras de comissões, proibições e condições do programa.
                  </p>
                </div>
              </div>

              <Button 
                size="lg" 
                className="mt-4 w-full"
                onClick={() => activateAffiliate.mutate()}
                disabled={activateAffiliate.isPending || !acceptedTerms}
              >
                {activateAffiliate.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando solicitação...
                  </>
                ) : (
                  "Solicitar ativação de Afiliado"
                )}
              </Button>
              
              {!acceptedTerms && (
                <p className="text-xs text-muted-foreground text-center">
                  Você precisa aceitar os termos para continuar
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Affiliate is pending approval
  if (affiliate.status === "pending") {
    return (
      <AppLayout title="Programa de Afiliados">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-lg w-full border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl">Solicitação em Análise</CardTitle>
              <CardDescription className="text-base">
                Sua solicitação para se tornar afiliado foi recebida e está aguardando aprovação da nossa equipe.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-background border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Seu código de afiliado reservado:</p>
                <code className="text-lg font-mono font-bold text-primary">{affiliate.affiliate_code}</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Você receberá um e-mail assim que sua conta for aprovada. Normalmente o processo leva até 24 horas úteis.
              </p>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                <Clock className="w-3 h-3 mr-1" />
                Aguardando Aprovação
              </Badge>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Affiliate is suspended or inactive
  if (affiliate.status === "rejected" || affiliate.status === "inactive") {
    return (
      <AppLayout title="Programa de Afiliados">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-lg w-full border-red-500/30 bg-red-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Conta {affiliate.status === "rejected" ? "Rejeitada" : "Inativa"}</CardTitle>
              <CardDescription className="text-base">
                {affiliate.status === "rejected" 
                  ? "Sua conta de afiliado foi rejeitada. Entre em contato com o suporte para mais informações."
                  : "Sua conta de afiliado foi desativada por inatividade. Entre em contato para reativação."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                {affiliate.status === "rejected" ? "Rejeitada" : "Inativa"}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // User is an active affiliate - show dashboard
  return (
    <AppLayout title="Programa de Afiliados">
      <div className="space-y-6">
        {/* Referral Link Card */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Seu Link de Indicação</CardTitle>
                <CardDescription>Compartilhe este link para ganhar comissões</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <code className="flex-1 bg-background border rounded-lg px-4 py-3 text-sm font-mono break-all">
                {window.location.origin}/auth?ref={affiliate.affiliate_code}
              </code>
              <Button 
                onClick={handleCopyLink}
                className="shrink-0"
                variant={isCopied ? "secondary" : "default"}
              >
                {isCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Link
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Código do afiliado: <span className="font-mono font-semibold">{affiliate.affiliate_code}</span>
            </p>
          </CardContent>
        </Card>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{referralsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                usuários indicados
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <Clock className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {formatCurrency(pendingCommissions)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                aguardando pagamento
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pagas</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(paidCommissions)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                total recebido
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Commissions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Comissões</CardTitle>
            <CardDescription>
              Acompanhe todas as suas comissões geradas por indicações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCommissions ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : commissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma comissão registrada ainda.</p>
                <p className="text-sm">Compartilhe seu link de indicação para começar a ganhar!</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(Number(commission.amount))}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(commission.status)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {commission.paid_at 
                            ? format(new Date(commission.paid_at), "dd/MM/yyyy", { locale: ptBR })
                            : "-"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
