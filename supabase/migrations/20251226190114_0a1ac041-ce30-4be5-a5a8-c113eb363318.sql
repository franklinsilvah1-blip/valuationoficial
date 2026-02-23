-- Add featured column to blog_posts table
ALTER TABLE public.blog_posts 
ADD COLUMN featured boolean NOT NULL DEFAULT false;

-- Create index for faster featured post queries
CREATE INDEX idx_blog_posts_featured ON public.blog_posts(featured) WHERE featured = true;