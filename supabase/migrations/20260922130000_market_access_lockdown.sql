-- ============================================================================
-- FASE B (FECHAMENTO) — elimina todo caminho anônimo para a base completa
-- ============================================================================
-- >>> SÓ APLIQUE DEPOIS DE:
--       1. ter aplicado a FASE A (20260922120000_market_access_matrix.sql);
--       2. ter publicado o frontend novo;
--       3. ter confirmado que o frontend novo usa get_public_market_assets
--          (aba Network: POST /rest/v1/rpc/get_public_market_assets na home
--          e em /mercado) e que /app/mercado e /app/carteira funcionam.
--
-- Aplicar esta fase ANTES do frontend novo quebra a home do frontend antigo
-- (ela lê assets_market_view como anon). O preflight abaixo não tem como
-- detectar isso sozinho — é responsabilidade do operador seguir a ordem.
--
-- REVERSÃO: o bloco comentado no fim do arquivo é um rollback FUNCIONAL, não
-- simétrico. Ele restaura o que o FRONTEND ANTIGO precisa para voltar a
-- funcionar — e só isso. Deliberadamente NÃO reabre os helpers internos nem o
-- acesso anônimo a asset_highlights, porque reabri-los não restaura nenhuma
-- funcionalidade e só devolveria superfície de ataque. A lista exata do que é
-- e do que não é restaurado está no rodapé.
--
-- Roda numa transação explícita. GRANT, REVOKE, DROP POLICY, CREATE POLICY e
-- blocos DO são todos transacionais no PostgreSQL — se algo falhar, ROLLBACK
-- automático e nenhum privilégio fica meio-alterado.
--
-- ----------------------------------------------------------------------------
-- O QUE ESTAVA ABERTO (medido em produção com o anon key, somente leitura)
-- ----------------------------------------------------------------------------
--   GET /rest/v1/assets?select=id                -> 206, Content-Range 0-0/619
--   GET /rest/v1/assets_market_view?select=id    -> 206, Content-Range 0-0/619
--   GET /rest/v1/asset_analyses_gated?select=id  -> 206, Content-Range 0-0/619
--   GET /rest/v1/assets?select=codigo_b3&offset=600&limit=3
--                                                -> AZUL3, BGIP3, BAAX39
--   POST /rest/v1/rpc/get_public_assets {"p_search":"AALR3"}
--                                                -> devolve AALR3 (ROI 2026
--                                                   = -37.62, muito fora do
--                                                   Top 20)
--   POST /rest/v1/rpc/get_public_assets {"p_search":"PET"}
--                                                -> 7 ativos, a maioria fora
--                                                   do Top 20
--
-- Ou seja: mesmo com a FASE A aplicada, o visitante anônimo ainda teria 4
-- caminhos para enumerar os 619 ativos. Esta fase fecha os 4.
--
--   asset_analyses já estava fechado por RLS (0 linhas para anon) — aqui o
--   GRANT de anon/PUBLIC também é removido, por defesa em profundidade.
--
-- ----------------------------------------------------------------------------
-- PRIVILÉGIO HERDADO DE PUBLIC
-- ----------------------------------------------------------------------------
-- Um papel pode ter privilégio EFETIVO por três caminhos: GRANT nominal para
-- ele, GRANT para PUBLIC, ou membership em outro papel que tenha o privilégio.
-- Revogar só de `anon` fecha apenas o primeiro. Por isso, para TODA relação de
-- mercado, esta fase revoga de PUBLIC e de anon, e só então reconcede
-- explicitamente o mínimo necessário a `authenticated`.
--
-- E a verificação final (seção 6) não usa information_schema.role_table_grants
-- como prova — ela usa has_table_privilege(), que é o privilégio efetivo. A
-- inspeção de grants continua lá, mas só como diagnóstico.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. PREFLIGHT — aborta se a FASE A não estiver aplicada. Sem ela, revogar
--    estes privilégios deixaria o visitante anônimo SEM NENHUMA fonte de
--    dados (a RPC nova não existiria) e a home/mercado ficariam vazias.
-- ----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_top_count integer;
BEGIN
  IF to_regprocedure('public.top_assets_year(integer)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.top_assets_year(integer)');
  END IF;
  IF to_regprocedure('public.get_public_market_assets(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.get_public_market_assets(text)');
  END IF;
  IF to_regprocedure('public.current_user_market_level()') IS NULL THEN
    v_missing := array_append(v_missing, 'public.current_user_market_level()');
  END IF;
  IF to_regprocedure('public.can_view_asset_premium(text, text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.can_view_asset_premium(text, text)');
  END IF;
  IF to_regprocedure('public.normalize_asset_profile(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'public.normalize_asset_profile(text)');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION E'PREFLIGHT FALHOU — FASE B abortada, nenhum privilégio alterado.\nAplique antes a FASE A (20260922120000_market_access_matrix.sql).\nFaltando:\n  - %',
      array_to_string(v_missing, E'\n  - ');
  END IF;

  -- RLS PRECISA estar ativa nas tabelas cruas. Uma policy sem RLS habilitada
  -- não protege nada: o PostgreSQL simplesmente ignora as policies quando
  -- relrowsecurity é false.
  --
  -- Em asset_analyses a RLS é a ÚNICA barreira entre um usuário autenticado
  -- comum (START) e os 5 campos premium sem máscara — ver seção 3. Se ela
  -- estiver desligada, fechar o acesso anônimo daria uma falsa sensação de
  -- segurança enquanto qualquer usuário logado leria os valores crus.
  -- Checamos pg_class.relrowsecurity, não a existência de policies.
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.asset_analyses'::regclass) THEN
    RAISE EXCEPTION 'PREFLIGHT FALHOU — FASE B abortada. RLS está DESABILITADA em public.asset_analyses. Sem ela, qualquer usuário autenticado lê os 5 campos premium crus e o mascaramento da view não vale nada. Habilite com: ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.assets'::regclass) THEN
    RAISE EXCEPTION 'PREFLIGHT FALHOU — FASE B abortada. RLS está DESABILITADA em public.assets; a policy restritiva criada nesta migration seria ignorada. Habilite com: ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;';
  END IF;

  -- A RPC pública precisa estar devolvendo dados ANTES de fecharmos os
  -- caminhos antigos — senão trocaríamos um vazamento por uma página vazia.
  SELECT count(*) INTO v_top_count FROM public.get_public_market_assets(NULL);

  IF v_top_count = 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FALHOU — FASE B abortada. get_public_market_assets(NULL) devolveu 0 linhas; fechar os acessos agora deixaria a home e o /mercado sem dados. Verifique se existem ativos com is_active = true e ROI 2026 legível.';
  END IF;

  RAISE NOTICE 'PREFLIGHT OK — FASE A presente, Top 20 devolvendo % linhas.', v_top_count;
END
$preflight$;

-- ----------------------------------------------------------------------------
-- 1. Views mascaradas: anon perde o acesso direto.
--    `authenticated` MANTÉM — é assim que /app/mercado, /app/carteira e o
--    simulador leem os dados, já mascarados por linha pela FASE A.
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.asset_analyses_gated FROM PUBLIC;
REVOKE ALL ON public.asset_analyses_gated FROM anon;
GRANT SELECT ON public.asset_analyses_gated TO authenticated;

REVOKE ALL ON public.assets_market_view FROM PUBLIC;
REVOKE ALL ON public.assets_market_view FROM anon;
GRANT SELECT ON public.assets_market_view TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. public.assets: o caminho mais direto de enumeração, e o que a revisão
--    anterior tinha deixado passar.
--
--    A tabela tem RLS ativa, mas com a policy "Anyone can view assets"
--    (FOR SELECT USING (true), sem cláusula TO) — permissiva para TODOS os
--    papéis, inclusive anon. Somada ao GRANT default do Supabase, dava os 619
--    registros com offset livre.
--
--    Dois cadeados independentes, porque GRANT e RLS são checagens separadas:
--      (a) a policy passa a valer só para `authenticated`;
--      (b) o GRANT de anon é revogado.
--
--    Consumidores verificados de public.assets — nenhum é anônimo:
--      - frontend: AdminAssetHighlightsPanel, Admin, AdminSync, Dashboard
--        (todas sob /app/*, autenticadas);
--      - Edge Functions sync-google-sheets e process-sync-queue: usam
--        SUPABASE_SERVICE_ROLE_KEY, que ignora RLS e GRANT;
--      - generate-sitemap: não consulta assets (só blog_posts/categories);
--      - as RPCs públicas: SECURITY DEFINER, rodam como owner.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view assets" ON public.assets;
-- DROP da própria policy nova também, para a migration ser reaplicável.
DROP POLICY IF EXISTS "Authenticated users can view assets" ON public.assets;
CREATE POLICY "Authenticated users can view assets"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (true);

-- PUBLIC vem ANTES de anon, e o GRANT explícito vem DEPOIS dos dois.
--
-- Por que revogar de PUBLIC: privilégio concedido a PUBLIC é efetivo para
-- TODOS os papéis, inclusive anon, mesmo sem nenhum GRANT nominal para anon.
-- `information_schema.role_table_grants WHERE grantee='anon'` não mostra esse
-- caso — por isso a verificação final (seção 6) usa has_table_privilege(),
-- que considera PUBLIC e membership de papel.
--
-- Por que re-conceder a authenticated logo em seguida: se o privilégio de
-- leitura de `authenticated` vier (no todo ou em parte) de PUBLIC, revogar
-- PUBLIC o derrubaria junto e quebraria /app/mercado, /app/carteira e o
-- painel administrativo. O GRANT explícito abaixo torna o resultado
-- determinístico, independentemente de como o privilégio estava antes.
-- SELECT apenas — escrita em `assets` é só do service_role (sync da planilha)
-- e do admin (via policy "Admins can manage assets").
--
-- AUDITORIA DOS CONSUMIDORES (grep exaustivo por .from("assets") no projeto):
--   SELECT  -> AdminAssetHighlightsPanel.tsx:81, Admin.tsx:119,
--              AdminSync.tsx:22, Dashboard.tsx:24
--   DELETE  -> AdminSync.tsx:567  (botão "Limpar Banco": apaga asset_analyses
--              e depois assets, direto do NAVEGADOR, como `authenticated`)
--   INSERT  -> nenhum no frontend
--   UPDATE  -> nenhum no frontend
--   UPSERT  -> nenhum no frontend
--   (as escritas do sync da planilha são das Edge Functions, com
--    SUPABASE_SERVICE_ROLE_KEY, que não passa por estes GRANTs)
--
-- Por isso o GRANT abaixo é SELECT **e DELETE** — não é DML por precaução, é
-- o conjunto exato que tem consumidor provado. INSERT e UPDATE ficam de fora.
-- Quem controla QUEM pode deletar continua sendo a RLS: a policy
-- "Admins can manage assets" (FOR ALL USING has_role(auth.uid(),'admin')),
-- que esta migration não toca. Um usuário START com DELETE no GRANT não
-- apaga nada, porque nenhuma linha satisfaz a policy para ele.
REVOKE ALL ON public.assets FROM PUBLIC;
REVOKE ALL ON public.assets FROM anon;
GRANT SELECT, DELETE ON public.assets TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. public.asset_analyses (tabela CRUA — a que guarda os valores premium
--    sem máscara nenhuma).
--
--    ATENÇÃO — aqui a RLS é LOAD-BEARING e o GRANT de `authenticated` NÃO
--    pode ser removido:
--
--    No Supabase, um administrador do produto continua sendo o papel Postgres
--    `authenticated` (a condição de admin é uma LINHA em user_roles, lida por
--    has_role(), não um papel de banco). E o painel administrativo lê esta
--    tabela crua direto do navegador — src/pages/app/AdminDebug.tsx e
--    src/pages/app/AdminSync.tsx. Revogar `authenticated` aqui quebraria o
--    Admin.
--
--    Então o que impede um usuário START de ler os valores crus NÃO é o
--    GRANT: é a RLS. Desde 20260415120000 a única policy que sobrou em
--    asset_analyses é "Admins can manage analyses" (FOR ALL USING
--    has_role(auth.uid(),'admin')). Para qualquer não-admin — inclusive
--    START, PRO, SPECIALIST e WEALTH — o USING avalia false e a tabela
--    devolve ZERO linhas. Para anon, has_role(NULL,'admin') também é false.
--
--    Consequência: se a RLS desta tabela for desabilitada, o mascaramento
--    inteiro deixa de valer (qualquer autenticado leria os 5 campos crus). Por
--    isso o preflight (seção 0) ABORTA se relrowsecurity estiver false aqui.
--
--    O que SIM é feito abaixo: remover o acesso de anon e de PUBLIC, para que
--    o visitante anônimo receba "permission denied" em vez de depender de a
--    policy estar correta — dois cadeados para ele, um só (RLS) para o
--    autenticado não-admin.
-- ----------------------------------------------------------------------------
--
-- AUDITORIA DOS CONSUMIDORES (grep exaustivo por .from("asset_analyses")):
--   SELECT  -> AdminDebug.tsx:148,195,199,219, AdminSync.tsx:23
--   DELETE  -> AdminSync.tsx:560 (mesmo botão "Limpar Banco")
--   INSERT/UPDATE/UPSERT -> nenhum no frontend (só Edge Functions,
--                           via service_role)
REVOKE ALL ON public.asset_analyses FROM PUBLIC;
REVOKE ALL ON public.asset_analyses FROM anon;
-- `authenticated` é re-concedido explicitamente pelo mesmo motivo de `assets`:
-- se o privilégio vinha de PUBLIC, o REVOKE acima o teria derrubado e o painel
-- administrativo pararia. Só SELECT e DELETE — o conjunto com consumidor
-- provado. A RLS continua sendo quem filtra as linhas.
GRANT SELECT, DELETE ON public.asset_analyses TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. get_public_assets(text) — a RPC da rodada anterior.
--
--    Ela consulta public.assets diretamente nos ramos de busca e devolve
--    QUALQUER ativo da base por código exato, nome exato ou LIKE parcial
--    (comprovado em produção com "AALR3" e "PET"). É SECURITY DEFINER, então
--    revogar a tabela não a afeta: continuaria sendo um caminho de enumeração.
--
--    Aqui ela perde o acesso anônimo. Não é removida (DROP) para não quebrar
--    um cliente antigo em cache que ainda a chame — ele passa a receber 401 em
--    vez de dados, que é o comportamento correto, e o frontend novo não a usa
--    mais. `authenticated` mantém o acesso: um usuário logado já pode ver a
--    lista completa de ativos por direito (plano START em diante), então a
--    função não é um caminho de escalada para ele — as colunas premium que ela
--    devolve continuam mascaradas pela view, agora pela matriz da FASE A.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_public_assets(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_assets(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_assets(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Superfície mínima: anon perde EXECUTE em tudo que ele não chama.
--
--    Levantamento do que o frontend realmente chama via supabase.rpc():
--      get_public_market_assets, get_sales_whatsapp_number,
--      request_affiliate_activation (afiliados, fora do escopo de mercado).
--    Nenhuma outra função de mercado é chamada do cliente.
--
--    As funções abaixo são usadas apenas DENTRO das views (security_invoker =
--    false, executam como owner) e das RPCs SECURITY DEFINER — nenhuma delas
--    precisa de EXECUTE para o papel anon. Revogar reduz a superfície sem
--    efeito funcional.
--
--    normalize_asset_profile e safe_parse_numeric são puras (não tocam no
--    banco) e só estavam acessíveis por causa do EXECUTE default do
--    PostgreSQL para PUBLIC em toda função nova.
-- ----------------------------------------------------------------------------
--    >>> CUIDADO DOCUMENTADO — uma VIEW NÃO faz proxy de privilégio de FUNÇÃO.
--
--    Uma view com security_invoker = false empresta ao consultante o
--    privilégio do dono **apenas para as TABELAS** do corpo. As FUNÇÕES
--    chamadas nas expressões continuam sendo checadas contra o papel que
--    consulta. `asset_analyses_gated` chama, por linha,
--    can_view_asset_premium(text,text), que por sua vez chama
--    normalize_asset_profile(text).
--
--    Ou seja: se `normalize_asset_profile` for revogada de PUBLIC sem GRANT
--    explícito para `authenticated`, TODO usuário logado passa a receber
--    "permission denied for function normalize_asset_profile" ao abrir
--    /app/mercado e /app/carteira. Isso foi encontrado pela suíte
--    supabase/tests/04, não por leitura de código.
--
--    Por isso a ordem aqui é: revoga de PUBLIC/anon e **reconcede o mínimo a
--    authenticated**. A verificação final (seção 6) assegura isso.
REVOKE ALL ON FUNCTION public.current_user_market_level() FROM anon;
REVOKE ALL ON FUNCTION public.current_user_has_full_market_access() FROM anon;
REVOKE ALL ON FUNCTION public.can_view_asset_premium(text) FROM anon;
REVOKE ALL ON FUNCTION public.can_view_asset_premium(text, text) FROM anon;

REVOKE ALL ON FUNCTION public.normalize_asset_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_asset_profile(text) FROM anon;
-- Necessária para `authenticated` LER assets_market_view / asset_analyses_gated.
GRANT EXECUTE ON FUNCTION public.normalize_asset_profile(text) TO authenticated;

REVOKE ALL ON FUNCTION public.safe_parse_numeric(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.safe_parse_numeric(text) FROM anon;
--
-- >>> QUEM ESCREVE EM asset_analyses PRECISA DESTA FUNÇÃO. <<<
--
-- A FASE A cria um índice de expressão
-- `asset_analyses (public.safe_parse_numeric(roi2026) DESC)`. O PostgreSQL
-- avalia essa expressão a CADA INSERT/UPDATE da tabela, e checa o privilégio
-- de EXECUTE contra o papel que está escrevendo. Sem o GRANT, a escrita falha
-- com "permission denied for function safe_parse_numeric".
--
-- O papel crítico aqui é `service_role`: é ele que as Edge Functions
-- sync-google-sheets e process-sync-queue usam para gravar a planilha. Sem
-- este GRANT, a SINCRONIZAÇÃO INTEIRA PARA — e silenciosamente, já que só
-- falharia na próxima execução do cron. Descoberto pela suíte 04, executando
-- um UPDATE real como service_role depois da FASE B.
--
-- `authenticated` também recebe: o painel Admin apaga linhas dessa tabela
-- (AdminSync "Limpar Banco") e qualquer caminho de escrita futuro passaria
-- pelo mesmo índice.
GRANT EXECUTE ON FUNCTION public.safe_parse_numeric(text) TO authenticated;
DO $svc$
BEGIN
  IF to_regrole('service_role') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.safe_parse_numeric(text) TO service_role';
  END IF;
END
$svc$;

-- asset_highlights: curadoria manual que a home deixou de usar nesta rodada.
-- Só o painel administrativo (autenticado) a consulta. Para anon ela não tem
-- mais nenhuma função e expõe UUIDs de ativos — sai da superfície pública.
--
-- Condicional de propósito: esta tabela NÃO é essencial para o objetivo de
-- segurança desta migration, então a ausência dela não deve abortar a fase
-- inteira (ela foi criada na migration anterior, mas o histórico local e o
-- remoto divergem — não se pode assumir). Um REVOKE direto numa tabela
-- inexistente derrubaria a transação; este bloco apenas pula.
DO $highlights$
BEGIN
  IF to_regclass('public.asset_highlights') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.asset_highlights FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON public.asset_highlights FROM anon';
    -- Re-concedido explicitamente: o painel administrativo lê e escreve nesta
    -- tabela como `authenticated` (a RLS "Admins can manage highlights" é que
    -- restringe a escrita a admin).
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_highlights TO authenticated';
    RAISE NOTICE 'asset_highlights: PUBLIC e anon revogados, authenticated preservado.';
  ELSE
    RAISE NOTICE 'asset_highlights não existe neste banco — nada a revogar.';
  END IF;
END
$highlights$;

-- ----------------------------------------------------------------------------
-- 6. Verificação final DENTRO da transação. Se qualquer invariante de
--    segurança não valer, tudo é revertido.
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE
  v_leaks text[] := ARRAY[]::text[];
  v_diag text[] := ARRAY[]::text[];
  v_rel text;
  v_priv text;
  v_fn text;
  v_admin_ok boolean;
  r record;
BEGIN
  -- ==========================================================================
  -- INVARIANTE DE SEGURANÇA: PRIVILÉGIO EFETIVO, não GRANT nominal.
  --
  -- has_table_privilege() responde "este papel CONSEGUE?", levando em conta
  -- GRANT direto, privilégio herdado de PUBLIC e membership de papel.
  -- information_schema.role_table_grants responde só "existe um GRANT escrito
  -- com grantee='anon'?" — não enxerga PUBLIC nem herança, e por isso não
  -- serve como prova. A inspeção de grants fica abaixo, mas apenas como
  -- diagnóstico; quem decide abortar é has_table_privilege.
  -- ==========================================================================
  FOREACH v_rel IN ARRAY ARRAY['public.assets',
                               'public.asset_analyses',
                               'public.assets_market_view',
                               'public.asset_analyses_gated']
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    LOOP
      IF has_table_privilege('anon', v_rel, v_priv) THEN
        v_leaks := array_append(v_leaks,
          format('anon TEM privilégio EFETIVO %s em %s', v_priv, v_rel));
      END IF;
    END LOOP;
  END LOOP;

  -- asset_highlights só entra na checagem se existir neste banco.
  IF to_regclass('public.asset_highlights') IS NOT NULL THEN
    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    LOOP
      IF has_table_privilege('anon', 'public.asset_highlights', v_priv) THEN
        v_leaks := array_append(v_leaks,
          format('anon TEM privilégio EFETIVO %s em public.asset_highlights', v_priv));
      END IF;
    END LOOP;
  END IF;

  -- Diagnóstico (não decide nada): quais GRANTs nominais ainda existem, para
  -- quem, nessas relações. Ajuda a achar a origem se algo acima falhar.
  FOR r IN
    SELECT grantee, table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('assets', 'asset_analyses', 'assets_market_view',
                         'asset_analyses_gated', 'asset_highlights')
      AND grantee IN ('anon', 'PUBLIC')
  LOOP
    v_diag := array_append(v_diag, format('%s: %s em %s', r.grantee, r.privilege_type, r.table_name));
  END LOOP;

  IF array_length(v_diag, 1) > 0 THEN
    RAISE NOTICE 'Diagnóstico — GRANTs nominais remanescentes para anon/PUBLIC: %',
      array_to_string(v_diag, '; ');
  END IF;

  -- ==========================================================================
  -- SUPERFÍCIE DE FUNÇÕES DO anon — a tabela COMPLETA declarada no relatório.
  -- Exatamente uma função executável; todos os helpers internos fechados.
  -- ==========================================================================
  FOREACH v_fn IN ARRAY ARRAY[
    'public.get_public_assets(text)',
    'public.top_assets_year(integer)',
    'public.current_user_market_level()',
    'public.current_user_has_full_market_access()',
    'public.can_view_asset_premium(text)',
    'public.can_view_asset_premium(text, text)',
    'public.normalize_asset_profile(text)',
    'public.safe_parse_numeric(text)'
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      v_leaks := array_append(v_leaks,
        format('anon ainda executa %s — helper interno não deve ser público', v_fn));
    END IF;
  END LOOP;

  -- ...mas PRECISA continuar executando a porta de entrada legítima.
  IF NOT has_function_privilege('anon', 'public.get_public_market_assets(text)', 'EXECUTE') THEN
    v_leaks := array_append(v_leaks, 'anon PERDEU get_public_market_assets(text) — home e /mercado ficariam vazias');
  END IF;

  -- ==========================================================================
  -- SEGURANÇA DO search_path DAS FUNÇÕES SECURITY DEFINER.
  --
  -- Elas rodam com o privilégio do dono. Isso só é seguro se um usuário não
  -- confiável não puder criar objetos nos schemas do search_path delas. Se
  -- anon ou authenticated tivesse CREATE em `public`, poderia plantar objetos
  -- para sequestrar referências e escalar privilégio.
  --
  -- Todas as referências nas funções são schema-qualificadas (public.*,
  -- auth.uid()), e o search_path delas termina em pg_temp — mas esta asserção
  -- é o cinto de segurança que torna a premissa verificável, não presumida.
  -- ==========================================================================
  IF has_schema_privilege('anon', 'public', 'CREATE') THEN
    v_leaks := array_append(v_leaks, 'anon tem CREATE no schema public — SECURITY DEFINER com search_path=public deixa de ser seguro');
  END IF;
  IF has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    v_leaks := array_append(v_leaks, 'authenticated tem CREATE no schema public — SECURITY DEFINER com search_path=public deixa de ser seguro');
  END IF;

  RAISE NOTICE 'Schema public — anon: CREATE=% USAGE=% | authenticated: CREATE=% USAGE=%',
    has_schema_privilege('anon', 'public', 'CREATE'),
    has_schema_privilege('anon', 'public', 'USAGE'),
    has_schema_privilege('authenticated', 'public', 'CREATE'),
    has_schema_privilege('authenticated', 'public', 'USAGE');

  -- ==========================================================================
  -- CONTRAPARTIDA: revogar PUBLIC não pode ter derrubado ninguém legítimo.
  -- Se o privilégio de authenticated ou de service_role viesse de PUBLIC, o
  -- REVOKE o teria levado junto. Estas asserções transformam esse risco em
  -- ROLLBACK automático, em vez de um incidente em produção.
  -- ==========================================================================

  -- /app/mercado, /app/carteira e o simulador.
  IF NOT has_table_privilege('authenticated', 'public.assets_market_view', 'SELECT') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu SELECT em assets_market_view');
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.asset_analyses_gated', 'SELECT') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu SELECT em asset_analyses_gated');
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.assets', 'SELECT') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu SELECT em assets');
  END IF;

  -- Painel administrativo: AdminDebug/AdminSync leem asset_analyses CRU do
  -- navegador, como papel `authenticated` (admin é linha em user_roles, não
  -- papel de banco). Sem este privilégio o Admin quebra — a RLS é que filtra.
  IF NOT has_table_privilege('authenticated', 'public.asset_analyses', 'SELECT') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu SELECT em asset_analyses — o painel Admin (AdminDebug/AdminSync) pararia');
  END IF;

  -- FUNÇÕES usadas DENTRO das views. Uma view não faz proxy de privilégio de
  -- função (só de tabela): sem EXECUTE, o usuário logado recebe "permission
  -- denied for function" ao abrir /app/mercado. Esta é a asserção que teria
  -- pegado o defeito que a suíte 04 encontrou.
  IF NOT has_function_privilege('authenticated', 'public.normalize_asset_profile(text)', 'EXECUTE') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu EXECUTE em normalize_asset_profile(text) — assets_market_view falharia para todo usuário logado');
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.can_view_asset_premium(text, text)', 'EXECUTE') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu EXECUTE em can_view_asset_premium(text,text) — assets_market_view falharia');
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.current_user_market_level()', 'EXECUTE') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu EXECUTE em current_user_market_level() — assets_market_view falharia');
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.safe_parse_numeric(text)', 'EXECUTE') THEN
    v_leaks := array_append(v_leaks, 'authenticated perdeu EXECUTE em safe_parse_numeric(text) — a escrita do Admin em asset_analyses falharia pelo índice de expressão');
  END IF;

  -- Sync da planilha (Edge Functions sync-google-sheets / process-sync-queue).
  IF to_regrole('service_role') IS NOT NULL THEN
    IF NOT has_table_privilege('service_role', 'public.assets', 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.assets', 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.assets', 'UPDATE') THEN
      v_leaks := array_append(v_leaks, 'service_role perdeu privilégio em assets — o sync da planilha pararia');
    END IF;
    IF NOT has_table_privilege('service_role', 'public.asset_analyses', 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.asset_analyses', 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.asset_analyses', 'UPDATE') THEN
      v_leaks := array_append(v_leaks, 'service_role perdeu privilégio em asset_analyses — o sync da planilha pararia');
    END IF;
    -- Índice de expressão: sem EXECUTE, todo INSERT/UPDATE em asset_analyses
    -- falha e a sincronização da planilha para.
    IF NOT has_function_privilege('service_role', 'public.safe_parse_numeric(text)', 'EXECUTE') THEN
      v_leaks := array_append(v_leaks, 'service_role perdeu EXECUTE em safe_parse_numeric(text) — o índice de expressão bloquearia toda escrita do sync da planilha');
    END IF;
  END IF;

  -- A RLS das tabelas cruas continua ativa depois de tudo (é ela que barra o
  -- usuário START em asset_analyses).
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.asset_analyses'::regclass) THEN
    v_leaks := array_append(v_leaks, 'RLS ficou DESABILITADA em asset_analyses');
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.assets'::regclass) THEN
    v_leaks := array_append(v_leaks, 'RLS ficou DESABILITADA em assets');
  END IF;

  -- ==========================================================================
  -- WHITELIST DE POLICIES — LEITURA **E** ESCRITA.
  --
  -- Depois desta fase, `authenticated` tem DELETE no GRANT de `assets` e de
  -- `asset_analyses` (o botão "Limpar Banco" do AdminSync precisa). Ou seja:
  -- o GRANT autoriza a OPERAÇÃO para todo usuário logado, e quem decide QUAIS
  -- LINHAS ele alcança é exclusivamente a RLS. Isso põe a escrita no mesmo
  -- patamar de criticidade da leitura.
  --
  -- Checar apenas `qual = 'true'`, ou apenas cmd SELECT/ALL, seria ingênuo:
  --   * USING (auth.uid() IS NOT NULL)  libera para QUALQUER usuário logado;
  --   * FOR DELETE TO authenticated USING (true) não apareceria num filtro
  --     que só olha SELECT/ALL — e permitiria um START apagar a base.
  -- Como o histórico local e o remoto divergem, nada disso é presumido.
  --
  -- REGRA: em `assets`, `asset_analyses` e `asset_highlights`, toda policy
  -- PERMISSIVE que alcance PUBLIC / anon / authenticated PRECISA ter o teste
  -- administrativo (`has_role(..., 'admin')`) em TODAS as expressões que
  -- possui — `USING` (linhas existentes) e `WITH_CHECK` (estado novo, que é
  -- o que vale para INSERT e para o resultado de UPDATE). Qualquer outra
  -- aborta a FASE B com ROLLBACK.
  --
  -- Exceções deliberadas:
  --   * policies RESTRICTIVE — só restringem, nunca concedem;
  --   * policies limitadas a papéis de serviço (service_role, postgres,
  --     supabase_admin) — não alcançáveis por usuário final;
  --   * em `assets`, a policy de SELECT criada por esta própria migration
  --     ("Authenticated users can view assets", USING true, TO authenticated):
  --     é legítima e documentada — todo usuário logado PODE listar os ativos;
  --     o que ele não pode é ler os campos premium (mascarados na view) nem
  --     escrever. Por isso a exceção vale só para cmd = 'SELECT' nessa tabela.
  -- ==========================================================================
  FOR r IN
    SELECT tablename, policyname, permissive, roles::text AS roles, cmd,
           coalesce(qual, '') AS qual, coalesce(with_check, '') AS with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('assets', 'asset_analyses', 'asset_highlights')
      AND permissive = 'PERMISSIVE'
      AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (
        roles::text[] && ARRAY['public', 'anon', 'authenticated']
        OR roles::text = '{0}'   -- {0} = PUBLIC (policy sem cláusula TO)
      )
  LOOP
    -- Exceção nominal: leitura de `assets` é liberada a todo autenticado.
    CONTINUE WHEN r.tablename = 'assets'
             AND r.cmd = 'SELECT'
             AND r.policyname = 'Authenticated users can view assets';

    -- O teste de admin precisa estar presente em CADA expressão existente.
    -- Casamento por padrão (e não por texto exato) porque o pg_policies
    -- normaliza a expressão de formas diferentes conforme a versão do
    -- PostgreSQL e o cast do enum app_role.
    v_admin_ok := true;

    IF r.qual <> '' AND NOT (r.qual ILIKE '%has_role%' AND r.qual ILIKE '%admin%') THEN
      v_admin_ok := false;
    END IF;

    -- WITH CHECK governa INSERT e o novo estado do UPDATE. Uma policy com
    -- USING administrativo e WITH CHECK permissivo ainda deixaria um
    -- não-admin gravar linhas — por isso as duas expressões são exigidas.
    IF r.with_check <> '' AND NOT (r.with_check ILIKE '%has_role%' AND r.with_check ILIKE '%admin%') THEN
      v_admin_ok := false;
    END IF;

    -- Policy sem NENHUMA expressão (qual e with_check vazios) é permissiva
    -- por omissão — trata como vazamento.
    IF r.qual = '' AND r.with_check = '' THEN
      v_admin_ok := false;
    END IF;

    IF NOT v_admin_ok THEN
      v_leaks := array_append(v_leaks, format(
        'policy PERMISSIVE sem teste de admin em %I: %L (cmd=%s, roles=%s, using=%s, with_check=%s) — um usuário autenticado não-admin poderia %s',
        r.tablename, r.policyname, r.cmd, r.roles,
        coalesce(nullif(r.qual, ''), '(nenhum)'),
        coalesce(nullif(r.with_check, ''), '(nenhum)'),
        CASE WHEN r.cmd = 'SELECT' THEN 'ler os dados crus'
             ELSE 'alterar ou apagar dados' END));
    END IF;
  END LOOP;

  -- Registra no log TODAS as policies da tabela, para auditoria humana do
  -- estado real do banco no momento da aplicação.
  FOR r IN
    SELECT tablename, policyname, permissive, roles::text AS roles, cmd,
           coalesce(qual, '(null)') AS qual, coalesce(with_check, '(null)') AS with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('assets', 'asset_analyses', 'asset_highlights')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE 'policy % | nome=% | permissive=% | roles=% | cmd=% | qual=% | with_check=%',
      r.tablename, r.policyname, r.permissive, r.roles, r.cmd, r.qual, r.with_check;
  END LOOP;

  IF array_length(v_leaks, 1) > 0 THEN
    RAISE EXCEPTION E'VERIFICAÇÃO FALHOU — FASE B revertida (ROLLBACK).\n  - %',
      array_to_string(v_leaks, E'\n  - ');
  END IF;

  RAISE NOTICE 'VERIFICAÇÃO OK — nenhum caminho anônimo para a base completa.';
END
$verify$;

COMMIT;

-- ============================================================================
-- ROLLBACK FUNCIONAL DA FASE B
-- ============================================================================
-- Escopo: devolver ao frontend ANTIGO as leituras de que ele dependia, caso
-- seja preciso voltar atrás depois de aplicar esta fase.
--
-- RESTAURA:
--   - SELECT anônimo em assets, asset_analyses, assets_market_view,
--     asset_analyses_gated (a home antiga lia assets_market_view como anon);
--   - EXECUTE anônimo em get_public_assets(text) (a /mercado antiga a usava);
--   - a policy permissiva original de public.assets.
--
-- NÃO RESTAURA, de propósito (nada no frontend, antigo ou novo, usa):
--   - SELECT anônimo em asset_highlights;
--   - EXECUTE anônimo em current_user_market_level(),
--     current_user_has_full_market_access(), can_view_asset_premium(text),
--     can_view_asset_premium(text,text), normalize_asset_profile(text),
--     safe_parse_numeric(text);
--   - o privilégio que PUBLIC tinha em assets / asset_analyses /
--     asset_highlights. O acesso volta por GRANT nominal a anon, que é
--     equivalente na prática e auditável.
--
-- Os GRANTs explícitos para authenticated criados pela FASE B são mantidos:
-- são os mesmos privilégios que o app já usava, agora nominais em vez de
-- herdados. Removê-los é que quebraria o app.
--
-- Para reverter também a FASE A, basta reexecutar a migration anterior
-- (20260415120000), que recria asset_analyses_gated na forma antiga. As
-- funções novas podem ficar: sem GRANT para anon, elas são inertes.
-- ============================================================================
-- BEGIN;
--   GRANT SELECT ON public.asset_analyses_gated TO anon;
--   GRANT SELECT ON public.assets_market_view   TO anon;
--   GRANT SELECT ON public.assets               TO anon;
--   GRANT SELECT ON public.asset_analyses       TO anon;
--   GRANT EXECUTE ON FUNCTION public.get_public_assets(text) TO anon;
--   DROP POLICY IF EXISTS "Authenticated users can view assets" ON public.assets;
--   DROP POLICY IF EXISTS "Anyone can view assets" ON public.assets;
--   CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);
-- COMMIT;
-- ============================================================================
