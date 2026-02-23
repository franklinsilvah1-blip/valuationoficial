import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Video, GripVertical, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExclusiveVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  order_num: number;
  is_active: boolean;
  created_at: string;
}

interface VideoFormData {
  title: string;
  description: string;
  youtube_id: string;
  order_num: number;
  is_active: boolean;
}

const extractYouTubeId = (input: string): string => {
  // Handle full URLs
  const urlMatch = input.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (urlMatch) return urlMatch[1];
  // Handle plain ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  return input;
};

export default function AdminVideos() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<ExclusiveVideo | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VideoFormData>({
    title: "",
    description: "",
    youtube_id: "",
    order_num: 0,
    is_active: true,
  });

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["admin-exclusive-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exclusive_videos")
        .select("*")
        .order("order_num", { ascending: true });

      if (error) throw error;
      return data as ExclusiveVideo[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: VideoFormData & { id?: string }) => {
      const videoData = {
        ...data,
        youtube_id: extractYouTubeId(data.youtube_id),
      };

      if (data.id) {
        const { error } = await supabase
          .from("exclusive_videos")
          .update(videoData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("exclusive_videos")
          .insert(videoData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exclusive-videos"] });
      queryClient.invalidateQueries({ queryKey: ["exclusive-videos"] });
      toast.success(editingVideo ? "Vídeo atualizado!" : "Vídeo adicionado!");
      handleCloseDialog();
    },
    onError: (error) => {
      console.error("Error saving video:", error);
      toast.error("Erro ao salvar vídeo");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("exclusive_videos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exclusive-videos"] });
      queryClient.invalidateQueries({ queryKey: ["exclusive-videos"] });
      toast.success("Vídeo removido!");
    },
    onError: (error) => {
      console.error("Error deleting video:", error);
      toast.error("Erro ao remover vídeo");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("exclusive_videos")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exclusive-videos"] });
      queryClient.invalidateQueries({ queryKey: ["exclusive-videos"] });
    },
    onError: (error) => {
      console.error("Error toggling video:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (reorderedVideos: { id: string; order_num: number }[]) => {
      const updates = reorderedVideos.map(({ id, order_num }) =>
        supabase.from("exclusive_videos").update({ order_num }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exclusive-videos"] });
      queryClient.invalidateQueries({ queryKey: ["exclusive-videos"] });
      toast.success("Ordem atualizada!");
    },
    onError: (error) => {
      console.error("Error reordering videos:", error);
      toast.error("Erro ao reordenar vídeos");
    },
  });

  const handleDragStart = (e: React.DragEvent, videoId: string) => {
    setDraggedId(videoId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = videos.findIndex((v) => v.id === draggedId);
    const targetIndex = videos.findIndex((v) => v.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const reordered = [...videos];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    const updates = reordered.map((video, index) => ({
      id: video.id,
      order_num: index + 1,
    }));

    reorderMutation.mutate(updates);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingVideo(null);
    setFormData({
      title: "",
      description: "",
      youtube_id: "",
      order_num: videos.length + 1,
      is_active: true,
    });
  };

  const handleEdit = (video: ExclusiveVideo) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || "",
      youtube_id: video.youtube_id,
      order_num: video.order_num,
      is_active: video.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingVideo?.id,
    });
  };

  const handleAddNew = () => {
    setEditingVideo(null);
    setFormData({
      title: "",
      description: "",
      youtube_id: "",
      order_num: videos.length + 1,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  return (
    <AppLayout title="Gerenciar Vídeos">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Conteúdos Exclusivos</h1>
              <p className="text-muted-foreground">
                Gerencie as vídeo aulas disponíveis para assinantes
              </p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Vídeo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingVideo ? "Editar Vídeo" : "Novo Vídeo"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Vídeo Aula 01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do vídeo..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube_id">Link ou ID do YouTube</Label>
                  <Input
                    id="youtube_id"
                    value={formData.youtube_id}
                    onChange={(e) => setFormData({ ...formData, youtube_id: e.target.value })}
                    placeholder="https://youtu.be/xxx ou ID"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Cole o link completo do YouTube ou apenas o ID do vídeo
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order_num">Ordem de exibição</Label>
                  <Input
                    id="order_num"
                    type="number"
                    min={1}
                    value={formData.order_num}
                    onChange={(e) => setFormData({ ...formData, order_num: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Ativo</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vídeos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum vídeo cadastrado ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden md:table-cell">YouTube ID</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow
                      key={video.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, video.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, video.id)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-move ${draggedId === video.id ? "opacity-50 bg-muted" : ""}`}
                    >
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{video.order_num}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{video.title}</p>
                          {video.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {video.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <a
                          href={`https://youtube.com/watch?v=${video.youtube_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {video.youtube_id}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={video.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: video.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(video)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remover este vídeo?")) {
                                deleteMutation.mutate(video.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
    </AppLayout>
  );
}
