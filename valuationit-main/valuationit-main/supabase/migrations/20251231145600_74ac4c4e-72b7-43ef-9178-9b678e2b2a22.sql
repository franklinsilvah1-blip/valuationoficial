-- Create table for exclusive video content
CREATE TABLE public.exclusive_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  youtube_id TEXT NOT NULL,
  order_num INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.exclusive_videos ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view active videos
CREATE POLICY "Authenticated users can view active videos"
ON public.exclusive_videos
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admins can view all videos
CREATE POLICY "Admins can view all videos"
ON public.exclusive_videos
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can manage videos
CREATE POLICY "Admins can manage videos"
ON public.exclusive_videos
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_exclusive_videos_updated_at
  BEFORE UPDATE ON public.exclusive_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert initial videos
INSERT INTO public.exclusive_videos (title, description, youtube_id, order_num) VALUES
  ('Vídeo Aula 01', 'Primeira aula do curso - Introdução', 'ppiu3YqyMMU', 1),
  ('Vídeo Aula 02', 'Segunda aula do curso - Conceitos fundamentais', 'wZpU3vDOGuk', 2);