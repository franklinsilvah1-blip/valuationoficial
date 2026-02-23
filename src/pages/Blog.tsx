import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead, { createBreadcrumbSchema, createSpeakableSchema, createCollectionPageSchema, createItemListSchema } from "@/components/SEOHead";
import OptimizedImage from "@/components/OptimizedImage";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, User, Search, Tag, X, Star, Clock } from "lucide-react";
import { calculateReadingTime } from "@/utils/readingTime";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  author: string;
  published_at: string;
  featured: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const POSTS_PER_PAGE = 9;

const Blog = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const categoryFilter = searchParams.get("category");

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

  // Fetch featured posts
  const { data: featuredPosts = [] } = useQuery({
    queryKey: ["featured-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .eq("featured", true)
        .order("published_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts", categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      // Filter by category if specified
      if (categoryFilter) {
        const { data: categoryData } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", categoryFilter)
          .maybeSingle();

        if (categoryData) {
          const { data: postIds } = await supabase
            .from("post_categories")
            .select("post_id")
            .eq("category_id", categoryData.id);

          if (postIds && postIds.length > 0) {
            query = query.in(
              "id",
              postIds.map((p) => p.post_id)
            );
          } else {
            return [];
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const paginatedPosts = filteredPosts.slice(
    startIndex,
    startIndex + POSTS_PER_PAGE
  );

  const handlePostClick = (post: BlogPost) => {

    navigate(`/blog/${post.slug}`);
  };

  const handleCategoryFilter = (categorySlug: string | null) => {
    if (categorySlug) {
      setSearchParams({ category: categorySlug });
    } else {
      setSearchParams({});
    }
    setCurrentPage(1);
  };

  const selectedCategory = categories.find((c) => c.slug === categoryFilter);

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Blog", url: "https://valuationit.com.br/blog" },
  ]);

  const speakableSchema = createSpeakableSchema("https://valuationit.com.br/blog", [
    "[data-speakable='blog-title']",
    "[data-speakable='blog-description']",
    "[data-speakable='newsletter-title']",
  ]);

  const collectionPageSchema = createCollectionPageSchema(
    "Blog - Artigos e Análises sobre Investimentos",
    "Artigos, análises e insights sobre o mercado financeiro brasileiro. Dicas de investimentos, análises de ações, FIIs e estratégias para investidores.",
    "https://valuationit.com.br/blog"
  );

  // ItemList schema for blog posts
  const blogItemListSchema = paginatedPosts.length > 0
    ? createItemListSchema(
        paginatedPosts.map((post, index) => ({
          name: post.title,
          url: `https://valuationit.com.br/blog/${post.slug}`,
          position: startIndex + index + 1,
        })),
        "Artigos do Blog VALUATION"
      )
    : null;

  const jsonLdSchemas = [breadcrumbSchema, speakableSchema, collectionPageSchema, blogItemListSchema].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Blog - Artigos e Análises sobre Investimentos"
        description="Artigos, análises e insights sobre o mercado financeiro brasileiro. Dicas de investimentos, análises de ações, FIIs e estratégias para investidores."
        canonical="https://valuationit.com.br/blog"
        keywords={["blog de investimentos", "análise de mercado", "dicas de investimento", "educação financeira", "mercado financeiro"]}
        ogImage="https://valuationit.com.br/og-image.png"
        jsonLd={jsonLdSchemas}
      />
      <Navbar />

      {/* Hero */}
      <section className="gradient-hero py-16">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4" data-speakable="blog-title">
              Blog
            </h1>
            <p className="text-lg text-primary-foreground/90" data-speakable="blog-description">
              Artigos, análises e insights sobre o mercado financeiro brasileiro
            </p>
          </div>
        </div>
      </section>

      {/* Featured Posts */}
      {featuredPosts.length > 0 && !categoryFilter && !searchTerm && (
        <section className="py-12 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="container">
            <div className="flex items-center gap-2 mb-8">
              <Star className="h-5 w-5 text-primary fill-primary" />
              <h2 className="text-2xl font-bold">Destaques</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Featured Post */}
              {featuredPosts[0] && (
                <Card
                  onClick={() => handlePostClick(featuredPosts[0])}
                  className="lg:col-span-2 shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group cursor-pointer"
                >
                  <div className="grid md:grid-cols-2 h-full">
                    <div className="relative h-64 md:h-full overflow-hidden bg-muted">
                      {featuredPosts[0].cover_image ? (
                        <OptimizedImage
                          src={featuredPosts[0].cover_image}
                          alt={featuredPosts[0].title}
                          width={600}
                          height={400}
                          lazy={true}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Calendar className="h-16 w-16" />
                        </div>
                      )}
                      <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Destaque
                      </Badge>
                    </div>
                    <div className="p-6 flex flex-col justify-center">
                      <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                        {featuredPosts[0].title}
                      </h3>
                      {featuredPosts[0].excerpt && (
                        <p className="text-muted-foreground mb-4 line-clamp-3">
                          {featuredPosts[0].excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{featuredPosts[0].author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{calculateReadingTime(featuredPosts[0].content)} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <time dateTime={featuredPosts[0].published_at}>
                            {format(new Date(featuredPosts[0].published_at), "dd MMM yyyy", { locale: ptBR })}
                          </time>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Secondary Featured Posts */}
              <div className="flex flex-col gap-6">
                {featuredPosts.slice(1, 3).map((post) => (
                  <Card
                    key={post.id}
                    onClick={() => handlePostClick(post)}
                    className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group cursor-pointer flex-1"
                  >
                    <div className="flex h-full">
                      <div className="relative w-32 shrink-0 overflow-hidden bg-muted">
                        {post.cover_image ? (
                          <OptimizedImage
                            src={post.cover_image}
                            alt={post.title}
                            width={128}
                            height={160}
                            lazy={true}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Calendar className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col justify-center">
                        <Badge variant="secondary" className="w-fit mb-2 text-xs">
                          <Star className="h-2.5 w-2.5 mr-1" />
                          Destaque
                        </Badge>
                        <h3 className="font-bold group-hover:text-primary transition-colors line-clamp-2 text-sm">
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{calculateReadingTime(post.content)} min</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <time dateTime={post.published_at}>
                              {format(new Date(post.published_at), "dd MMM yyyy", { locale: ptBR })}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search Bar & Categories */}
      <section className="py-8 bg-muted/30">
        <div className="container">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar artigos..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <Button
                variant={!categoryFilter ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategoryFilter(null)}
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={categoryFilter === category.slug ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCategoryFilter(category.slug)}
                >
                  {category.name}
                </Button>
              ))}
            </div>

            {selectedCategory && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">
                  Filtrando por: {selectedCategory.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCategoryFilter(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-12">
        <div className="container">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando artigos...</p>
            </div>
          ) : paginatedPosts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {paginatedPosts.map((post) => (
                  <Card
                    key={post.id}
                    onClick={() => handlePostClick(post)}
                    className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group cursor-pointer"
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
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Calendar className="h-12 w-12" />
                        </div>
                      )}
                    </div>

                    <CardHeader>
                      <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{post.author}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{calculateReadingTime(post.content)} min</span>
                          </div>
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

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum artigo encontrado com os filtros aplicados.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4" data-speakable="newsletter-title">Receba Análises Exclusivas</h2>
            <p className="text-muted-foreground mb-6">
              Assine nossa newsletter e receba análises de mercado, recomendações e insights diretamente no seu email
            </p>
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Seu melhor email"
                className="flex-1 px-4 py-2 rounded-lg border bg-background"
              />
              <button className="px-6 py-2 gradient-cta text-accent-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity">
                Assinar
              </button>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default Blog;
