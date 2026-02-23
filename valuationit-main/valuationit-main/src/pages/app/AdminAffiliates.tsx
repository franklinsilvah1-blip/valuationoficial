import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { 
  Users, 
  Search, 
  UserCheck, 
  UserX,
  Mail,
  AlertTriangle,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  CheckCheck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AffiliateDetailDialog } from "@/components/AffiliateDetailDialog";
import { Link, useSearchParams } from "react-router-dom";

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
  last_inactivity_notification: string | null;
  profile?: {
    name: string | null;
    email: string | null;
  };
}

export default function AdminAffiliates() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [commissionRateDialogOpen, setCommissionRateDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [newCommissionRate, setNewCommissionRate] = useState<string>("");
  const [detailAffiliate, setDetailAffiliate] = useState<Affiliate | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAffiliateIds, setSelectedAffiliateIds] = useState<Set<string>>(new Set());
  const [batchApproveDialogOpen, setBatchApproveDialogOpen] = useState(false);
  const [batchApproving, setBatchApproving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Pagination state
  const [affiliatesPage, setAffiliatesPage] = useState(1);
  const itemsPerPage = 10;

  // Handle batch parameter from URL
  useEffect(() => {
    if (searchParams.get("batch") === "true" && statusFilter === "pending") {
      // Auto-open batch approve dialog
      const timer = setTimeout(() => {
        setBatchApproveDialogOpen(true);
        // Remove batch param from URL
        searchParams.delete("batch");
        setSearchParams(searchParams);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, statusFilter]);

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

      // Fetch profiles for all affiliates
      const userIds = affiliatesData?.map(a => a.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      // Merge profile data
      return (affiliatesData || []).map(affiliate => ({
        ...affiliate,
        profile: profiles?.find(p => p.id === affiliate.user_id) || null,
      })) as Affiliate[];
    },
  });

  // Helper function to calculate days since last activity
  const getDaysSinceLastActivity = (affiliate: Affiliate): number => {
    const referenceDate = affiliate.last_revenue_at 
      ? new Date(affiliate.last_revenue_at) 
      : new Date(affiliate.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - referenceDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Check if affiliate is at risk (45+ days without revenue)
  const isAtRisk = (affiliate: Affiliate): boolean => {
    if (affiliate.status !== "active") return false;
    return getDaysSinceLastActivity(affiliate) >= 45;
  };

  // Filter affiliates
  const filteredAffiliates = useMemo(() => {
    let result = [...affiliates];

    if (statusFilter === "at_risk") {
      result = result.filter(a => isAtRisk(a));
    } else if (statusFilter !== "all") {
      result = result.filter(a => a.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(a =>
        a.affiliate_code.toLowerCase().includes(query) ||
        a.profile?.name?.toLowerCase().includes(query) ||
        a.profile?.email?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [affiliates, statusFilter, searchQuery]);

  // Paginated affiliates
  const paginatedAffiliates = useMemo(() => {
    const start = (affiliatesPage - 1) * itemsPerPage;
    return filteredAffiliates.slice(start, start + itemsPerPage);
  }, [filteredAffiliates, affiliatesPage]);

  const totalAffiliatesPages = Math.ceil(filteredAffiliates.length / itemsPerPage);

  // Reset pagination when filters change
  useMemo(() => {
    setAffiliatesPage(1);
    setSelectedAffiliateIds(new Set());
  }, [statusFilter, searchQuery]);

  // Pending affiliates for batch approval
  const pendingAffiliatesList = useMemo(() => {
    return affiliates.filter(a => a.status === "pending");
  }, [affiliates]);

  // Get pending affiliates that are currently selected
  const selectedPendingAffiliates = useMemo(() => {
    return pendingAffiliatesList.filter(a => selectedAffiliateIds.has(a.id));
  }, [pendingAffiliatesList, selectedAffiliateIds]);

  // Toggle individual affiliate selection
  const toggleAffiliateSelection = (affiliateId: string) => {
    setSelectedAffiliateIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(affiliateId)) {
        newSet.delete(affiliateId);
      } else {
        newSet.add(affiliateId);
      }
      return newSet;
    });
  };

  // Toggle select all pending affiliates
  const toggleSelectAllPending = () => {
    if (selectedPendingAffiliates.length === pendingAffiliatesList.length) {
      setSelectedAffiliateIds(prev => {
        const newSet = new Set(prev);
        pendingAffiliatesList.forEach(a => newSet.delete(a.id));
        return newSet;
      });
    } else {
      setSelectedAffiliateIds(prev => {
        const newSet = new Set(prev);
        pendingAffiliatesList.forEach(a => newSet.add(a.id));
        return newSet;
      });
    }
  };

  // Batch approve affiliates
  const handleBatchApprove = async () => {
    if (selectedPendingAffiliates.length === 0) return;

    setBatchApproving(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const affiliate of selectedPendingAffiliates) {
        try {
          const { error } = await supabase
            .from("affiliates")
            .update({ status: "active" })
            .eq("id", affiliate.id);

          if (error) throw error;

          try {
            await supabase.functions.invoke("send-affiliate-email", {
              body: { affiliateId: affiliate.id, emailType: "approved" },
            });
          } catch (emailError) {
            console.warn(`Failed to send approval email for ${affiliate.id}:`, emailError);
          }

          successCount++;
        } catch (err) {
          console.error(`Failed to approve affiliate ${affiliate.id}:`, err);
          failCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });

      if (failCount === 0) {
        toast.success(`${successCount} afiliado${successCount > 1 ? 's' : ''} aprovado${successCount > 1 ? 's' : ''} com sucesso!`);
      } else {
        toast.warning(`${successCount} aprovado${successCount > 1 ? 's' : ''}, ${failCount} falha${failCount > 1 ? 's' : ''}`);
      }

      setSelectedAffiliateIds(new Set());
      setBatchApproveDialogOpen(false);
    } catch (error) {
      console.error("Error in batch approve:", error);
      toast.error("Erro ao aprovar afiliados em lote");
    } finally {
      setBatchApproving(false);
    }
  };

  // Update affiliate status mutation
  const updateAffiliateStatus = useMutation({
    mutationFn: async ({ affiliateId, status, rejectionReason }: { affiliateId: string; status: "active" | "inactive" | "pending" | "suspended"; rejectionReason?: string }) => {
      const updateData: { status: "active" | "inactive" | "pending" | "suspended"; rejection_reason?: string | null } = { status };
      
      if (status === "suspended" || status === "inactive") {
        updateData.rejection_reason = rejectionReason || null;
      } else {
        updateData.rejection_reason = null;
      }

      const { error } = await supabase
        .from("affiliates")
        .update(updateData)
        .eq("id", affiliateId);

      if (error) throw error;
      return { affiliateId, status, rejectionReason };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      toast.success("Status do afiliado atualizado!");
      setStatusDialogOpen(false);
      setSelectedAffiliate(null);
      setRejectionReason("");

      if (data.status === "active" && selectedAffiliate?.status === "pending") {
        try {
          await supabase.functions.invoke("send-affiliate-email", {
            body: { affiliateId: data.affiliateId, emailType: "approved" },
          });
          toast.success("E-mail de aprovação enviado!");
        } catch (emailError) {
          console.warn("Failed to send approval email:", emailError);
        }
      }

      if ((data.status === "suspended" || data.status === "inactive") && selectedAffiliate?.status === "pending") {
        try {
          await supabase.functions.invoke("send-affiliate-email", {
            body: { 
              affiliateId: data.affiliateId, 
              emailType: "rejected",
              rejectionReason: data.rejectionReason 
            },
          });
          toast.success("E-mail de rejeição enviado!");
        } catch (emailError) {
          console.warn("Failed to send rejection email:", emailError);
        }
      }
    },
    onError: (error: any) => {
      console.error("Error updating affiliate status:", error);
      toast.error("Erro ao atualizar status do afiliado");
    },
  });

  // Update commission rate mutation
  const updateCommissionRate = useMutation({
    mutationFn: async ({ affiliateId, commissionRate }: { affiliateId: string; commissionRate: number }) => {
      const { error } = await supabase
        .from("affiliates")
        .update({ commission_rate: commissionRate })
        .eq("id", affiliateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      toast.success("Taxa de comissão atualizada!");
      setCommissionRateDialogOpen(false);
      setEditingAffiliate(null);
      setNewCommissionRate("");
    },
    onError: (error: any) => {
      console.error("Error updating commission rate:", error);
      toast.error("Erro ao atualizar taxa de comissão");
    },
  });

  // Send welcome email mutation
  const sendWelcomeEmail = useMutation({
    mutationFn: async (affiliateId: string) => {
      const { data, error } = await supabase.functions.invoke("send-affiliate-email", {
        body: { affiliateId, emailType: "welcome" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("E-mail de boas-vindas enviado com sucesso!");
    },
    onError: (error: any) => {
      console.error("Error sending welcome email:", error);
      toast.error("Erro ao enviar e-mail de boas-vindas");
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Ativo</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case "suspended":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Suspenso</Badge>;
      case "inactive":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/30">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleStatusChange = (affiliate: Affiliate, status: string) => {
    setSelectedAffiliate(affiliate);
    setNewStatus(status);
    setStatusDialogOpen(true);
  };

  const handleEditCommissionRate = (affiliate: Affiliate) => {
    setEditingAffiliate(affiliate);
    setNewCommissionRate(affiliate.commission_rate.toString());
    setCommissionRateDialogOpen(true);
  };

  const handleSaveCommissionRate = () => {
    if (!editingAffiliate) return;
    const rate = parseFloat(newCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Taxa inválida. Informe um valor entre 0 e 100.");
      return;
    }
    updateCommissionRate.mutate({
      affiliateId: editingAffiliate.id,
      commissionRate: rate,
    });
  };

  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Gerenciar Afiliados">
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
                <Link to="/app/admin/affiliates/panel">Afiliados</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Listagem</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Afiliados ({filteredAffiliates.length})</CardTitle>
                <CardDescription>
                  Gerencie afiliados, aprove ou suspenda contas
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar afiliado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-[200px]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="at_risk">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                        Em Risco
                      </span>
                    </SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="suspended">Suspensos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAffiliates ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredAffiliates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum afiliado encontrado.</p>
              </div>
            ) : (
              <>
                {/* Batch actions bar */}
                {statusFilter === "pending" && pendingAffiliatesList.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedPendingAffiliates.length === pendingAffiliatesList.length && pendingAffiliatesList.length > 0}
                        onCheckedChange={toggleSelectAllPending}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedPendingAffiliates.length > 0 
                          ? `${selectedPendingAffiliates.length} selecionado(s)`
                          : "Selecionar todos"}
                      </span>
                    </div>
                    {selectedPendingAffiliates.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setBatchApproveDialogOpen(true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCheck className="h-4 w-4 mr-2" />
                        Aprovar Selecionados ({selectedPendingAffiliates.length})
                      </Button>
                    )}
                  </div>
                )}

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {statusFilter === "pending" && (
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedPendingAffiliates.length === pendingAffiliatesList.length && pendingAffiliatesList.length > 0}
                              onCheckedChange={toggleSelectAllPending}
                            />
                          </TableHead>
                        )}
                        <TableHead>Afiliado</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Indicações</TableHead>
                        <TableHead>Ganhos</TableHead>
                        <TableHead>Criação</TableHead>
                        <TableHead className="w-[150px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAffiliates.map((affiliate) => (
                        <TableRow key={affiliate.id} className={isAtRisk(affiliate) ? "bg-orange-500/5" : ""}>
                          {statusFilter === "pending" && (
                            <TableCell>
                              <Checkbox
                                checked={selectedAffiliateIds.has(affiliate.id)}
                                onCheckedChange={() => toggleAffiliateSelection(affiliate.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium">
                                  {affiliate.profile?.name || "N/A"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {affiliate.profile?.email || "-"}
                                </p>
                              </div>
                              {isAtRisk(affiliate) && (
                                <span title="Em risco de inatividade">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                              {affiliate.affiliate_code}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{affiliate.commission_rate}%</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCommissionRate(affiliate)}
                                className="h-6 w-6"
                                title="Editar taxa"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                          <TableCell className="font-medium">{affiliate.total_referrals}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(Number(affiliate.total_earnings))}
                          </TableCell>
                          <TableCell>
                            {format(new Date(affiliate.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDetailAffiliate(affiliate);
                                  setDetailDialogOpen(true);
                                }}
                                className="h-8 w-8"
                                title="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {affiliate.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => sendWelcomeEmail.mutate(affiliate.id)}
                                  disabled={sendWelcomeEmail.isPending}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-600 hover:bg-blue-500/10"
                                  title="Reenviar e-mail de boas-vindas"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              {affiliate.status !== "active" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStatusChange(affiliate, "active")}
                                  className="h-8 w-8 text-green-600 hover:text-green-600 hover:bg-green-500/10"
                                  title="Ativar"
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              )}
                              {affiliate.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStatusChange(affiliate, "suspended")}
                                  className="h-8 w-8 text-red-600 hover:text-red-600 hover:bg-red-500/10"
                                  title="Suspender"
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Affiliates Pagination */}
                {totalAffiliatesPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {((affiliatesPage - 1) * itemsPerPage) + 1} a {Math.min(affiliatesPage * itemsPerPage, filteredAffiliates.length)} de {filteredAffiliates.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAffiliatesPage(p => Math.max(1, p - 1))}
                        disabled={affiliatesPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Página {affiliatesPage} de {totalAffiliatesPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAffiliatesPage(p => Math.min(totalAffiliatesPages, p + 1))}
                        disabled={affiliatesPage === totalAffiliatesPages}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Change Confirmation Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => {
        setStatusDialogOpen(open);
        if (!open) setRejectionReason("");
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {newStatus === "active" ? "Aprovar" : newStatus === "suspended" ? "Suspender" : "Rejeitar"} afiliado
            </DialogTitle>
            <DialogDescription>
              {newStatus === "active" 
                ? `Deseja aprovar o afiliado ${selectedAffiliate?.profile?.name || selectedAffiliate?.affiliate_code}?`
                : `Informe o motivo para ${newStatus === "suspended" ? "suspender" : "rejeitar"} o afiliado ${selectedAffiliate?.profile?.name || selectedAffiliate?.affiliate_code}.`
              }
            </DialogDescription>
          </DialogHeader>
          
          {(newStatus === "suspended" || newStatus === "inactive") && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rejection-reason">Motivo da {newStatus === "suspended" ? "suspensão" : "rejeição"}</Label>
                <textarea
                  id="rejection-reason"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Ex: Documentação incompleta, violação dos termos de uso..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Este motivo será enviado ao afiliado por e-mail.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusDialogOpen(false);
                setRejectionReason("");
              }}
              disabled={updateAffiliateStatus.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedAffiliate) {
                  updateAffiliateStatus.mutate({
                    affiliateId: selectedAffiliate.id,
                    status: newStatus as "active" | "inactive" | "pending" | "suspended",
                    rejectionReason: rejectionReason.trim() || undefined,
                  });
                }
              }}
              disabled={updateAffiliateStatus.isPending || ((newStatus === "suspended" || newStatus === "inactive") && !rejectionReason.trim())}
              className={newStatus === "active" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {updateAffiliateStatus.isPending ? "Atualizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Commission Rate Dialog */}
      <Dialog open={commissionRateDialogOpen} onOpenChange={setCommissionRateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Taxa de Comissão</DialogTitle>
            <DialogDescription>
              Altere a taxa de comissão do afiliado{" "}
              <strong>{editingAffiliate?.profile?.name || editingAffiliate?.affiliate_code}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="commission-rate">Taxa de Comissão (%)</Label>
              <Input
                id="commission-rate"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
                placeholder="Ex: 10"
              />
              <p className="text-xs text-muted-foreground">
                Valor atual: {editingAffiliate?.commission_rate}%
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommissionRateDialogOpen(false)}
              disabled={updateCommissionRate.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCommissionRate}
              disabled={updateCommissionRate.isPending}
            >
              {updateCommissionRate.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Approve Confirmation Dialog */}
      <AlertDialog open={batchApproveDialogOpen} onOpenChange={setBatchApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar afiliados em lote</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a aprovar <strong>{selectedPendingAffiliates.length}</strong> afiliado{selectedPendingAffiliates.length > 1 ? 's' : ''} pendente{selectedPendingAffiliates.length > 1 ? 's' : ''}. 
              Cada um receberá um e-mail de aprovação automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[200px] overflow-y-auto my-4">
            <div className="space-y-2">
              {selectedPendingAffiliates.map((affiliate) => (
                <div key={affiliate.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{affiliate.profile?.name || affiliate.affiliate_code}</span>
                  <span className="text-xs text-muted-foreground">({affiliate.profile?.email})</span>
                </div>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchApproving}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchApprove}
              disabled={batchApproving}
              className="bg-green-600 hover:bg-green-700"
            >
              {batchApproving ? "Aprovando..." : `Aprovar ${selectedPendingAffiliates.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Affiliate Detail Dialog */}
      <AffiliateDetailDialog
        affiliate={detailAffiliate}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </AppLayout>
  );
}
