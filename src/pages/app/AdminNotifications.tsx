import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  Send,
  Users,
  UsersRound,
  AlertTriangle,
} from "lucide-react";
import NotificationGroupsManager from "@/components/NotificationGroupsManager";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PushNotification {
  id: string;
  title: string;
  message: string;
  icon: string;
  url: string;
  target_audience: string;
  target_plan: string | null;
  target_group_id: string | null;
  is_active: boolean;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
}

interface NotificationGroup {
  id: string;
  name: string;
}

const PLAN_OPTIONS = [
  { value: "START", label: "Start" },
  { value: "PRO", label: "Pro" },
  { value: "SPECIALIST", label: "Specialist" },
  { value: "WEALTH", label: "Wealth" },
];

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Todos (logados + anônimos)" },
  { value: "logged_in", label: "Apenas usuários logados" },
  { value: "anonymous", label: "Apenas visitantes anônimos" },
  { value: "free", label: "Usuários Free" },
  { value: "paid", label: "Usuários Pagos" },
  { value: "specific_plan", label: "Plano Específico" },
  { value: "group", label: "Grupo Específico" },
];

const AdminNotifications = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<PushNotification | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    icon: "/logo.webp",
    url: "/",
    target_audience: "all",
    target_plan: "",
    target_group_id: "",
    is_active: true,
  });

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["admin-push-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PushNotification[];
    },
  });

  // Fetch subscription stats
  const { data: subscriptionStats } = useQuery({
    queryKey: ["push-subscription-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, user_id, is_active")
        .eq("is_active", true);

      if (error) throw error;
      
      const total = data?.length || 0;
      const anonymous = data?.filter(s => s.user_id === null).length || 0;
      const loggedIn = total - anonymous;
      
      return { total, anonymous, loggedIn };
    },
  });

  // Fetch notification groups with member subscription counts
  const { data: groups } = useQuery({
    queryKey: ["notification-groups-select"],
    queryFn: async () => {
      const { data: groupsData, error } = await supabase
        .from("notification_groups")
        .select("id, name")
        .order("name");

      if (error) throw error;
      
      // For each group, get the count of members with active push subscriptions
      const groupsWithStats = await Promise.all(
        (groupsData || []).map(async (group) => {
          // Get group members
          const { data: members } = await supabase
            .from("notification_group_members")
            .select("user_id")
            .eq("group_id", group.id);
          
          const memberIds = members?.map(m => m.user_id) || [];
          
          // Count how many have active push subscriptions
          let activeSubscriptionsCount = 0;
          if (memberIds.length > 0) {
            const { count } = await supabase
              .from("push_subscriptions")
              .select("id", { count: "exact", head: true })
              .in("user_id", memberIds)
              .eq("is_active", true);
            
            activeSubscriptionsCount = count || 0;
          }
          
          return {
            ...group,
            memberCount: memberIds.length,
            activeSubscriptionsCount,
          };
        })
      );
      
      return groupsWithStats as (NotificationGroup & { memberCount: number; activeSubscriptionsCount: number })[];
    },
  });

  // Create notification mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("push_notifications").insert({
        title: data.title,
        message: data.message,
        icon: data.icon,
        url: data.url,
        target_audience: data.target_audience,
        target_plan: data.target_audience === "specific_plan" ? data.target_plan : null,
        target_group_id: data.target_audience === "group" ? data.target_group_id : null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-push-notifications"] });
      toast.success("Notificação criada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao criar notificação: " + error.message);
    },
  });

  // Update notification mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("push_notifications")
        .update({
          title: data.title,
          message: data.message,
          icon: data.icon,
          url: data.url,
          target_audience: data.target_audience,
          target_plan: data.target_audience === "specific_plan" ? data.target_plan : null,
          target_group_id: data.target_audience === "group" ? data.target_group_id : null,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-push-notifications"] });
      toast.success("Notificação atualizada com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar notificação: " + error.message);
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("push_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-push-notifications"] });
      toast.success("Notificação excluída com sucesso!");
      setIsDeleteDialogOpen(false);
      setSelectedNotification(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir notificação: " + error.message);
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("push_notifications")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-push-notifications"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: { notificationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-push-notifications"] });
      if (data.sent === 0 && data.failed === 0) {
        toast.info("Nenhum usuário inscrito para receber notificações");
      } else {
        toast.success(`Notificação enviada! ${data.sent} sucesso, ${data.failed} falhas`);
      }
    },
    onError: (error) => {
      toast.error("Erro ao enviar notificação: " + error.message);
    },
  });

  const handleOpenCreate = () => {
    setSelectedNotification(null);
    setFormData({
      title: "",
      message: "",
      icon: "/logo.webp",
      url: "/",
      target_audience: "all",
      target_plan: "",
      target_group_id: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (notification: PushNotification) => {
    setSelectedNotification(notification);
    setFormData({
      title: notification.title,
      message: notification.message,
      icon: notification.icon,
      url: notification.url,
      target_audience: notification.target_audience,
      target_plan: notification.target_plan || "",
      target_group_id: notification.target_group_id || "",
      is_active: notification.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedNotification(null);
    setFormData({
      title: "",
      message: "",
      icon: "/logo.webp",
      url: "/",
      target_audience: "all",
      target_plan: "",
      target_group_id: "",
      is_active: true,
    });
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }

    if (selectedNotification) {
      updateMutation.mutate({ ...formData, id: selectedNotification.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (notification: PushNotification) => {
    setSelectedNotification(notification);
    setIsDeleteDialogOpen(true);
  };

  const getAudienceLabel = (audience: string, plan: string | null, groupId: string | null) => {
    if (audience === "specific_plan" && plan) {
      return `Plano ${plan}`;
    }
    if (audience === "group" && groupId) {
      const group = groups?.find(g => g.id === groupId);
      return `Grupo: ${group?.name || "..."}`;
    }
    return AUDIENCE_OPTIONS.find((o) => o.value === audience)?.label || audience;
  };

  return (
    <AppLayout title="Notificações Push">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inscritos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptionStats?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Todos os dispositivos ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Logados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptionStats?.loggedIn ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Com conta no sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visitantes Anônimos</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptionStats?.anonymous ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Sem conta, apenas PWA
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {notifications?.reduce((acc, n) => acc + n.sent_count, 0) ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Total de notificações
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">
              <Bell className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="groups">
              <UsersRound className="h-4 w-4 mr-2" />
              Grupos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            {/* Actions */}
            <div className="flex justify-end">
              <Button onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Notificação
              </Button>
            </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Audiência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviadas</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : notifications?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma notificação cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications?.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-medium max-w-[150px] truncate">
                        {notification.title}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {notification.message}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getAudienceLabel(notification.target_audience, notification.target_plan, notification.target_group_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={notification.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({
                              id: notification.id,
                              is_active: checked,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>{notification.sent_count}</TableCell>
                      <TableCell>
                        {format(new Date(notification.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendNotificationMutation.mutate(notification.id)}
                            disabled={!notification.is_active || sendNotificationMutation.isPending}
                          >
                            <Send className="mr-1 h-3 w-3" />
                            Enviar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(notification)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(notification)}
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
          </TabsContent>

          <TabsContent value="groups">
            <NotificationGroupsManager />
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedNotification ? "Editar Notificação" : "Nova Notificação"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título da notificação"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Corpo da notificação"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL de destino</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="/"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon">Ícone (URL)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="/logo.webp"
                />
              </div>

              <div className="space-y-2">
                <Label>Audiência</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) =>
                    setFormData({ ...formData, target_audience: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.target_audience === "specific_plan" && (
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={formData.target_plan}
                    onValueChange={(value) =>
                      setFormData({ ...formData, target_plan: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.target_audience === "group" && (
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select
                    value={formData.target_group_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, target_group_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups?.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.activeSubscriptionsCount}/{group.memberCount} com push)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.target_group_id && (() => {
                    const selectedGroup = groups?.find(g => g.id === formData.target_group_id);
                    if (selectedGroup && selectedGroup.activeSubscriptionsCount === 0) {
                      return (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Este grupo tem {selectedGroup.memberCount} membro(s), mas nenhum registrou notificações push no navegador. 
                            Os membros precisam acessar o app e permitir notificações para recebê-las.
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Ativo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
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
                {selectedNotification ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Notificação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a notificação "{selectedNotification?.title}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedNotification && deleteMutation.mutate(selectedNotification.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default AdminNotifications;
