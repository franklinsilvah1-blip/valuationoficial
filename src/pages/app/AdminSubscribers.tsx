import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { EditClientDialog } from "@/components/EditClientDialog";
import { 
  Users, 
  Search, 
  ChevronLeft,
  ChevronRight,
  Edit,
  AlertTriangle
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface Subscriber {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  plan_start_at: string | null;
  plan_end_at: string | null;
  created_at: string;
}

export default function AdminSubscribers() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subscriberToEdit, setSubscriberToEdit] = useState<Subscriber | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Fetch all profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-subscribers"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, plan, plan_start_at, plan_end_at, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Subscriber[];
    },
  });

  const handleEditClick = (subscriber: Subscriber) => {
    setSubscriberToEdit(subscriber);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
  };

  // Helper to check subscription status
  const getSubscriptionStatus = (subscriber: Subscriber) => {
    if (subscriber.plan === "FREE" || subscriber.plan === "START") return "free";
    if (!subscriber.plan_end_at) return "active";
    
    const now = new Date();
    const endDate = new Date(subscriber.plan_end_at);
    const daysUntilExpiry = differenceInDays(endDate, now);
    
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 7) return "expiring";
    return "active";
  };

  // Filter subscribers
  const filteredSubscribers = useMemo(() => {
    let result = [...profiles];

    // Plan filter
    if (planFilter !== "all") {
      result = result.filter(s => s.plan === planFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(s => getSubscriptionStatus(s) === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [profiles, planFilter, statusFilter, searchQuery]);

  // Paginated results
  const paginatedSubscribers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSubscribers.slice(start, start + itemsPerPage);
  }, [filteredSubscribers, currentPage]);

  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);

  // Reset pagination when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [planFilter, statusFilter, searchQuery]);

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "FREE":
        return <Badge variant="outline">FREE</Badge>;
      case "START":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">START</Badge>;
      case "PRO":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">PRO</Badge>;
      case "SPECIALIST":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">SPECIALIST</Badge>;
      case "WEALTH":
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/30">WEALTH</Badge>;
      case "FALE_C_ESPECIALISTA":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">CONSULTORIA (legado)</Badge>;
      default:
        return <Badge variant="outline">{plan}</Badge>;
    }
  };

  const getStatusBadge = (subscriber: Subscriber) => {
    const status = getSubscriptionStatus(subscriber);
    switch (status) {
      case "free":
        return null;
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Ativo</Badge>;
      case "expiring":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">Expirando</Badge>;
      case "expired":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Expirado</Badge>;
      default:
        return null;
    }
  };

  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Lista de Assinantes">
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
                <Link to="/app/admin/subscriptions">Assinaturas</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Assinantes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Assinantes ({filteredSubscribers.length})</CardTitle>
                <CardDescription>
                  Lista completa de usuários e seus planos de assinatura
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-[220px]"
                  />
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="START">START</SelectItem>
                    <SelectItem value="PRO">PRO</SelectItem>
                    <SelectItem value="SPECIALIST">SPECIALIST</SelectItem>
                    <SelectItem value="WEALTH">WEALTH</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="expiring">Expirando</SelectItem>
                    <SelectItem value="expired">Expirados</SelectItem>
                    <SelectItem value="free">Gratuitos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredSubscribers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum assinante encontrado.</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Renovação</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSubscribers.map((subscriber) => {
                        const status = getSubscriptionStatus(subscriber);
                        const isExpiring = status === "expiring";
                        
                        return (
                          <TableRow key={subscriber.id} className={isExpiring ? "bg-orange-500/5" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium">{subscriber.name || "Sem nome"}</p>
                                  <p className="text-xs text-muted-foreground">{subscriber.email}</p>
                                </div>
                                {isExpiring && (
                                  <span title="Assinatura expirando em breve">
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getPlanBadge(subscriber.plan)}</TableCell>
                            <TableCell>{getStatusBadge(subscriber)}</TableCell>
                            <TableCell>
                              {subscriber.plan_start_at 
                                ? format(new Date(subscriber.plan_start_at), "dd/MM/yyyy", { locale: ptBR })
                                : "-"
                              }
                            </TableCell>
                            <TableCell>
                              {subscriber.plan_end_at 
                                ? format(new Date(subscriber.plan_end_at), "dd/MM/yyyy", { locale: ptBR })
                                : "-"
                              }
                            </TableCell>
                            <TableCell>
                              {format(new Date(subscriber.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(subscriber)}
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                title="Editar Cliente"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredSubscribers.length)} de {filteredSubscribers.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
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

      {/* Edit Client Dialog */}
      {subscriberToEdit && (
        <EditClientDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          client={{
            id: subscriberToEdit.id,
            name: subscriberToEdit.name || "",
            email: subscriberToEdit.email || "",
            phone: subscriberToEdit.phone || "",
            plan: subscriberToEdit.plan,
            plan_end_at: subscriberToEdit.plan_end_at,
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </AppLayout>
  );
}
