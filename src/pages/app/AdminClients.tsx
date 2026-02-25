import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Search, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditClientDialog } from "@/components/EditClientDialog";
import { useAdminCheck } from "@/hooks/useAdminCheck";


type AppRole = "admin" | "editor" | "moderator";

interface ClientData {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  plan_end_at: string | null;
  created_at: string;
}

const PLAN_ORDER = ["FREE", "START", "PRO", "SPECIALIST", "FALE_C_ESPECIALISTA"];

const AdminClients = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<ClientData | null>(null);
  const [assignRoleDialogOpen, setAssignRoleDialogOpen] = useState(false);
  const [clientToAssignRole, setClientToAssignRole] = useState<ClientData | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin");
  const [assigningRole, setAssigningRole] = useState(false);
  const { toast } = useToast();

  // Don't render while checking permissions
  if (adminLoading || !isAdmin) {
    return null;
  }

  useEffect(() => {
    loadClients();
  }, []);

  // Filtered and sorted clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Filter by plan
    if (planFilter !== "all") {
      result = result.filter(c => c.plan === planFilter);
    }

    // Filter by search query (name or email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        c.name?.toLowerCase().includes(query) || 
        c.email?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "plan_asc":
          return PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan);
        case "plan_desc":
          return PLAN_ORDER.indexOf(b.plan) - PLAN_ORDER.indexOf(a.plan);
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name_desc":
          return (b.name || "").localeCompare(a.name || "");
        default:
          return 0;
      }
    });

    return result;
  }, [clients, planFilter, searchQuery, sortBy]);

  const loadClients = async () => {
    try {
      // Get all user roles to exclude admins
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id");

      if (rolesError) throw rolesError;

      // Get IDs of users with roles (admins, editors, etc.)
      const usersWithRoles = new Set(roles?.map(r => r.user_id) || []);

      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Filter to only include clients (users without any role)
      const clientsData: ClientData[] = (profiles || [])
        .filter(profile => !usersWithRoles.has(profile.id))
        .map((profile) => ({
          id: profile.id,
          name: profile.name || "N/A",
          email: profile.email || "Email não disponível",
          phone: profile.phone || "N/A",
          plan: profile.plan,
          plan_end_at: profile.plan_end_at,
          created_at: profile.created_at,
        }));

      setClients(clientsData);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (client: ClientData) => {
    setClientToEdit(client);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (client: ClientData) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId: clientToDelete.id },
      });

      if (error) throw error;

      toast({
        title: "Cliente deletado",
        description: "O cliente foi removido com sucesso.",
      });

      // Recarregar lista
      await loadClients();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar cliente",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleAssignRoleClick = (client: ClientData) => {
    setClientToAssignRole(client);
    setSelectedRole("admin");
    setAssignRoleDialogOpen(true);
  };

  const handleAssignRoleConfirm = async () => {
    if (!clientToAssignRole) return;

    setAssigningRole(true);
    try {
      // Use service role via edge function to insert role
      const { error } = await supabase.functions.invoke("update-client-plan", {
        body: { 
          userId: clientToAssignRole.id,
          action: "assign_role",
          role: selectedRole
        },
      });

      if (error) throw error;

      toast({
        title: "Função atribuída",
        description: `${clientToAssignRole.name || clientToAssignRole.email} agora é ${selectedRole}.`,
      });

      // Reload to remove this client from list (they now have a role)
      await loadClients();
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir função",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAssigningRole(false);
      setAssignRoleDialogOpen(false);
      setClientToAssignRole(null);
    }
  };

  const getStatusBadge = (plan: string, endDate: string | null) => {
    if (plan === "FREE") {
      return <Badge className="bg-green-500">Ativo</Badge>;
    }
    
    if (!endDate || new Date(endDate) < new Date()) {
      return <Badge variant="destructive">Inativo</Badge>;
    }
    
    return <Badge className="bg-green-500">Ativo</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const colors = {
      FREE: "bg-gray-500",
      START: "bg-green-500",
      PRO: "bg-blue-500",
      SPECIALIST: "bg-purple-500",
    };
    
    return <Badge className={colors[plan as keyof typeof colors]}>{plan}</Badge>;
  };

  return (
    <AppLayout title="Gerenciar Clientes">
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle>Listagem de Clientes ({filteredClients.length})</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {/* Search by name/email */}
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

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Data (mais recente)</SelectItem>
                    <SelectItem value="date_asc">Data (mais antigo)</SelectItem>
                    <SelectItem value="plan_desc">Plano (maior)</SelectItem>
                    <SelectItem value="plan_asc">Plano (menor)</SelectItem>
                    <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
                    <SelectItem value="name_desc">Nome (Z-A)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Plan filter */}
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filtrar por plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os planos</SelectItem>
                    <SelectItem value="FREE">FREE</SelectItem>
                    <SelectItem value="START">START</SelectItem>
                    <SelectItem value="PRO">PRO</SelectItem>
                    <SelectItem value="SPECIALIST">SPECIALIST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Expiração</TableHead>
                    <TableHead className="w-[150px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>{getPlanBadge(client.plan)}</TableCell>
                      <TableCell>{getStatusBadge(client.plan, client.plan_end_at)}</TableCell>
                      <TableCell>
                        {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {client.plan === "FREE" 
                          ? "Não expira" 
                          : client.plan_end_at 
                            ? format(new Date(client.plan_end_at), "dd/MM/yyyy", { locale: ptBR })
                            : "N/A"
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAssignRoleClick(client)}
                            className="h-8 w-8 text-blue-600 hover:text-blue-600 hover:bg-blue-600/10"
                            title="Atribuir Função"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(client)}
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                            title="Editar Cliente"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(client)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Deletar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Client Dialog */}
      {clientToEdit && (
        <EditClientDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          client={clientToEdit}
          onSuccess={loadClients}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o cliente <strong>{clientToDelete?.name || clientToDelete?.email}</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita e todos os dados do cliente serão permanentemente removidos (perfil, respostas de questionário, histórico de visualizações).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Role Dialog */}
      <Dialog open={assignRoleDialogOpen} onOpenChange={setAssignRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Função</DialogTitle>
            <DialogDescription>
              Atribua uma função a <strong>{clientToAssignRole?.name || clientToAssignRole?.email}</strong>.
              <br />
              <br />
              O usuário será movido para a página de Equipe e terá acesso às funcionalidades da função atribuída.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Selecione a função:</label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="moderator">Moderador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleDialogOpen(false)} disabled={assigningRole}>
              Cancelar
            </Button>
            <Button onClick={handleAssignRoleConfirm} disabled={assigningRole}>
              {assigningRole ? "Atribuindo..." : "Atribuir Função"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminClients;
