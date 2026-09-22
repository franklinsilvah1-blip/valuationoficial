
CREATE SCHEMA IF NOT EXISTS auth;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE TYPE app_role AS ENUM ('admin','user','editor','moderator');

-- "sessão" simulada: quem está logado agora
CREATE TABLE public._session (uid uuid);
INSERT INTO public._session VALUES (NULL);

-- SECURITY DEFINER: no Supabase real auth.uid() lê um GUC do JWT, acessível a
-- qualquer papel. O stub lê uma tabela, então precisa de SECURITY DEFINER para
-- se comportar igual depois de um SET ROLE authenticated/anon.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
  $uid$ SELECT uid FROM public._session LIMIT 1 $uid$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  plan text,
  plan_end_at text,
  is_admin boolean DEFAULT false
);

-- SECURITY DEFINER igual à função real (ver 20251029210646 / 20251114013543):
-- é o padrão Supabase para consultar papéis sem depender da RLS da tabela de
-- origem. Sem isso, o stub divergiria da produção.
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT coalesce((SELECT is_admin FROM public.profiles WHERE id=_user_id), false)
     AND _role = 'admin' $$;

-- herdadas da migration 20260415120000
CREATE FUNCTION public.safe_parse_timestamptz(p_value text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $f$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN RETURN NULL; END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $f$;

CREATE FUNCTION public.normalize_plan_code(p_plan text)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE upper(coalesce(p_plan,'START'))
    WHEN 'FREE' THEN 'START' WHEN 'TESTE' THEN 'PRO'
    WHEN 'FALE_C_ESPECIALISTA' THEN 'SPECIALIST'
    WHEN 'START' THEN 'START' WHEN 'PRO' THEN 'PRO'
    WHEN 'SPECIALIST' THEN 'SPECIALIST' WHEN 'WEALTH' THEN 'WEALTH'
    ELSE 'START' END;
$f$;

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_b3 text UNIQUE NOT NULL, nome text, tipo text, setor text,
  is_active boolean DEFAULT true
);
CREATE TABLE public.asset_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.assets(id),
  valor text, roi2026 text, roi2025 text, roi2024 text, roitrim text,
  dy2025 text, fator_mc text, roi2023a2025 text, perfil_investidor text,
  taxa_semanal text, resumo text, tendencia text, carteira text,
  recomendacao text, nota_especialista text, updated_at timestamptz DEFAULT now()
);

-- view "anterior" com a MESMA ordem de colunas de produção (o preflight confere)
CREATE VIEW public.asset_analyses_gated AS
SELECT aa.id, aa.asset_id, aa.valor, aa.roi2026, aa.roi2025, aa.roi2024,
       aa.roitrim, aa.dy2025, aa.fator_mc, aa.roi2023a2025, aa.perfil_investidor,
       aa.taxa_semanal, aa.resumo, aa.tendencia, aa.carteira, aa.recomendacao,
       aa.nota_especialista, aa.updated_at
FROM public.asset_analyses aa;

CREATE VIEW public.assets_market_view AS
SELECT a.*, g.perfil_investidor, g.recomendacao, g.tendencia,
       g.taxa_semanal AS analysis_taxa_semanal, g.roi2026, g.carteira,
       g.nota_especialista, g.valor, g.roitrim, g.roi2025, g.dy2025,
       g.roi2024, g.fator_mc, g.roi2023a2025, g.resumo
FROM public.assets a JOIN public.asset_analyses_gated g ON g.asset_id = a.id;

CREATE FUNCTION public.get_public_assets(p_search text DEFAULT NULL)
RETURNS TABLE(id uuid, codigo_b3 text) LANGUAGE sql STABLE AS $f$ SELECT a.id, a.codigo_b3 FROM public.assets a $f$;
