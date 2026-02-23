-- Step 1: Add new enum value for scheduled posts
ALTER TYPE blog_status ADD VALUE IF NOT EXISTS 'scheduled';

-- Add SEO fields and scheduled posts functionality to blog_posts
ALTER TABLE blog_posts 
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT[],
ADD COLUMN IF NOT EXISTS og_image TEXT,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;

-- Create blog_authors table
CREATE TABLE IF NOT EXISTS blog_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on blog_authors
ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blog_authors
CREATE POLICY "Anyone can view authors"
  ON blog_authors FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage authors"
  ON blog_authors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add foreign key from blog_posts to blog_authors
ALTER TABLE blog_posts 
ADD COLUMN IF NOT EXISTS blog_author_id UUID REFERENCES blog_authors(id) ON DELETE SET NULL;

-- Insert default authors from existing posts
INSERT INTO blog_authors (name, email)
SELECT DISTINCT author, author AS email
FROM blog_posts
WHERE author IS NOT NULL
ON CONFLICT DO NOTHING;