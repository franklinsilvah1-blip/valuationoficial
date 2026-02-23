-- Create index for scheduled posts (now that enum value is committed)
CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled ON blog_posts(scheduled_for) WHERE status = 'scheduled';

-- Function to generate SEO keywords from text
CREATE OR REPLACE FUNCTION generate_seo_keywords(title TEXT, content TEXT)
RETURNS TEXT[] AS $$
DECLARE
  keywords TEXT[];
  combined_text TEXT;
BEGIN
  -- Combine title and first 500 chars of content
  combined_text := LOWER(title || ' ' || SUBSTRING(content, 1, 500));
  
  -- Remove common words and extract meaningful keywords
  keywords := ARRAY(
    SELECT DISTINCT word 
    FROM regexp_split_to_table(combined_text, '\s+') AS word
    WHERE LENGTH(word) > 4
      AND word !~ '^(https?|www|com|org|que|para|com|uma|seu|sua|mais|muito|sobre|como|quando|onde|porque|este|essa|isso|sido|sera|foi|tem|tinha|pode|fazer|todos|todas|cada|outro|outra|outros|outras|mesmo|mesma|algo|alguem|nada|ninguem|tudo|todo|toda|qualquer|qual|quais|algum|alguma|alguns|algumas|nenhum|nenhuma|apenas|somente|tambem|ainda|porem|contudo|entanto|portanto|assim|agora|depois|antes|durante|desde|ate|sempre|nunca|talvez)$'
    LIMIT 10
  );
  
  RETURN keywords;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate SEO fields if not provided
CREATE OR REPLACE FUNCTION auto_generate_seo()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate seo_title if not provided
  IF NEW.seo_title IS NULL OR NEW.seo_title = '' THEN
    NEW.seo_title := NEW.title;
  END IF;
  
  -- Auto-generate seo_description if not provided
  IF NEW.seo_description IS NULL OR NEW.seo_description = '' THEN
    NEW.seo_description := SUBSTRING(REGEXP_REPLACE(NEW.content, '<[^>]+>', '', 'g'), 1, 155);
  END IF;
  
  -- Auto-generate seo_keywords if not provided
  IF NEW.seo_keywords IS NULL OR array_length(NEW.seo_keywords, 1) IS NULL THEN
    NEW.seo_keywords := generate_seo_keywords(NEW.title, NEW.content);
  END IF;
  
  -- Auto-set og_image from cover_image if not provided
  IF NEW.og_image IS NULL OR NEW.og_image = '' THEN
    NEW.og_image := NEW.cover_image;
  END IF;
  
  -- Handle scheduled posts
  IF NEW.scheduled_for IS NOT NULL AND NEW.scheduled_for > NOW() THEN
    NEW.status := 'scheduled'::blog_status;
    NEW.published_at := NULL;
  ELSIF NEW.status = 'published'::blog_status AND NEW.published_at IS NULL THEN
    NEW.published_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_generate_seo ON blog_posts;
CREATE TRIGGER trigger_auto_generate_seo
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_seo();

-- Update existing posts with SEO data
UPDATE blog_posts 
SET 
  seo_title = title,
  seo_description = SUBSTRING(REGEXP_REPLACE(content, '<[^>]+>', '', 'g'), 1, 155),
  seo_keywords = generate_seo_keywords(title, content),
  og_image = cover_image
WHERE seo_title IS NULL;