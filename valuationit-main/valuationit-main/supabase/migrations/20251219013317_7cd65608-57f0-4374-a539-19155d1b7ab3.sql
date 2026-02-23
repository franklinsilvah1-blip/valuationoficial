-- Create a public view for blog authors that excludes email
CREATE OR REPLACE VIEW public.blog_authors_public AS
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

-- Update the RLS policy on blog_authors to restrict SELECT to admins only
-- First drop the existing public policy
DROP POLICY IF EXISTS "Anyone can view authors" ON public.blog_authors;

-- Create new restrictive policy for direct table access
CREATE POLICY "Admins can view all author data" 
ON public.blog_authors 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Also allow editors to view authors (they need to select authors when creating posts)
CREATE POLICY "Editors can view authors" 
ON public.blog_authors 
FOR SELECT 
USING (has_role(auth.uid(), 'editor'));