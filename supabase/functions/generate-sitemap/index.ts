import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = 'https://valuationit.com.br';

// Static routes with their priorities and change frequencies
const staticRoutes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/mercado', priority: '0.9', changefreq: 'daily' },
  { path: '/assinatura', priority: '0.9', changefreq: 'weekly' },
  { path: '/consultoria', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog', priority: '0.8', changefreq: 'daily' },
  { path: '/sobre', priority: '0.6', changefreq: 'monthly' },
  { path: '/contato', priority: '0.6', changefreq: 'monthly' },
  { path: '/politica-privacidade', priority: '0.3', changefreq: 'yearly' },
  { path: '/politica-cookies', priority: '0.3', changefreq: 'yearly' },
];

function formatDate(date: string | null): string {
  if (!date) return new Date().toISOString().split('T')[0];
  return new Date(date).toISOString().split('T')[0];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Generating dynamic sitemap...');

    // Fetch published blog posts
    const { data: posts, error: postsError } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (postsError) {
      console.error('Error fetching posts:', postsError);
    }

    // Fetch categories with their latest post date
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('slug, created_at');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
    }

    // For each category, get the latest post date
    const categoryDates: Record<string, string> = {};
    if (categories && posts) {
      // Get post categories to map
      const { data: postCategories } = await supabase
        .from('post_categories')
        .select('category_id, post_id');

      if (postCategories) {
        const postMap = new Map(posts.map(p => [p.slug, p]));
        
        // Get all post IDs for each category
        for (const category of categories) {
          const categoryPostIds = postCategories
            .filter(pc => pc.category_id === category.slug)
            .map(pc => pc.post_id);
          
          // Find latest post date for this category
          const categoryPosts = posts.filter((_, index) => {
            const postId = posts[index];
            return postCategories.some(pc => 
              pc.category_id === category.slug
            );
          });
          
          if (categoryPosts.length > 0) {
            const latestDate = categoryPosts
              .map(p => p.updated_at || p.published_at)
              .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
            categoryDates[category.slug] = latestDate || category.created_at;
          } else {
            categoryDates[category.slug] = category.created_at;
          }
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];

    // Build XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static routes
    for (const route of staticRoutes) {
      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}${route.path}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Add blog posts
    if (posts && posts.length > 0) {
      for (const post of posts) {
        xml += '  <url>\n';
        xml += `    <loc>${SITE_URL}/blog/${escapeXml(post.slug)}</loc>\n`;
        xml += `    <lastmod>${formatDate(post.updated_at || post.published_at)}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      }
    }

    // Add categories
    if (categories && categories.length > 0) {
      for (const category of categories) {
        const lastmod = categoryDates[category.slug] || category.created_at;
        xml += '  <url>\n';
        xml += `    <loc>${SITE_URL}/blog/categoria/${escapeXml(category.slug)}</loc>\n`;
        xml += `    <lastmod>${formatDate(lastmod)}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.6</priority>\n';
        xml += '  </url>\n';
      }
    }

    xml += '</urlset>';

    console.log(`Sitemap generated: ${staticRoutes.length} static routes, ${posts?.length || 0} posts, ${categories?.length || 0} categories`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1 hour cache
      },
    });

  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate sitemap' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
