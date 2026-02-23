import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye, Calendar, Tag, Clock, Link, CheckCircle2, XCircle, AlertCircle, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CreateCategoryDialog from "@/components/CreateCategoryDialog";
import { ImageUploadDragDrop } from "@/components/ImageUploadDragDrop";
import { RichTextEditor } from "@/components/RichTextEditor";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string;
  author_id: string | null;
  blog_author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  status: "draft" | "published" | "scheduled";
  views: number;
  scheduled_for: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  og_image: string | null;
  featured: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Author {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

const AdminBlog = () => {
  const { loading } = useAdminCheck();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [slugValidation, setSlugValidation] = useState<{
    status: "idle" | "checking" | "valid" | "invalid" | "duplicate";
    message: string;
  }>({ status: "idle", message: "" });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    cover_image: "",
    author_id: "",
    status: "published" as "draft" | "published" | "scheduled",
    scheduled_for: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    og_image: "",
    featured: false,
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: authors = [], isLoading: loadingAuthors } = useQuery({
    queryKey: ["blog-authors"],
    queryFn: async () => {
      // Buscar apenas usuários com role 'admin'
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, name)
        `)
        .eq("role", "admin");

      if (error) throw error;
      
      // Mapear para o formato esperado
      return (data || []).map(item => ({
        id: item.user_id,
        name: item.profiles.name || "Admin",
      })) as Author[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const slug = data.slug || generateSlug(data.title);
      
      const authorId = data.author_id || authors[0]?.id;
      
      if (!authorId) {
        throw new Error("Nenhum administrador disponível.");
      }
      
      const selectedAuthor = authors.find(a => a.id === authorId);
      const authorName = selectedAuthor?.name || "Admin";

      const postData: any = {
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt || null,
        cover_image: data.cover_image || null,
        author: authorName,
        author_id: user?.id,
        blog_author_id: authorId,
        status: data.status,
        scheduled_for: data.scheduled_for || null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        seo_keywords: data.seo_keywords ? data.seo_keywords.split(',').map(k => k.trim()) : null,
        og_image: data.og_image || data.cover_image || null,
        featured: data.featured,
      };

      const { data: post, error: postError } = await supabase
        .from("blog_posts")
        .insert(postData)
        .select()
        .single();

      if (postError) throw postError;

      if (selectedCategories.length > 0 && post) {
        const categoryInserts = selectedCategories.map((categoryId) => ({
          post_id: post.id,
          category_id: categoryId,
        }));

        const { error: catError } = await supabase
          .from("post_categories")
          .insert(categoryInserts);

        if (catError) throw catError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      toast({ title: "Post criado com sucesso!" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar post", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const authorId = data.author_id || authors[0]?.id;
      
      if (!authorId) {
        throw new Error("Nenhum administrador disponível.");
      }
      
      const selectedAuthor = authors.find(a => a.id === authorId);
      const authorName = selectedAuthor?.name || editingPost?.author || "Admin";

      const updates: any = {
        title: data.title,
        slug: data.slug || generateSlug(data.title),
        content: data.content,
        excerpt: data.excerpt || null,
        cover_image: data.cover_image || null,
        author: authorName,
        blog_author_id: authorId,
        status: data.status,
        scheduled_for: data.scheduled_for || null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        seo_keywords: data.seo_keywords ? data.seo_keywords.split(',').map(k => k.trim()) : null,
        og_image: data.og_image || data.cover_image || null,
        featured: data.featured,
      };
      
      const { error: updateError } = await supabase
        .from("blog_posts")
        .update(updates)
        .eq("id", data.id);

      if (updateError) throw updateError;

      await supabase.from("post_categories").delete().eq("post_id", data.id);

      if (selectedCategories.length > 0) {
        const categoryInserts = selectedCategories.map((categoryId) => ({
          post_id: data.id,
          category_id: categoryId,
        }));
        await supabase.from("post_categories").insert(categoryInserts);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      toast({ title: "Post atualizado!" });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      toast({ title: "Post excluído!" });
    },
  });

  const generateSlug = (title: string) => {
    return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
  };

  // Validar slug em tempo real
  useEffect(() => {
    const validateSlug = async () => {
      const slug = formData.slug.trim();
      
      if (!slug) {
        setSlugValidation({ status: "idle", message: "" });
        return;
      }

      // Validar formato do slug
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(slug)) {
        setSlugValidation({ 
          status: "invalid", 
          message: "Slug deve conter apenas letras minúsculas, números e hífens" 
        });
        return;
      }

      // Verificar duplicatas no banco
      setSlugValidation({ status: "checking", message: "Verificando disponibilidade..." });
      
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id")
        .eq("slug", slug)
        .single();

      if (error && error.code !== "PGRST116") {
        // Erro diferente de "not found"
        setSlugValidation({ status: "idle", message: "" });
        return;
      }

      // Se encontrou um post e não está editando, ou está editando mas o ID é diferente
      if (data && (!editingPost || data.id !== editingPost.id)) {
        setSlugValidation({ 
          status: "duplicate", 
          message: "Este slug já está em uso" 
        });
      } else {
        setSlugValidation({ 
          status: "valid", 
          message: "Slug disponível" 
        });
      }
    };

    // Debounce de 500ms
    const timeoutId = setTimeout(validateSlug, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.slug, editingPost]);

  const openDialog = async (post?: BlogPost) => {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt || "",
        cover_image: post.cover_image || "",
        author_id: post.blog_author_id || "",
        status: post.status,
        scheduled_for: post.scheduled_for ? format(new Date(post.scheduled_for), "yyyy-MM-dd'T'HH:mm") : "",
        seo_title: post.seo_title || "",
        seo_description: post.seo_description || "",
        seo_keywords: post.seo_keywords?.join(", ") || "",
        og_image: post.og_image || "",
        featured: post.featured,
      });

      const { data: postCats } = await supabase.from("post_categories").select("category_id").eq("post_id", post.id);
      if (postCats) setSelectedCategories(postCats.map((pc) => pc.category_id));
    } else {
      setEditingPost(null);
      setFormData({
        title: "", slug: "", content: "", excerpt: "", cover_image: "", author_id: authors[0]?.id || "",
        status: "published", scheduled_for: "", seo_title: "", seo_description: "", seo_keywords: "", og_image: "",
        featured: false,
      });
      setSelectedCategories([]);
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPost(null);
    setSelectedCategories([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isUploadingImage) {
      toast({
        title: "Aguarde o upload da imagem",
        description: "O upload da imagem ainda está em andamento",
        variant: "destructive",
      });
      return;
    }
    
    // Bloquear submit se slug for inválido ou duplicado
    if (slugValidation.status === "invalid" || slugValidation.status === "duplicate") {
      toast({
        title: "Erro no slug",
        description: slugValidation.message,
        variant: "destructive",
      });
      return;
    }
    
    if (editingPost) {
      updateMutation.mutate({ ...formData, id: editingPost.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]);
  };

  const getStatusBadge = (status: string, scheduledFor?: string | null) => {
    if (status === "scheduled" && scheduledFor) {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-500"><Clock className="h-3 w-3 mr-1" />Agendado: {format(new Date(scheduledFor), "dd/MM HH:mm")}</Badge>;
    }
    return status === "published" ? <Badge>Publicado</Badge> : <Badge variant="secondary">Rascunho</Badge>;
  };

  const filteredPosts = posts?.filter((post) => post.title.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <AppLayout title="Carregando..."><div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div></AppLayout>;

  return (
    <AppLayout title="Gerenciar Blog">
      <div className="container max-w-7xl py-8">
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="text-3xl font-bold mb-2">Gerenciar Blog</h1><p className="text-muted-foreground">Com SEO automático e agendamento</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}><Tag className="h-4 w-4 mr-2" />Categorias</Button>
            <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Novo Post</Button>
          </div>
        </div>

        <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md mb-6" />

        {isLoading ? <div className="text-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div></div> : 
        filteredPosts && filteredPosts.length > 0 ? (
          <div className="grid gap-4">
            {filteredPosts.map((post) => (
              <Card key={post.id}><CardContent className="p-6"><div className="flex gap-6">{post.cover_image && <img src={post.cover_image} alt={post.title} className="w-32 h-32 object-cover rounded-lg" />}<div className="flex-1"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 mb-2"><h3 className="text-xl font-bold">{post.title}</h3>{getStatusBadge(post.status, post.scheduled_for)}{post.featured && <Badge variant="secondary" className="bg-primary/10 text-primary"><Star className="h-3 w-3 mr-1 fill-current" />Destaque</Badge>}</div><div className="flex gap-4 text-xs text-muted-foreground"><span>{post.author}</span><span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(post.created_at), "dd/MM/yyyy")}</span><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.views} views</span></div></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openDialog(post)}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => confirm("Excluir?") && deleteMutation.mutate(post.id)}><Trash2 className="h-4 w-4" /></Button></div></div></div></div></CardContent></Card>
            ))}
          </div>
        ) : <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Nenhum post</p></CardContent></Card>}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingPost ? "Editar" : "Novo"} Post</DialogTitle></DialogHeader>
            <form 
              onSubmit={handleSubmit} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="space-y-6"
            >
              <Tabs defaultValue="content"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="content">Conteúdo</TabsTrigger><TabsTrigger value="seo">SEO</TabsTrigger><TabsTrigger value="publish">Publicação</TabsTrigger></TabsList>
                <TabsContent value="content" className="space-y-4 mt-4">
                  <div><Label>Título *</Label><Input value={formData.title} onChange={(e) => { setFormData({ ...formData, title: e.target.value }); if (!editingPost) setFormData((prev) => ({ ...prev, slug: generateSlug(e.target.value) })); }} required /></div>
                  <div className="space-y-2">
                    <Label>Slug *</Label>
                    
                    {/* Preview da URL */}
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <code className="text-sm">
                        <span className="text-muted-foreground">{window.location.origin}/blog/</span>
                        <span className="text-primary font-semibold">{formData.slug || 'seu-slug-aqui'}</span>
                      </code>
                    </div>
                    
                    {/* Campo editável com validação */}
                    <div className="relative">
                      <Input 
                        value={formData.slug} 
                        onChange={(e) => {
                          setFormData({ ...formData, slug: e.target.value });
                          setSlugValidation({ status: "idle", message: "" });
                        }} 
                        required 
                        placeholder="meu-post-incrivel"
                        className={
                          slugValidation.status === "invalid" || slugValidation.status === "duplicate"
                            ? "border-destructive focus-visible:ring-destructive"
                            : slugValidation.status === "valid"
                            ? "border-green-500 focus-visible:ring-green-500"
                            : ""
                        }
                      />
                      {slugValidation.status !== "idle" && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {slugValidation.status === "checking" && (
                            <AlertCircle className="h-4 w-4 text-muted-foreground animate-pulse" />
                          )}
                          {slugValidation.status === "valid" && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {(slugValidation.status === "invalid" || slugValidation.status === "duplicate") && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Mensagens de validação */}
                    {slugValidation.message && (
                      <p className={`text-xs flex items-center gap-1 ${
                        slugValidation.status === "valid" 
                          ? "text-green-600" 
                          : slugValidation.status === "checking"
                          ? "text-muted-foreground"
                          : "text-destructive"
                      }`}>
                        {slugValidation.message}
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      O slug é gerado automaticamente do título, mas pode ser editado
                    </p>
                  </div>
                  <div>
                    <Label>Autor *</Label>
                    {authors.length === 0 ? (
                      <div className="text-sm text-destructive mt-2">
                        Nenhum administrador disponível. Certifique-se de que há usuários com role de admin.
                      </div>
                    ) : (
                      <Select value={formData.author_id} onValueChange={(value) => setFormData({ ...formData, author_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um autor" />
                        </SelectTrigger>
                        <SelectContent>
                          {authors.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div><Label>Imagem de Capa</Label><ImageUploadDragDrop currentImage={formData.cover_image} onImageUpload={(url) => setFormData({ ...formData, cover_image: url, og_image: url })} onImageRemove={() => setFormData({ ...formData, cover_image: "", og_image: "" })} onUploadStart={() => setIsUploadingImage(true)} onUploadEnd={() => setIsUploadingImage(false)} /></div>
                  <div>
                    <Label>Categorias</Label>
                    <div className="border rounded-lg p-4 space-y-2 max-h-40 overflow-y-auto">
                      {categories.map((c) => (
                        <label 
                          key={c.id} 
                          htmlFor={`category-${c.id}`}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <Checkbox 
                            id={`category-${c.id}`}
                            checked={selectedCategories.includes(c.id)} 
                            onCheckedChange={() => toggleCategory(c.id)} 
                          />
                          <span className="text-sm font-medium select-none">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div><Label>Resumo</Label><Textarea value={formData.excerpt} onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} rows={3} /></div>
                  <div><Label>Conteúdo *</Label><RichTextEditor content={formData.content} onChange={(content) => setFormData({ ...formData, content })} placeholder="Escreva o conteúdo do seu post..." /></div>
                </TabsContent>
                <TabsContent value="seo" className="space-y-4 mt-4">
                  <div className="bg-accent/10 border rounded-lg p-4 mb-4"><p className="text-sm text-muted-foreground">ℹ️ Preenchidos automaticamente se vazios</p></div>
                  <div><Label>SEO Title</Label><Input value={formData.seo_title} onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })} /></div>
                  <div><Label>Meta Description</Label><Textarea value={formData.seo_description} onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })} rows={3} /></div>
                  <div><Label>Keywords</Label><Input value={formData.seo_keywords} onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })} placeholder="palavra1, palavra2" /></div>
                </TabsContent>
                <TabsContent value="publish" className="space-y-4 mt-4">
                  <div><Label>Status *</Label><Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Rascunho</SelectItem><SelectItem value="published">Publicado</SelectItem><SelectItem value="scheduled">Agendado</SelectItem></SelectContent></Select></div>
                  {formData.status === "scheduled" && <div><Label>Data/Hora *</Label><Input type="datetime-local" value={formData.scheduled_for} onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })} required /></div>}
                  
                  {/* Featured Toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${formData.featured ? 'bg-primary/20' : 'bg-muted'}`}>
                        <Star className={`h-5 w-5 ${formData.featured ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <Label htmlFor="featured-toggle" className="text-base font-medium cursor-pointer">Post em Destaque</Label>
                        <p className="text-sm text-muted-foreground">Exibir na seção de destaques do blog</p>
                      </div>
                    </div>
                    <Checkbox 
                      id="featured-toggle"
                      checked={formData.featured} 
                      onCheckedChange={(checked) => setFormData({ ...formData, featured: !!checked })}
                      className="h-5 w-5"
                    />
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex gap-2 justify-end pt-4 border-t"><Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button><Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingPost ? "Atualizar" : "Publicar"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>

        <CreateCategoryDialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen} />
      </div>
    </AppLayout>
  );
};

export default AdminBlog;