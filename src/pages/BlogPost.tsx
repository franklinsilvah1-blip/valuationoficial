import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "isomorphic-dompurify";
import Navbar from "@/components/Navbar";
import Breadcrumbs from "@/components/Breadcrumbs";
import Footer from "@/components/Footer";
import OptimizedImage from "@/components/OptimizedImage";
import SocialShareButtons from "@/components/SocialShareButtons";
import ReadingProgressBar from "@/components/ReadingProgressBar";
import TableOfContents from "@/components/TableOfContents";
import { FocusedReadingToggle, FocusedReadingOverlay } from "@/components/FocusedReadingMode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ArrowLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Helmet } from "react-helmet";
import { calculateReadingTime } from "@/utils/readingTime";

// Configure DOMPurify to allow safe HTML tags
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'hr'
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'target', 'rel', 'width', 'height', 'style'
];

// Only allow safe URL protocols
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string;
  blog_author_id: string | null;
  published_at: string;
  updated_at: string;
  
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  og_image: string | null;
}

interface BlogAuthor {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isFocusedMode, setIsFocusedMode] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Post não encontrado");
      return data as BlogPost;
    },
  });

  // Fetch blog author data if available
  const { data: blogAuthor } = useQuery({
    queryKey: ["blog-author", post?.blog_author_id],
    queryFn: async () => {
      if (!post?.blog_author_id) return null;
      const { data, error } = await supabase.from("blog_authors_public").select("*").eq("id", post.blog_author_id).maybeSingle();
      if (error) throw error;
      return data as BlogAuthor | null;
    },
    enabled: !!post?.blog_author_id,
  });

  // Sanitize blog content to prevent XSS attacks
  const sanitizedContent = useMemo(() => {
    if (!post?.content) return "";
    return DOMPurify.sanitize(post.content, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'], // Allow target attribute for links
    });
  }, [post?.content]);

  // Calculate estimated reading time
  const readingTime = useMemo(() => calculateReadingTime(post?.content || ""), [post?.content]);

  const { data: postCategories = [] } = useQuery({
    queryKey: ["post-categories", post?.id],
    queryFn: async () => {
      if (!post) return [];
      const { data, error } = await supabase.from("post_categories").select(`categories (id, name, slug)`).eq("post_id", post.id);
      if (error) throw error;
      return data.map((item: any) => item.categories).filter(Boolean) as Category[];
    },
    enabled: !!post,
  });

  const { data: relatedPosts = [] } = useQuery({
    queryKey: ["related-posts", post?.id],
    queryFn: async () => {
      if (!post) return [];
      const { data, error } = await supabase.from("blog_posts").select("id, title, slug, excerpt, cover_image, author, published_at").eq("status", "published").neq("id", post.id).order("published_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data as BlogPost[];
    },
    enabled: !!post,
  });


  if (isLoading) return <div className="min-h-screen bg-background"><Navbar /><div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div></div><Footer /></div>;
  if (!post) return <div className="min-h-screen bg-background"><Navbar /><div className="flex min-h-[60vh] items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-4">Artigo não encontrado</h1><Button onClick={() => navigate("/blog")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></div></div><Footer /></div>;

  const siteUrl = "https://valuationit.com.br";
  const postUrl = `${siteUrl}/blog/${post.slug}`;
  const ogImage = post.og_image || post.cover_image || `${siteUrl}/og-image.png`;
  const authorName = blogAuthor?.name || post.author;
  const authorUrl = blogAuthor ? `${siteUrl}/autor/${blogAuthor.id}` : undefined;
  const description = post.seo_description || post.excerpt || post.content.substring(0, 155).replace(/<[^>]*>/g, '');

  // Generate Article/BlogPosting JSON-LD schema
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": description,
    "image": ogImage,
    "datePublished": post.published_at,
    "dateModified": post.updated_at || post.published_at,
    "url": postUrl,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": postUrl
    },
    "author": {
      "@type": "Person",
      "name": authorName,
      ...(authorUrl && { "url": authorUrl }),
      ...(blogAuthor?.avatar_url && { "image": blogAuthor.avatar_url })
    },
    "publisher": {
      "@type": "Organization",
      "name": "VALUATION Invest Tech",
      "url": siteUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/logo.webp`
      }
    },
    ...(post.seo_keywords && post.seo_keywords.length > 0 && { "keywords": post.seo_keywords.join(", ") }),
    ...(postCategories.length > 0 && { "articleSection": postCategories.map(c => c.name).join(", ") }),
    "inLanguage": "pt-BR",
    "wordCount": post.content.replace(/<[^>]*>/g, '').split(/\s+/).length
  };

  // Breadcrumb items for visual component and schema
  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
    { name: post.title },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgressBar />
      <Helmet>
        <title>{post.seo_title || post.title} | Blog VALUATION</title>
        <meta name="description" content={description} />
        {post.seo_keywords && <meta name="keywords" content={post.seo_keywords.join(", ")} />}
        <link rel="canonical" href={postUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={postUrl} />
        <meta property="og:title" content={post.seo_title || post.title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="VALUATION Invest Tech" />
        <meta property="article:published_time" content={post.published_at} />
        <meta property="article:modified_time" content={post.updated_at || post.published_at} />
        <meta property="article:author" content={authorName} />
        {postCategories.map(c => (
          <meta key={c.id} property="article:tag" content={c.name} />
        ))}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@valuationinvest" />
        <meta name="twitter:url" content={postUrl} />
        <meta name="twitter:title" content={post.seo_title || post.title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
      </Helmet>

      <Navbar />
      <main className="container max-w-4xl py-12 px-4">
        <Breadcrumbs items={breadcrumbItems} className="mb-4" />
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate("/blog")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
          <FocusedReadingToggle onClick={() => setIsFocusedMode(true)} />
        </div>
        <article>
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>
            <div className="flex flex-wrap gap-4 text-muted-foreground mb-6">
              <div className="flex items-center gap-2"><User className="h-4 w-4" /><span>{post.author}</span></div>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><time dateTime={post.published_at}>{format(new Date(post.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</time></div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><span>{readingTime} min de leitura</span></div>
            </div>
            {postCategories.length > 0 && <div className="flex flex-wrap gap-2 mb-6">{postCategories.map((c) => <Badge key={c.id} variant="secondary" className="cursor-pointer" onClick={() => navigate(`/blog/categoria/${c.slug}`)}>{c.name}</Badge>)}</div>}
            {post.cover_image && <div className="rounded-xl overflow-hidden mb-8 shadow-lg"><OptimizedImage src={post.cover_image} alt={post.title} priority={true} width={1200} height={630} className="w-full h-auto" /></div>}
          </header>
          <TableOfContents content={post.content} />
          <div 
            className="prose prose-lg max-w-none dark:prose-invert 
                       prose-headings:font-bold prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
                       prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-strong:font-bold prose-em:italic
                       prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                       prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                       prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
                       prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6
                       prose-li:mb-2
                       prose-img:rounded-lg prose-img:shadow-md prose-img:my-6
                       prose-table:border-collapse prose-table:w-full prose-table:my-6
                       prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-th:text-left
                       prose-td:border prose-td:border-border prose-td:p-2
                       mb-12" 
            dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
          />

          <div className="border-t pt-8 mt-8">
            <SocialShareButtons 
              url={postUrl} 
              title={post.title} 
              description={description} 
            />
          </div>
        </article>

        {relatedPosts.length > 0 && (
          <section className="mt-16 pt-16 border-t">
            <h2 className="text-3xl font-bold mb-8">Artigos Relacionados</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedPosts.map((rp) => (
                <Card key={rp.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/blog/${rp.slug}`)}>
                  {rp.cover_image && <div className="aspect-video overflow-hidden rounded-t-lg"><OptimizedImage src={rp.cover_image} alt={rp.title} lazy={true} width={400} height={225} className="w-full h-full object-cover" /></div>}
                  <CardContent className="p-4">
                    <h3 className="font-bold mb-2 line-clamp-2">{rp.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{rp.excerpt}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground"><span>{rp.author}</span><span>•</span><span>{format(new Date(rp.published_at), "dd/MM/yyyy")}</span></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />

      {/* Focused Reading Mode Overlay */}
      <FocusedReadingOverlay 
        isActive={isFocusedMode} 
        onClose={() => setIsFocusedMode(false)}
      >
        <article className="focused-reading-content">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">{post.title}</h1>
          <div className="flex flex-wrap gap-4 text-muted-foreground mb-8">
            <div className="flex items-center gap-2"><User className="h-4 w-4" /><span>{post.author}</span></div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><time dateTime={post.published_at}>{format(new Date(post.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</time></div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><span>{readingTime} min de leitura</span></div>
          </div>
          <div 
            className="prose prose-lg max-w-none dark:prose-invert 
                       prose-headings:font-bold prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
                       prose-p:text-lg prose-p:leading-loose prose-p:mb-6
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-strong:font-bold prose-em:italic
                       prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                       prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                       prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
                       prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6
                       prose-li:mb-2
                       prose-img:rounded-lg prose-img:shadow-md prose-img:my-8
                       prose-table:border-collapse prose-table:w-full prose-table:my-6
                       prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-th:text-left
                       prose-td:border prose-td:border-border prose-td:p-2" 
            dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
          />
        </article>
      </FocusedReadingOverlay>
    </div>
  );
};

export default BlogPost;