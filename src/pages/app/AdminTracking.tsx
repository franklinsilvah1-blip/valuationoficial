import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Code, Plus, Pencil, Trash2, AlertCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { validateTrackingScript, sanitizeScriptId, getValidationSummary, type ValidationResult } from "@/utils/scriptSanitizer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface TrackingScript {
  id: string;
  name: string;
  type: string;
  script_id: string | null;
  script_content: string | null;
  location: string;
  is_active: boolean;
  created_at: string;
}

const scriptTypes = [
  { value: "google_analytics", label: "Google Analytics" },
  { value: "google_tag_manager", label: "Google Tag Manager" },
  { value: "google_ads", label: "Google Ads" },
  { value: "facebook_pixel", label: "Facebook Pixel" },
  { value: "custom", label: "Script Customizado" },
];

const scriptLocations = [
  { value: "head", label: "Head (antes do </head>)" },
  { value: "body_start", label: "Body Start (depois do <body>)" },
  { value: "body_end", label: "Body End (antes do </body>)" },
];

const AdminTracking = () => {
  const { isAdmin, loading } = useAdminCheck();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<TrackingScript | null>(null);
  const [scriptToDelete, setScriptToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "google_analytics",
    script_id: "",
    script_content: "",
    location: "head",
    is_active: true,
  });
  
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Fetch all tracking scripts
  const { data: scripts, isLoading } = useQuery({
    queryKey: ["tracking-scripts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_scripts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrackingScript[];
    },
    enabled: isAdmin,
  });

  // Create or update script
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (data.id) {
        // Update
        const { error } = await supabase
          .from("tracking_scripts")
          .update({
            name: data.name,
            type: data.type,
            script_id: data.script_id || null,
            script_content: data.script_content || null,
            location: data.location,
            is_active: data.is_active,
          })
          .eq("id", data.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("tracking_scripts")
          .insert({
            name: data.name,
            type: data.type,
            script_id: data.script_id || null,
            script_content: data.script_content || null,
            location: data.location,
            is_active: data.is_active,
            created_by: user?.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-scripts"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingScript ? "Script atualizado" : "Script criado",
        description: "As alterações foram salvas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar script",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete script
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tracking_scripts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-scripts"] });
      setDeleteDialogOpen(false);
      setScriptToDelete(null);
      toast({
        title: "Script removido",
        description: "O script foi removido com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover script",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "google_analytics",
      script_id: "",
      script_content: "",
      location: "head",
      is_active: true,
    });
    setEditingScript(null);
    setValidationResult(null);
  };

  const handleEdit = (script: TrackingScript) => {
    setEditingScript(script);
    setFormData({
      name: script.name,
      type: script.type,
      script_id: script.script_id || "",
      script_content: script.script_content || "",
      location: script.location,
      is_active: script.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setScriptToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleScriptContentChange = (content: string) => {
    setFormData({ ...formData, script_content: content });
    
    // Validate custom scripts in real-time
    if (formData.type === "custom" && content.trim()) {
      const result = validateTrackingScript(content);
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate script ID for non-custom scripts
    if (formData.type !== "custom" && formData.script_id) {
      const sanitizedId = sanitizeScriptId(formData.script_id);
      if (!sanitizedId) {
        toast({
          title: "ID de script inválido",
          description: "O ID do script contém caracteres inválidos. Use apenas letras, números e hífens.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Validate custom script content
    if (formData.type === "custom" && formData.script_content) {
      const result = validateTrackingScript(formData.script_content);
      if (!result.isValid) {
        toast({
          title: "Script bloqueado por segurança",
          description: `O script contém padrões potencialmente perigosos: ${result.errors.map(e => e.pattern).join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    saveMutation.mutate(editingScript ? { ...formData, id: editingScript.id } : formData);
  };

  if (loading || !isAdmin) {
    return null;
  }

  const getTypeLabel = (type: string) => {
    return scriptTypes.find(t => t.value === type)?.label || type;
  };

  const getLocationLabel = (location: string) => {
    return scriptLocations.find(l => l.value === location)?.label || location;
  };

  return (
    <AppLayout title="Pixels e Scripts">
      <div className="container py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Pixels e Scripts</h1>
            <p className="text-muted-foreground">
              Gerencie pixels de rastreamento e scripts do Google
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Script
          </Button>
        </div>

        {/* Info Alert */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Como funciona?</h3>
                <p className="text-sm text-muted-foreground">
                  Os scripts cadastrados aqui serão inseridos automaticamente em todas as páginas
                  do site de acordo com a localização escolhida. Para Google Analytics e Tag Manager,
                  basta informar o ID. Para scripts customizados, cole o código completo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scripts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Carregando scripts...</p>
              </CardContent>
            </Card>
          ) : scripts && scripts.length > 0 ? (
            scripts.map((script) => (
              <Card key={script.id} className="shadow-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Code className="h-5 w-5 text-primary" />
                        <CardTitle className="text-xl">{script.name}</CardTitle>
                        {script.is_active ? (
                          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">Ativo</Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Inativo</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {getTypeLabel(script.type)} • {getLocationLabel(script.location)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(script)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(script.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {(script.script_id || script.script_content) && (
                  <CardContent>
                    {script.script_id && (
                      <div className="mb-2">
                        <span className="text-sm font-medium">ID: </span>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {script.script_id}
                        </code>
                      </div>
                    )}
                    {script.script_content && (
                      <div>
                        <span className="text-sm font-medium">Script: </span>
                        <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto max-h-32">
                          {script.script_content}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Code className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum script cadastrado ainda
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Script
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingScript ? "Editar Script" : "Novo Script"}
            </DialogTitle>
            <DialogDescription>
              Configure o pixel ou script de rastreamento
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Script</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Google Analytics Principal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scriptTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type !== "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="script_id">ID do {getTypeLabel(formData.type)}</Label>
                <Input
                  id="script_id"
                  value={formData.script_id}
                  onChange={(e) => setFormData({ ...formData, script_id: e.target.value })}
                  placeholder={
                    formData.type === "google_analytics"
                      ? "G-XXXXXXXXXX ou UA-XXXXXXXXX"
                      : formData.type === "google_tag_manager"
                      ? "GTM-XXXXXXX"
                      : formData.type === "google_ads"
                      ? "AW-XXXXXXXXXX"
                      : "ID do pixel"
                  }
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="script_content">Código do Script</Label>
                <Textarea
                  id="script_content"
                  value={formData.script_content}
                  onChange={(e) => handleScriptContentChange(e.target.value)}
                  placeholder="Cole aqui o código completo do script..."
                  className="font-mono text-sm min-h-[200px]"
                  required
                />
                
                {/* Security validation feedback */}
                {validationResult && (
                  <div className="space-y-2">
                    {validationResult.errors.length > 0 && (
                      <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Script bloqueado:</strong> {validationResult.errors.map(e => e.pattern).join(", ")}
                        </AlertDescription>
                      </Alert>
                    )}
                    {validationResult.warnings.length > 0 && validationResult.isValid && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Avisos:</strong> {validationResult.warnings.map(w => w.pattern).join(", ")}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="location">Localização no HTML</Label>
              <Select
                value={formData.location}
                onValueChange={(value) => setFormData({ ...formData, location: value })}
              >
                <SelectTrigger id="location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scriptLocations.map((location) => (
                    <SelectItem key={location.value} value={location.value}>
                      {location.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Script ativo</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este script? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scriptToDelete && deleteMutation.mutate(scriptToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminTracking;
