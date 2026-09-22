-- ============================================================================
-- FASE A (ADITIVA) — matriz de acesso ao Mercado por plano × PERFIL do ativo
-- ============================================================================
-- Continuação de 20260415120000_plan_model_v2.sql. NÃO edita nenhuma migration
-- anterior. Não altera schema de tabela, não cria tabela, não apaga dados.
--
-- >>> ESTA FASE NÃO FECHA NENHUM CAMINHO DE LEITURA EXISTENTE. <<<
--
-- Precisão operacional (o arquivo CONTÉM comandos REVOKE, então não é correto
-- chamá-lo de "zero REVOKE"):
--
--   - NÃO há REVOKE em NENHUMA tabela ou view. Todo GRANT de tabela/view que
--     existe hoje continua existindo depois desta fase. É por isso que o
--     frontend ANTIGO em produção continua funcionando (segue lendo
--     assets_market_view como anon).
--
--   - HÁ REVOKE de EXECUTE em funções, sempre no padrão
--     `REVOKE ALL ... FROM PUBLIC` seguido de
--     `GRANT EXECUTE ... TO anon, authenticated`. O objetivo é trocar o
--     EXECUTE default e implícito de PUBLIC por concessões nominais e
--     auditáveis — não retirar acesso de ninguém.
--
--     Auditoria dos consumidores dessas funções (grep no projeto inteiro):
--       * Edge Functions: nenhuma as chama (confirmado — as funções de sync
--         leem `assets`/`asset_analyses` crus com service_role);
--       * triggers e outras funções do banco: nenhuma as referencia;
--       * views (asset_analyses_gated/assets_market_view): são
--         security_invoker = false, então executam como o DONO;
--       * RPCs públicas: SECURITY DEFINER, também executam como o dono;
--       * o dono da função (postgres) nunca perde EXECUTE por REVOKE de
--         PUBLIC.
--     Ou seja: nenhum consumidor técnico — service_role, postgres, trigger ou
--     Edge Function — perde EXECUTE efetivo aqui.
--
--     `current_user_has_full_market_access()` já estava nesse exato estado
--     desde 20260415120000 (REVOKE de PUBLIC + GRANT nominal); esta fase
--     apenas o reaplica.
--
-- O fechamento dos caminhos de enumeração anônima está na FASE B
-- (20260922130000_market_access_lockdown.sql), que só deve ser aplicada DEPOIS
-- que o frontend novo estiver publicado e validado.
--
-- ORDEM OBRIGATÓRIA:
--   1. aplicar esta migration (FASE A)
--   2. publicar o frontend novo
--   3. validar que o frontend novo usa get_public_market_assets
--   4. aplicar a FASE B
--
-- SEARCH_PATH DAS FUNÇÕES SECURITY DEFINER
-- ----------------------------------------------------------------------------
-- Todas usam `SET search_path TO 'public', 'pg_temp'`. Três razões:
--
--   1. `pg_temp` explícito NO FIM. Quando pg_temp não aparece no search_path,
--      o PostgreSQL o pesquisa ANTES de tudo para RELAÇÕES. Qualquer usuário
--      logado pode criar tabelas temporárias, então deixá-lo implícito é
--      deixar uma janela de shadowing aberta. Citá-lo por último força a
--      ordem contrária.
--   2. `pg_catalog` não precisa ser citado: ele é pesquisado implicitamente
--      antes de tudo, a menos que seja posicionado de outra forma. Funções
--      como btrim/upper/now resolvem lá e não podem ser sequestradas.
--   3. Toda referência a objeto do projeto é schema-qualificada
--      (public.profiles, public.has_role, auth.uid(), ...), de modo que o
--      search_path não decide nada de fato — é defesa em profundidade.
--
-- A premissa que sustenta confiar no schema `public` é que usuários não
-- confiáveis não possam criar objetos nele. Isso NÃO é presumido: a FASE B
-- ABORTA se anon ou authenticated tiver CREATE em `public`.
--
-- Toda a migration roda numa transação explícita (BEGIN/COMMIT). Todos os
-- comandos usados aqui são transacionais no PostgreSQL: CREATE FUNCTION,
-- CREATE OR REPLACE VIEW, ALTER VIEW, GRANT/REVOKE, CREATE INDEX (não-
-- CONCURRENTLY) e blocos DO. Não há nenhum comando não-transacional — em
-- particular, NÃO se usa CREATE INDEX CONCURRENTLY, justamente porque ele não
-- pode rodar dentro de transação. Se qualquer statement falhar, o ROLLBACK é
-- automático e o banco fica exatamente como estava.
--
-- ----------------------------------------------------------------------------
-- MATRIZ (5 campos da regra nova do cliente)
-- ----------------------------------------------------------------------------
--                      | ativo perfil START | perfil PRO | perfil SPECIALIST
--   -------------------+--------------------+------------+-------------------
--   anônimo            |      bloqueado     | bloqueado  |    bloqueado
--   START              |      bloqueado     | bloqueado  |    bloqueado
--   PRO                |      LIBERADO      | LIBERADO   |    bloqueado
--   SPECIALIST/WEALTH  |      LIBERADO      | LIBERADO   |    LIBERADO
--   admin              |      LIBERADO      | LIBERADO   |    LIBERADO
--
--   ROI TRIM (R)       -> asset_analyses.taxa_semanal
--   ROI TRIM (T)       -> asset_analyses.roitrim
--   CARTEIRA TRIM      -> asset_analyses.carteira
--   RECOMENDAÇÃO TRIM  -> asset_analyses.recomendacao
--   NOTA ESPECIALISTA  -> asset_analyses.nota_especialista
--
-- ----------------------------------------------------------------------------
-- TENDÊNCIA TRIM — FORA DA MATRIZ, DE PROPÓSITO
-- ----------------------------------------------------------------------------
-- `tendencia` NÃO entra na matriz acima. Ela mantém EXATAMENTE a regra que já
-- valia antes desta migration (20260415120000, seção 6):
--     visível para PRO / SPECIALIST / WEALTH / admin, em QUALQUER ativo;
--     bloqueada para anônimo e START.
--
-- Motivo: a lista de 5 campos que o cliente pediu para bloquear ao PRO em
-- ativos SPECIALIST não inclui TENDÊNCIA TRIM. Colocá-la na matriz tiraria do
-- assinante PRO a tendência de 588 dos 607 ativos ativos (os de perfil
-- SPECIALIST) — uma perda de benefício que o cliente não pediu e que
-- contradiz a própria página de planos, onde "Tendência TRIM" está listada
-- como benefício do PRO (src/utils/planHelpers.ts, getPlanInfo('PRO')).
-- Regra de negócio não solicitada não muda.
--
-- ----------------------------------------------------------------------------
-- AUDITORIA DE PRODUÇÃO (requisições anônimas reais, somente leitura)
-- ----------------------------------------------------------------------------
--   - 619 ativos, 607 com is_active = true;
--   - asset_analyses.perfil_investidor é TEXTO LIVRE da coluna "PERFIL DO
--     ATIVO" da planilha (sem enum/FK/normalização no sync). Valores reais:
--     'START' (19), 'PRO' (12), 'SPECIALIST' (588), zero nulos. Por isso a
--     comparação NUNCA usa '= PRO' literal: passa por normalize_asset_profile.
--   - roi2026 é TEXTO com ponto decimal ('105.71', '-15.11', '0').
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. PREFLIGHT — aborta ANTES de qualquer alteração se faltar dependência.
--
--    Existe divergência conhecida entre o histórico local de migrations e o
--    remoto (21 versões remotas sem arquivo local), então não se pode assumir
--    que tudo que está no diretório local existe no banco. Este bloco falha
--    alto e cedo, dentro da transação, sem ter mexido em nada.
-- ----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_cols text;
  v_expected text :=
    'id,asset_id,valor,roi2026,roi2025,roi2024,roitrim,dy2025,fator_mc,'
    || 'roi2023a2025,perfil_investidor,taxa_semanal,resumo,tendencia,carteira,'
    || 'recomendacao,nota_especialista,updated_at';
BEGIN
  -- --------------------------------------------------------------------------
  -- PREMISSA DE SEGURANÇA DAS FUNÇÕES SECURITY DEFINER, verificada ANTES de
  -- criar qualquer uma delas.
  --
  -- Esta migration cria funções SECURITY DEFINER com
  -- `SET search_path TO 'public', 'pg_temp'`. Isso só é seguro se um usuário
  -- não confiável NÃO puder criar objetos em `public` — caso contrário ele
  -- poderia plantar objetos para sequestrar referências e escalar privilégio.
  --
  -- A checagem vem aqui, no início do preflight, e não só na FASE B: seria
  -- incoerente instalar as funções e só depois provar a premissa que elas
  -- documentam. A FASE B repete a verificação como defesa em profundidade.
  -- --------------------------------------------------------------------------
  IF has_schema_privilege('anon', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'PREFLIGHT FALHOU — migration abortada, nada foi alterado. O papel `anon` tem CREATE no schema public. Funções SECURITY DEFINER com search_path=public deixam de ser seguras nessa condição. Corrija com: REVOKE CREATE ON SCHEMA public FROM anon;';
  END IF;

  IF has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'PREFLIGHT FALHOU — migration abortada, nada foi alterado. O papel `authenticated` tem CREATE no schema public. Funções SECURITY DEFINER com search_path=public deixam de ser seguras nessa condição. Corrija com: REVOKE CREATE ON SCHEMA public FROM authenticated;';
  END IF;

  -- Tabelas e views obrigatórias
  IF to_regclass('public.assets') IS NULL THEN
    v_missing := array_append(v_missing, 'tabela public.assets');
  END IF;
  IF to_regclass('public.asset_analyses') IS NULL THEN
    v_missing := array_append(v_missing, 'tabela public.asset_analyses');
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'tabela public.profiles');
  END IF;
  IF to_regclass('public.asset_analyses_gated') IS NULL THEN
    v_missing := array_append(v_missing, 'view public.asset_analyses_gated (aplique 20260415120000 antes)');
  END IF;
  IF to_regclass('public.assets_market_view') IS NULL THEN
    v_missing := array_append(v_missing, 'view public.assets_market_view (aplique 20260415120000 antes)');
  END IF;

  -- Funções obrigatórias herdadas da migration anterior
  IF to_regprocedure('public.has_role(uuid, app_role)') IS NULL THEN
    v_missing := array_append(v_missing, 'função public.has_role(uuid, app_role)');
  END IF;
  IF to_regprocedure('public.normalize_plan_code(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'função public.normalize_plan_code(text)');
  END IF;
  IF to_regprocedure('public.safe_parse_timestamptz(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'função public.safe_parse_timestamptz(text)');
  END IF;

  -- Colunas obrigatórias de asset_analyses (o mascaramento depende delas)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='asset_analyses'
                   AND column_name='perfil_investidor') THEN
    v_missing := array_append(v_missing, 'coluna asset_analyses.perfil_investidor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='asset_analyses'
                   AND column_name='taxa_semanal') THEN
    v_missing := array_append(v_missing, 'coluna asset_analyses.taxa_semanal');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION E'PREFLIGHT FALHOU — migration abortada, nada foi alterado.\nDependências ausentes: %',
      array_to_string(v_missing, E'\n  - ');
  END IF;

  -- CREATE OR REPLACE VIEW exige nomes/tipos/ordem de colunas IDÊNTICOS.
  -- Se a view remota divergir do esperado, o REPLACE falharia no meio; melhor
  -- abortar aqui com uma mensagem que diz exatamente o que fazer.
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'asset_analyses_gated';

  IF v_cols IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION E'PREFLIGHT FALHOU — migration abortada, nada foi alterado.\nA view public.asset_analyses_gated tem ordem/nomes de coluna diferentes do esperado.\n  esperado: %\n  atual:    %\nResolva com DROP VIEW ... CASCADE + recriação manual antes de reaplicar.',
      v_expected, v_cols;
  END IF;

  RAISE NOTICE 'PREFLIGHT OK — todas as dependências presentes.';
END
$preflight$;

-- ----------------------------------------------------------------------------
-- 1. Normalização do PERFIL DO ATIVO (eixo "coluna" da matriz).
--    Tolerante a casing/espaços/variações da planilha. FAIL-SAFE: qualquer
--    valor desconhecido, vazio ou nulo vira 'SPECIALIST' — o perfil MAIS
--    restritivo. Um perfil ilegível jamais libera dado premium.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_asset_profile(p_profile text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_profile IS NULL OR btrim(p_profile) = '' THEN 'SPECIALIST'
    WHEN upper(btrim(p_profile)) LIKE '%SPECIALIST%'   THEN 'SPECIALIST'
    WHEN upper(btrim(p_profile)) LIKE '%ESPECIALISTA%' THEN 'SPECIALIST'
    WHEN upper(btrim(p_profile)) = 'PRO'               THEN 'PRO'
    WHEN upper(btrim(p_profile)) LIKE 'PRO %'          THEN 'PRO'
    WHEN upper(btrim(p_profile)) = 'START'             THEN 'START'
    WHEN upper(btrim(p_profile)) LIKE 'START %'        THEN 'START'
    WHEN upper(btrim(p_profile)) = 'FREE'              THEN 'START'
    ELSE 'SPECIALIST'
  END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Parsing numérico seguro para os ROI, que são `text` no schema real.
--    Nunca lança erro (vazio/malformado/'-'/'1.2.3' -> NULL), para que uma
--    célula suja da planilha não derrube a query do Top 20 inteira.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_parse_numeric(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- Aceita '1.234,56' (pt-BR) e '1234.56' (formato atual do banco).
  v_clean := btrim(p_value);
  v_clean := replace(v_clean, '%', '');
  v_clean := btrim(v_clean);

  IF v_clean LIKE '%,%' THEN
    v_clean := replace(v_clean, '.', '');
    v_clean := replace(v_clean, ',', '.');
  END IF;

  v_clean := regexp_replace(v_clean, '[^0-9.\-]', '', 'g');

  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_clean::numeric;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Nível de mercado do usuário atual (eixo "linha" da matriz).
--    Retorna 'ANON' | 'START' | 'PRO' | 'FULL'.
--
--    FAIL-CLOSED POR CONSTRUÇÃO: cada nível elevado é concedido por um ramo
--    EXPLÍCITO e nomeado. Não existe catch-all que devolva 'FULL'. O ELSE
--    final, o plano nulo, o plano desconhecido, a assinatura vencida e o
--    plan_end_at ilegível TODOS caem em 'START'. Isso é defesa em
--    profundidade: mesmo que normalize_plan_code() passe a devolver um valor
--    novo no futuro, o resultado aqui é o nível mínimo, nunca acesso total.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_market_level()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_plan text;
  v_end_at_raw text;
  v_end_at timestamptz;
  v_normalized text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'ANON';
  END IF;

  -- Bypass de admin, explícito.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN 'FULL';
  END IF;

  -- Nunca confia em plano informado pelo cliente: lê profiles pelo auth.uid()
  -- da sessão (JWT validado pelo PostgREST/Supabase).
  SELECT plan::text, plan_end_at::text INTO v_plan, v_end_at_raw
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_plan IS NULL THEN
    RETURN 'START';
  END IF;

  -- Mapeia códigos legados (FREE -> START, TESTE -> PRO,
  -- FALE_C_ESPECIALISTA -> SPECIALIST) mantendo o grandfathering já aplicado.
  v_normalized := public.normalize_plan_code(v_plan);

  -- Expiração: PRO/SPECIALIST com assinatura vencida voltam a START.
  -- plan_end_at PRESENTE mas ilegível também falha fechado (anomalia de dado
  -- nunca equivale a concessão permanente). WEALTH é concessão administrativa
  -- e não expira automaticamente.
  IF v_normalized IN ('PRO', 'SPECIALIST') THEN
    v_end_at := public.safe_parse_timestamptz(v_end_at_raw);

    IF v_end_at_raw IS NOT NULL AND btrim(v_end_at_raw) <> '' AND v_end_at IS NULL THEN
      RETURN 'START';
    END IF;

    IF v_end_at IS NOT NULL AND v_end_at < now() THEN
      RETURN 'START';
    END IF;
  END IF;

  -- Concessão explícita, um ramo por plano. Sem catch-all para 'FULL'.
  IF v_normalized = 'START'      THEN RETURN 'START'; END IF;
  IF v_normalized = 'PRO'        THEN RETURN 'PRO';   END IF;
  IF v_normalized = 'SPECIALIST' THEN RETURN 'FULL';  END IF;
  IF v_normalized = 'WEALTH'     THEN RETURN 'FULL';  END IF;

  -- Qualquer coisa fora dos 4 planos canônicos: nível mínimo.
  RAISE WARNING 'current_user_market_level: plano não reconhecido (%) para o usuário %, rebaixado para START',
    v_normalized, auth.uid();
  RETURN 'START';
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_market_level() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_market_level() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3b. current_user_has_full_market_access() passa a derivar do nível, para
--     existir UMA definição da hierarquia de planos no banco. O contrato
--     público não muda (boolean, "PRO ou superior"), então nenhum consumidor
--     existente quebra — inclusive a regra de TENDÊNCIA TRIM, que continua
--     ancorada exatamente neste predicado, como antes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_has_full_market_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.current_user_market_level() IN ('PRO', 'FULL');
$$;

REVOKE ALL ON FUNCTION public.current_user_has_full_market_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_full_market_access() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. A MATRIZ. Definida UMA única vez, na versão de 2 argumentos.
--
--    A versão de 2 argumentos é IMMUTABLE e pura (não toca no banco): recebe o
--    nível já calculado. É ela que as views usam, uma vez por linha, a custo
--    desprezível.
--
--    A versão de 1 argumento é só um wrapper de conveniência que calcula o
--    nível e delega — nunca duplica a regra.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_asset_premium(p_level text, p_asset_profile text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_level
    WHEN 'FULL' THEN true
    WHEN 'PRO'  THEN public.normalize_asset_profile(p_asset_profile) IN ('START', 'PRO')
    ELSE false            -- 'START', 'ANON' e qualquer valor inesperado
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_asset_premium(p_asset_profile text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.can_view_asset_premium(public.current_user_market_level(), p_asset_profile);
$$;

REVOKE ALL ON FUNCTION public.can_view_asset_premium(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_asset_premium(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_asset_premium(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_asset_premium(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. asset_analyses_gated: mascaramento POR LINHA (depende do PERFIL do
--    próprio ativo) para os 5 campos da matriz, e mascaramento POR PLANO
--    (regra antiga, inalterada) para tendencia.
--
--    DESEMPENHO — por que `(SELECT public.current_user_market_level())`:
--    current_user_market_level() é STABLE mas consulta profiles e has_role a
--    cada chamada. Chamá-la dentro de um CASE, por coluna e por linha, daria
--    ~6 x 607 = ~3.600 avaliações por varredura completa da view. Escrita como
--    sub-SELECT escalar SEM correlação, o PostgreSQL a transforma em InitPlan,
--    que é avaliado UMA vez por execução da query e reutilizado em todas as
--    linhas — comportamento garantido, não heurística do planner. A parte
--    cara roda uma vez; o que sobra por linha é can_view_asset_premium/2, que
--    é IMMUTABLE e não toca no banco.
--
--    CREATE OR REPLACE VIEW só é permitido com nomes/tipos/ordem de coluna
--    idênticos — é o caso (o preflight já validou). Por isso
--    assets_market_view NÃO precisa ser recriada: herda o novo mascaramento.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.asset_analyses_gated AS
SELECT
  aa.id,
  aa.asset_id,
  aa.valor,
  aa.roi2026,
  aa.roi2025,
  aa.roi2024,
  -- ROI TRIM (T) — matriz
  CASE WHEN public.can_view_asset_premium((SELECT public.current_user_market_level()), aa.perfil_investidor)
       THEN aa.roitrim ELSE NULL END AS roitrim,
  aa.dy2025,
  aa.fator_mc,
  aa.roi2023a2025,
  aa.perfil_investidor,
  -- ROI TRIM (R) — matriz
  CASE WHEN public.can_view_asset_premium((SELECT public.current_user_market_level()), aa.perfil_investidor)
       THEN aa.taxa_semanal ELSE NULL END AS taxa_semanal,
  aa.resumo,
  -- TENDÊNCIA TRIM — FORA da matriz: regra antiga preservada (PRO ou superior
  -- vê em qualquer ativo, inclusive de perfil SPECIALIST). Ver cabeçalho.
  CASE WHEN (SELECT public.current_user_market_level()) IN ('PRO', 'FULL')
       THEN aa.tendencia ELSE NULL END AS tendencia,
  -- CARTEIRA TRIM — matriz
  CASE WHEN public.can_view_asset_premium((SELECT public.current_user_market_level()), aa.perfil_investidor)
       THEN aa.carteira ELSE NULL END AS carteira,
  -- RECOMENDAÇÃO TRIM — matriz
  CASE WHEN public.can_view_asset_premium((SELECT public.current_user_market_level()), aa.perfil_investidor)
       THEN aa.recomendacao ELSE NULL END AS recomendacao,
  -- NOTA ESPECIALISTA — matriz
  CASE WHEN public.can_view_asset_premium((SELECT public.current_user_market_level()), aa.perfil_investidor)
       THEN aa.nota_especialista ELSE NULL END AS nota_especialista,
  aa.updated_at
FROM public.asset_analyses aa;

-- security_invoker = false (explícito): a view roda com o privilégio de quem a
-- criou, não do papel que consulta — é isso que permite ler através dela apesar
-- da RLS restritiva de asset_analyses. Mudar para true quebra a view.
ALTER VIEW public.asset_analyses_gated SET (security_invoker = false);

-- ----------------------------------------------------------------------------
-- 6. FONTE ÚNICA do "Top 20 ativos com maior ROI 2026".
--
--    Esta função é INTERNA: REVOKE de PUBLIC e nenhum GRANT para anon/
--    authenticated. Só é alcançável de dentro das funções SECURITY DEFINER
--    abaixo (que rodam como owner). Ela existe para que o ranking tenha UMA
--    definição só, compartilhada pela home e pelo /mercado público.
--
--    Devolve `nome` além das colunas públicas, porque a busca pública precisa
--    procurar por nome — mas `nome` NUNCA é devolvido ao cliente (ver seção 7).
--
--    Ativos sem ROI 2026 legível ficam fora do ranking (NULL não vira 0).
--    Empate é desempatado por código, para o ranking ser determinístico.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.top_assets_year(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  codigo_b3 text,
  nome text,
  tipo text,
  roi2026 text,
  recomendacao text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    a.id,
    a.codigo_b3,
    a.nome,
    a.tipo::text,
    g.roi2026,
    g.recomendacao
  FROM public.assets a
  JOIN public.asset_analyses_gated g ON g.asset_id = a.id
  WHERE a.is_active = true
    AND public.safe_parse_numeric(g.roi2026) IS NOT NULL
  ORDER BY public.safe_parse_numeric(g.roi2026) DESC, a.codigo_b3 ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.top_assets_year(integer) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 7. ÚNICA porta de entrada do visitante anônimo ao Mercado.
--
--    UNIVERSO CONSULTÁVEL = OS 20 DO TOP 20. Ponto.
--    A busca opera EXCLUSIVAMENTE sobre o resultado de top_assets_year(20).
--    Nenhum ramo desta função consulta public.assets diretamente — é isso que
--    impede que um ticker existente fora do Top 20 seja alcançado por código
--    exato, nome exato ou busca parcial.
--
--    Isto corrige a falha da versão anterior desta função, em que os ramos de
--    busca consultavam `public.assets` e devolviam qualquer um dos 619 ativos
--    (limitar a resposta a 10 linhas não limitava o universo pesquisável).
--
--    Não aceita limit/offset/página/ordem do cliente. Não devolve contagem
--    total. Não devolve `nome` (usado só internamente para casar a busca).
--    `recomendacao` passa pela matriz: é NULL de verdade para quem não tem
--    direito — o valor real não entra no payload HTTP.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_market_assets(p_search text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  codigo_b3 text,
  tipo text,
  roi2026 text,
  recomendacao text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_search text;
  v_escaped text;
BEGIN
  v_search := left(btrim(coalesce(p_search, '')), 50);

  -- Sem busca: o Top 20 inteiro.
  IF v_search = '' THEN
    RETURN QUERY
      SELECT t.id, t.codigo_b3, t.tipo, t.roi2026, t.recomendacao
      FROM public.top_assets_year(20) t;
    RETURN;
  END IF;

  -- Com busca: filtra DENTRO do mesmo Top 20, nunca fora dele.
  -- Curingas de LIKE escapados para o termo do cliente ser tratado como texto
  -- literal, nunca como padrão SQL controlado por quem pesquisa.
  v_escaped := replace(v_search, '\', '\\');
  v_escaped := replace(v_escaped, '%', '\%');
  v_escaped := replace(v_escaped, '_', '\_');

  RETURN QUERY
    SELECT t.id, t.codigo_b3, t.tipo, t.roi2026, t.recomendacao
    FROM public.top_assets_year(20) t
    WHERE upper(t.codigo_b3) = upper(v_search)
       OR t.codigo_b3 ILIKE '%' || v_escaped || '%' ESCAPE '\'
       OR t.nome        ILIKE '%' || v_escaped || '%' ESCAPE '\'
    ORDER BY
      -- Match exato de código primeiro; depois a ordem do próprio ranking.
      (upper(t.codigo_b3) = upper(v_search)) DESC,
      public.safe_parse_numeric(t.roi2026) DESC,
      t.codigo_b3 ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_market_assets(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_market_assets(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Índice de apoio ao Top 20. safe_parse_numeric é IMMUTABLE, então o índice
--    de expressão é válido e evita varrer e parsear 600+ linhas a cada request
--    público. CREATE INDEX (não CONCURRENTLY) para ser transacional.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS asset_analyses_roi2026_numeric_idx
  ON public.asset_analyses (public.safe_parse_numeric(roi2026) DESC);

-- ----------------------------------------------------------------------------
-- 9. NENHUM REVOKE NESTA FASE — ver cabeçalho.
--    Continuam intactos, de propósito, até a FASE B:
--      - GRANT SELECT de anon em assets_market_view e asset_analyses_gated
--        (o frontend ANTIGO ainda os usa na home);
--      - GRANT SELECT de anon em public.assets;
--      - GRANT EXECUTE de anon em get_public_assets(text).
--    A FASE B fecha todos eles de uma vez, depois do frontend novo no ar.
-- ----------------------------------------------------------------------------

COMMIT;
