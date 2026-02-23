-- Criar tabela de logs de visualizações/consultas de ativos
CREATE TABLE IF NOT EXISTS public.asset_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX idx_asset_views_user_id ON public.asset_views(user_id);
CREATE INDEX idx_asset_views_asset_id ON public.asset_views(asset_id);
CREATE INDEX idx_asset_views_viewed_at ON public.asset_views(viewed_at);

-- Habilitar RLS
ALTER TABLE public.asset_views ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own asset views"
  ON public.asset_views
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own asset views"
  ON public.asset_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all asset views"
  ON public.asset_views
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));