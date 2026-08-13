import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Users, Trash2, Edit, UserMinus, MoreHorizontal, Shield, PenTool, Eye } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { EditPlanDialog } from "@/components/EditPlanDialog";


type AppRole = "admin" | "editor" | "moderator";

interface UserWithRole {
  id: string;
  name: string | null;
  email: string | null;
  plan: string;
  plan_start_at: string | null;
  plan_end_at: string | null;
  created_at: string;
  role: AppRole;
  role_id: string;
}

const ROLE_INFO: Record<string, { label: string; color: string; icon: any; description: string }> = {
  admin: {
    label: "Administrador",
    color: "bg-purple-500",
    icon: Shield,
    description: "Acesso total ao sistema, gerenciamento de usuários e configurações"
  },
  moderator: {
    label: "Moderador",
    color: "bg-blue-500",
    icon: Eye,
    description: "Moderação de conteúdo, visualização de relatórios e gestão de comunidade"
  },
  editor: {
    label: "Editor",
    color: "bg-green-500",
    icon: PenTool,
    description: "Criação e edição de conteúdo do blog e materiais"
  },
  user: {
    label: "Usuário",
    color: "bg-gray-500",
    icon: Users,
    description: "Acesso básico ao sistema"
  },
};

const AdminUsers = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserWithRole | null>(null);
  const [removeRoleDialogOpen, setRemoveRoleDialogOpen] = useState(false);
  const [userToRemoveRole, setUserToRemoveRole] = useState<UserWithRole | null>(null);
  const [removingRole, setRemovingRole] = useState(false);
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("editor");
  const [changingRole, setChangingRole] = useState(false);
  const { toast } = useToast();

  // Don't render while checking permissions
  if (adminLoading || !isAdmin) {
    return null;
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, roleFilter, users]);

  const loadUsers = async () => {
    try {
      // Get all user roles first
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Get profiles only for users that have roles
      const userIds = roles?.map(r => r.user_id) || [];
      
      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: (userRole?.role || "user") as AppRole,
          role_id: userRole?.id || "",
        };
      });
      
      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user: UserWithRole) => {
    setUserToEdit(user);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (user: UserWithRole) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleRemoveRoleClick = (user: UserWithRole) => {
    setUserToRemoveRole(user);
    setRemoveRoleDialogOpen(true);
  };

  const handleChangeRoleClick = (user: UserWithRole) => {
    setUserToChangeRole(user);
    setNewRole(user.role === "admin" ? "editor" : user.role === "editor" ? "moderator" : "editor");
    setChangeRoleDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId: userToDelete.id },
      });

      if (error) throw error;

      toast({
        title: "Usuário deletado",
        description: "O usuário foi removido com sucesso.",
      });

      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleRemoveRoleConfirm = async () => {
    if (!userToRemoveRole) return;

    setRemovingRole(true);
    try {
      const { error } = await supabase.functions.invoke("update-client-plan", {
        body: { 
          userId: userToRemoveRole.id,
          action: "remove_role",
          roleId: userToRemoveRole.role_id
        },
      });

      if (error) throw error;

      toast({
        title: "Função removida",
        description: `${userToRemoveRole.name || userToRemoveRole.email} não é mais ${ROLE_INFO[userToRemoveRole.role]?.label}.`,
      });

      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao remover função",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemovingRole(false);
      setRemoveRoleDialogOpen(false);
      setUserToRemoveRole(null);
    }
  };

  const handleChangeRoleConfirm = async () => {
    if (!userToChangeRole) return;

    setChangingRole(true);
    try {
      // First remove the old role
      const { error: removeError } = await supabase.functions.invoke("update-client-plan", {
        body: { 
          userId: userToChangeRole.id,
          action: "remove_role",
          roleId: userToChangeRole.role_id
        },
      });

      if (removeError) throw removeError;

      // Then add the new role
      const { error: addError } = await supabase.functions.invoke("update-client-plan", {
        body: { 
          userId: userToChangeRole.id,
          action: "assign_role",
          role: newRole
        },
      });

      if (addError) throw addError;

      toast({
        title: "Função alterada",
        description: `${userToChangeRole.name || userToChangeRole.email} agora é ${ROLE_INFO[newRole]?.label}.`,
      });

      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar função",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChangingRole(false);
      setChangeRoleDialogOpen(false);
      setUserToChangeRole(null);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter((user) =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const getRoleBadge = (role: string) => {
    const info = ROLE_INFO[role] || ROLE_INFO.user;
    const IconComponent = info.icon;
    
    return (
      <Badge className={`${info.color} gap-1`}>
        <IconComponent className="h-3 w-3" />
        {info.label}
      </Badge>
    );
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "FREE":
      case "START":
        return "secondary";
      case "PRO":
      case "SPECIALIST":
      case "WEALTH":
        return "default";
      default:
        return "secondary";
    }
  };

  // Count by role
  const roleCounts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AppLayout title="Equipe">
      <div className="container py-12 space-y-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Equipe</h1>
          </div>
          <p className="text-muted-foreground">Gerencie usuários com funções administrativas (administradores, editores, moderadores)</p>
        </div>

        {/* Role Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["admin", "editor", "moderator"].map((role) => {
            const info = ROLE_INFO[role];
            const IconComponent = info.icon;
            return (
              <Card key={role} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${info.color}`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{roleCounts[role] || 0}</p>
                      <p className="text-xs text-muted-foreground">{info.label}(es)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{info.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Membros da Equipe</CardTitle>
            <CardDescription>
              {filteredUsers.length} {filteredUsers.length === 1 ? "membro encontrado" : "membros encontrados"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as funções</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="moderator">Moderador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela */}
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum membro da equipe encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name || "Sem nome"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.email || "—"}
                            </TableCell>
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell>
                              <Badge variant={getPlanBadgeVariant(user.plan)}>{user.plan}</Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditClick(user)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar Plano
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleChangeRoleClick(user)}
                                    disabled={user.role === "admin"}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Alterar Função
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleRemoveRoleClick(user)}
                                    disabled={user.role === "admin"}
                                    className="text-orange-600"
                                  >
                                    <UserMinus className="h-4 w-4 mr-2" />
                                    Remover Função
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick(user)}
                                    disabled={user.role === "admin"}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Deletar Usuário
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Plan Dialog */}
        {userToEdit && (
          <EditPlanDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            client={{
              id: userToEdit.id,
              name: userToEdit.name || "",
              email: userToEdit.email || "",
              plan: userToEdit.plan,
              plan_end_at: userToEdit.plan_end_at,
            }}
            onSuccess={() => {
              loadUsers();
              setEditDialogOpen(false);
              setUserToEdit(null);
            }}
          />
        )}

        {/* Remove Role Dialog */}
        <AlertDialog open={removeRoleDialogOpen} onOpenChange={setRemoveRoleDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover função</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover a função <strong>{ROLE_INFO[userToRemoveRole?.role || "user"]?.label}</strong> de <strong>{userToRemoveRole?.name || userToRemoveRole?.email}</strong>?
                <br />
                <br />
                O usuário será movido para a lista de clientes e perderá acesso às funcionalidades administrativas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removingRole}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveRoleConfirm}
                disabled={removingRole}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {removingRole ? "Removendo..." : "Remover Função"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Change Role Dialog */}
        <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Função</DialogTitle>
              <DialogDescription>
                Altere a função de <strong>{userToChangeRole?.name || userToChangeRole?.email}</strong>.
                <br />
                Função atual: <strong>{ROLE_INFO[userToChangeRole?.role || "user"]?.label}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">Nova função:</label>
              <Select value={newRole} onValueChange={(value) => setNewRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="moderator">Moderador</SelectItem>
                </SelectContent>
              </Select>
              {newRole && (
                <p className="text-xs text-muted-foreground mt-2">
                  {ROLE_INFO[newRole]?.description}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeRoleDialogOpen(false)} disabled={changingRole}>
                Cancelar
              </Button>
              <Button onClick={handleChangeRoleConfirm} disabled={changingRole || newRole === userToChangeRole?.role}>
                {changingRole ? "Alterando..." : "Alterar Função"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja deletar o usuário <strong>{userToDelete?.name || userToDelete?.email}</strong>?
                <br />
                <br />
                Esta ação não pode ser desfeita e todos os dados do usuário serão permanentemente removidos.
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
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
