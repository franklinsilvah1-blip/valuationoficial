-- Drop and recreate the view WITHOUT security definer
-- Views by default use SECURITY INVOKER which is what we want
DROP VIEW IF EXISTS public.blog_authors_public;

CREATE VIEW public.blog_authors_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  avatar_url,
  bio,
  created_at,
  updated_at
FROM public.blog_authors;

-- Grant select on view to public (anon and authenticated)
GRANT SELECT ON public.blog_authors_public TO anon;
GRANT SELECT ON public.blog_authors_public TO authenticated;