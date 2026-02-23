import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { toast } from "sonner";
import { DollarSign, Clock, CheckCircle, ChevronLeft, ChevronRight, Banknote } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface Commission {
  id: string;
  affiliate_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_payment_id: string | null;
  affiliate?: {
    affiliate_code: string;
    profile?: {
      name: string | null;
      email: string | null;
    };
  };
}

export default function AdminAffiliatesCommissions() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const queryClient = useQueryClient();
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<string>("all");
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const itemsPerPage = 10;

  const { data: commissions = [], isLoading: isLoadingCommissions } = useQuery({
    queryKey: ["admin-commissions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (commissionsError) throw commissionsError;

      const affiliateIds = [...new Set(commissionsData?.map(c => c.affiliate_id) || [])];
      const { data: affiliatesData } = await supabase
        .from("affiliates")
        .select("id, affiliate_code, user_id")
        .in("id", affiliateIds);

      const userIds = affiliatesData?.map(a => a.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      return (commissionsData || []).map(commission => {
        const affiliate = affiliatesData?.find(a => a.id === commission.affiliate_id);
        const profile = affiliate ? profiles?.find(p => p.id === affiliate.user_id) : null;
        return {
          ...commission,
          affiliate: affiliate ? {
            affiliate_code: affiliate.affiliate_code,
            profile: profile || null,
          } : null,
        };
      }) as Commission[];
    },
  });

  const filteredCommissions = useMemo(() => {
    if (commissionStatusFilter === "all") return commissions;
    return commissions.filter(c => c.status === commissionStatusFilter);
  }, [commissions, commissionStatusFilter]);

  const paginatedCommissions = useMemo(() => {
    const start = (commissionsPage - 1) * itemsPerPage;
    return filteredCommissions.slice(start, start + itemsPerPage);
  }, [filteredCommissions, commissionsPage]);

  const totalCommissionsPages = Math.ceil(filteredCommissions.length / itemsPerPage);

  useMemo(() => {
    setCommissionsPage(1);
  }, [commissionStatusFilter]);

  const totalPendingCommissions = commissions
    .filter(c => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const totalPaidCommissions = commissions
    .filter(c => c.status === "paid")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const markCommissionPaid = useMutation({
    mutationFn: async ({ commissionId, affiliateId }: { commissionId: string; affiliateId: string }) => {
      const { error } = await supabase
        .from("commissions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", commissionId);

      if (error) throw error;

      const { data: affiliate } = await supabase
        .from("affiliates")
        .select("total_earnings, last_revenue_at")
        .eq("id", affiliateId)
        .single();

      if (affiliate) {
        const commission = commissions.find(c => c.id === commissionId);
        const newTotal = (affiliate.total_earnings || 0) + (commission?.amount || 0);
        await supabase
          .from("affiliates")
          .update({ 
            total_earnings: newTotal,
            last_revenue_at: new Date().toISOString()
          })
          .eq("id", affiliateId);
      }

      return { affiliateId };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      toast.success("Comissão marcada como paga!");
      setPaymentDialogOpen(false);
      setSelectedCommission(null);

      try {
        await supabase.functions.invoke("send-affiliate-email", {
          body: { affiliateId: data.affiliateId, emailType: "payment" },
        });
        toast.success("E-mail de confirmação de pagamento enviado!");
      } catch (emailError) {
        console.warn("Failed to send payment email:", emailError);
      }
    },
    onError: (error: any) => {
      console.error("Error marking commission as paid:", error);
      toast.error("Erro ao marcar comissão como paga");
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getCommissionStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case "approved":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Aprovada</Badge>;
      case "paid":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Paga</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Comissões de Afiliados">
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
              <BreadcrumbLink asChild>
                <Link to="/app/admin/affiliates">Afiliados</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Comissões</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <Clock className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{formatCurrency(totalPendingCommissions)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {commissions.filter(c => c.status === "pending").length} aguardando pagamento
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{formatCurrency(totalPaidCommissions)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {commissions.filter(c => c.status === "paid").length} comissões pagas
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Comissões</CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{commissions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">registradas no sistema</p>
            </CardContent>
          </Card>
        </div>

        {/* Commissions Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Comissões ({filteredCommissions.length})</CardTitle>
                <CardDescription>
                  Gerencie pagamentos de comissões
                </CardDescription>
              </div>
              <Select value={commissionStatusFilter} onValueChange={setCommissionStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovadas</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingCommissions ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredCommissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma comissão encontrada</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Afiliado</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCommissions.map((commission) => (
                        <TableRow key={commission.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{commission.affiliate?.profile?.name || "N/A"}</p>
                              <p className="text-sm text-muted-foreground">{commission.affiliate?.affiliate_code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-green-600">
                            {formatCurrency(commission.amount)}
                          </TableCell>
                          <TableCell>{getCommissionStatusBadge(commission.status)}</TableCell>
                          <TableCell>
                            {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {commission.paid_at
                              ? format(new Date(commission.paid_at), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {commission.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedCommission(commission);
                                  setPaymentDialogOpen(true);
                                }}
                              >
                                <Banknote className="h-4 w-4 mr-1" />
                                Marcar Paga
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalCommissionsPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {commissionsPage} de {totalCommissionsPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCommissionsPage(p => Math.max(1, p - 1))}
                        disabled={commissionsPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCommissionsPage(p => Math.min(totalCommissionsPages, p + 1))}
                        disabled={commissionsPage === totalCommissionsPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Confirmation Dialog */}
        <AlertDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja marcar esta comissão como paga?
                <br />
                <br />
                <strong>Valor:</strong> {selectedCommission && formatCurrency(selectedCommission.amount)}
                <br />
                <strong>Afiliado:</strong> {selectedCommission?.affiliate?.profile?.name}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedCommission) {
                    markCommissionPaid.mutate({
                      commissionId: selectedCommission.id,
                      affiliateId: selectedCommission.affiliate_id,
                    });
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirmar Pagamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
