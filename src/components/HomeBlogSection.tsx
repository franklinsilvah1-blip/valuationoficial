import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import OptimizedImage from "@/components/OptimizedImage";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, ArrowRight, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string;
  published_at: string;
  views: number;
}

const HomeBlogSection = () => {
  const navigate = useNavigate();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["home-blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const handlePostClick = async (post: BlogPost) => {
    await supabase
      .from("blog_posts")
      .update({ views: post.views + 1 })
      .eq("id", post.id);

    navigate(`/blog/${post.slug}`);
  };

  if (isLoading) {
    return (
      <section className="py-12 md:py-20 bg-background">
        <div className="container">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-20 bg-background">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Blog</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Últimas do Blog
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Artigos, análises e insights sobre o mercado financeiro brasileiro
          </p>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 md:mb-10">
          {posts.map((post, index) => (
            <Card
              key={post.id}
              onClick={() => handlePostClick(post)}
              className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group cursor-pointer animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="relative h-48 overflow-hidden bg-muted">
                {post.cover_image ? (
                  <OptimizedImage
                    src={post.cover_image}
                    alt={post.title}
                    width={400}
                    height={192}
                    lazy={true}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-primary/5 to-primary/10">
                    <BookOpen className="h-12 w-12" />
                  </div>
                )}
              </div>

              <CardHeader className="pb-2">
                <h3 className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h3>
              </CardHeader>

              <CardContent className="space-y-3">
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {post.excerpt}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <time dateTime={post.published_at}>
                      {format(new Date(post.published_at), "dd MMM yyyy", {
                        locale: ptBR,
                      })}
                    </time>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link to="/blog">
            <Button variant="outline" size="lg" className="group">
              Ver Todos os Artigos
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HomeBlogSection;
