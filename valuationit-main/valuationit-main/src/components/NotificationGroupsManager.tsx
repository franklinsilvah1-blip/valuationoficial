import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import GroupMembersDialog from "./GroupMembersDialog";

interface NotificationGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
}

const NotificationGroupsManager = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<NotificationGroup | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Fetch groups with member counts
  const { data: groups, isLoading } = useQuery({
    queryKey: ["notification-groups"],
    queryFn: async () => {
      const { data: groupsData, error } = await supabase
        .from("notification_groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get member counts
      const { data: memberCounts } = await supabase
        .from("notification_group_members")
        .select("group_id");

      const countMap = new Map<string, number>();
      memberCounts?.forEach((m) => {
        const count = countMap.get(m.group_id) || 0;
        countMap.set(m.group_id, count + 1);
      });

      return groupsData.map((g) => ({
        ...g,
        member_count: countMap.get(g.id) || 0,
      })) as NotificationGroup[];
    },
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("notification_groups").insert({
        name: data.name,
        description: data.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
      toast.success("Grupo criado com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao criar grupo: " + error.message);
    },
  });

  // Update group mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("notification_groups")
        .update({
          name: data.name,
          description: data.description || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
      toast.success("Grupo atualizado com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar grupo: " + error.message);
    },
  });

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
      toast.success("Grupo excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setSelectedGroup(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir grupo: " + error.message);
    },
  });

  const handleOpenCreate = () => {
    setSelectedGroup(null);
    setFormData({ name: "", description: "" });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (group: NotificationGroup) => {
    setSelectedGroup(group);
    setFormData({ name: group.name, description: group.description || "" });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedGroup(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Nome do grupo é obrigatório");
      return;
    }

    if (selectedGroup) {
      updateMutation.mutate({ ...formData, id: selectedGroup.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (group: NotificationGroup) => {
    setSelectedGroup(group);
    setIsDeleteDialogOpen(true);
  };

  const handleManageMembers = (group: NotificationGroup) => {
    setSelectedGroup(group);
    setIsMembersDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Grupo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : groups?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum grupo cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                groups?.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {group.description || "-"}
                    </TableCell>
                    <TableCell>{group.member_count}</TableCell>
                    <TableCell>
                      {format(new Date(group.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageMembers(group)}
                        >
                          <Users className="mr-1 h-3 w-3" />
                          Membros
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(group)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(group)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedGroup ? "Editar Grupo" : "Novo Grupo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do grupo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {selectedGroup ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o grupo "{selectedGroup?.name}"?
              Todos os membros serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedGroup && deleteMutation.mutate(selectedGroup.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members Dialog */}
      {selectedGroup && (
        <GroupMembersDialog
          group={selectedGroup}
          open={isMembersDialogOpen}
          onOpenChange={setIsMembersDialogOpen}
        />
      )}
    </div>
  );
};

export default NotificationGroupsManager;
