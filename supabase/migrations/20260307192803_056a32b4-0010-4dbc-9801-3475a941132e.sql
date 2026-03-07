-- Fix 1: Remove public SELECT policy from blog_authors (email exposure)
-- The blog_authors_public view already exists without the email field
DROP POLICY IF EXISTS "Anyone can view authors" ON public.blog_authors;

-- Fix 2: Restrict exclusive_videos to authenticated users only
DROP POLICY IF EXISTS "Authenticated view videos" ON public.exclusive_videos;

CREATE POLICY "Authenticated view videos"
ON public.exclusive_videos
FOR SELECT
TO authenticated
USING (true);