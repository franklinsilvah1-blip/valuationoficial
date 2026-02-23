import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Eye, Clock, Plus, Edit, Calendar, TrendingUp, FileText } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

const EditorDashboard = () => {
  // Stats gerais do blog
  const { data: blogStats } = useQuery({
    queryKey: ["editor-blog-stats"],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from("blog_posts")
        .select("id, status, views, created_at, scheduled_for");

      if (error) throw error;

      const total = posts?.length || 0;
      const published = posts?.filter(p => p.status === "published").length || 0;
      const drafts = posts?.filter(p => p.status === "draft").length || 0;
      const scheduled = posts?.filter(p => p.status === "scheduled").length || 0;
      const totalViews = posts?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;

      return { total, published, drafts, scheduled, totalViews };
    },
  });

  // Posts recentes
  const { data: recentPosts, isLoading: loadingRecent } = useQuery({
    queryKey: ["editor-recent-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, status, views, created_at, scheduled_for, cover_image")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Posts agendados
  const { data: scheduledPosts } = useQuery({
    queryKey: ["editor-scheduled-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, scheduled_for, cover_image")
        .eq("status", "scheduled")
        .order("scheduled_for", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Posts mais visualizados
  const { data: topPosts } = useQuery({
    queryKey: ["editor-top-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, views, cover_image")
        .eq("status", "published")
        .order("views", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Categorias
  const { data: categories } = useQuery({
    queryKey: ["editor-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name");

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string, scheduledFor?: string | null) => {
    if (status === "scheduled" && scheduledFor) {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Agendado
        </Badge>
      );
    }
    if (status === "published") {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Publicado</Badge>;
    }
    return <Badge variant="secondary">Rascunho</Badge>;
  };

  return (
    <AppLayout title="Painel do Editor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Painel do Editor</h1>
            <p className="text-muted-foreground">Gerencie o conteúdo do blog</p>
          </div>
          <Button asChild>
            <Link to="/app/admin/blog">
              <Plus className="h-4 w-4 mr-2" />
              Novo Post
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blogStats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {blogStats?.drafts || 0} rascunhos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Publicados</CardTitle>
              <Newspaper className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blogStats?.published || 0}</div>
              <p className="text-xs text-muted-foreground">
                Posts ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agendados</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blogStats?.scheduled || 0}</div>
              <p className="text-xs text-muted-foreground">
                Publicação futura
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {blogStats?.totalViews?.toLocaleString('pt-BR') || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Visualizações totais
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Posts Recentes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Posts Recentes</CardTitle>
                <CardDescription>Últimos posts criados</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/app/admin/blog">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRecent ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : recentPosts && recentPosts.length > 0 ? (
                <div className="space-y-4">
                  {recentPosts.map((post) => (
                    <div key={post.id} className="flex items-center gap-4">
                      {post.cover_image ? (
                        <img
                          src={post.cover_image}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                          <Newspaper className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(post.status, post.scheduled_for)}
                        <Button variant="ghost" size="icon" asChild>
                          <Link to="/app/admin/blog">
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum post ainda
                </p>
              )}
            </CardContent>
          </Card>

          {/* Posts Mais Visualizados */}
          <Card>
            <CardHeader>
              <CardTitle>Mais Visualizados</CardTitle>
              <CardDescription>Posts com mais acessos</CardDescription>
            </CardHeader>
            <CardContent>
              {topPosts && topPosts.length > 0 ? (
                <div className="space-y-4">
                  {topPosts.map((post, index) => (
                    <div key={post.id} className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{post.title}</p>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {post.views?.toLocaleString('pt-BR') || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum post publicado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Posts Agendados */}
          <Card>
            <CardHeader>
              <CardTitle>Agenda de Publicação</CardTitle>
              <CardDescription>Próximos posts a serem publicados</CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledPosts && scheduledPosts.length > 0 ? (
                <div className="space-y-4">
                  {scheduledPosts.map((post) => (
                    <div key={post.id} className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {post.scheduled_for && format(new Date(post.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum post agendado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Categorias */}
          <Card>
            <CardHeader>
              <CardTitle>Categorias</CardTitle>
              <CardDescription>Organize seu conteúdo</CardDescription>
            </CardHeader>
            <CardContent>
              {categories && categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Badge key={category.id} variant="outline" className="px-3 py-1">
                      {category.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma categoria
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <Link to="/app/admin/blog">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Novo Post
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/admin/emails">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Gerenciar Emails
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/blog" target="_blank">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Blog Público
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default EditorDashboard;
