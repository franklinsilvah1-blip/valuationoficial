
-- Fix PII: replace email stored in name column with display name
UPDATE public.blog_authors_public
SET name = 'Franklin Silva'
WHERE name = 'franklin.silvah@gmail.com';

-- Prevent emails from being stored in the name column
ALTER TABLE public.blog_authors_public
ADD CONSTRAINT no_email_in_name
CHECK (name NOT LIKE '%@%');
