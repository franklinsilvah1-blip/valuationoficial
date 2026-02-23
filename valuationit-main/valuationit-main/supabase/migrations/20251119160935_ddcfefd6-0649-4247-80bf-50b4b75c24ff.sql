-- Fix search_path for security
ALTER FUNCTION generate_seo_keywords(TEXT, TEXT) SET search_path = public;
ALTER FUNCTION auto_generate_seo() SET search_path = public;