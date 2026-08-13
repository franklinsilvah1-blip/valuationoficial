-- ============================================================================
-- Migração: modelo comercial de 4 planos (START/PRO/SPECIALIST/WEALTH)
--            + proteção server-side de campos premium de asset_analyses
-- ============================================================================
-- Idempotente: pode ser reexecutada sem erro nem duplicação (o backfill de
-- grandfathering da seção 1b é protegido por um marcador em app_config —
-- ver justificativa lá; todo o resto usa CREATE OR REPLACE / IF NOT EXISTS /
-- UPDATE + INSERT ... WHERE NOT EXISTS). Não edita nenhuma migration
-- anterior. Não apaga dados nem tabelas.
--
-- app_config.key e subscription_plans.plan_code NÃO têm constraint UNIQUE
-- compatível com ON CONFLICT no schema real de produção — descoberto na
-- aplicação manual real desta migration. Por isso os dois pontos que
-- gravam nessas tabelas usam UPDATE + INSERT ... WHERE NOT EXISTS em vez de
-- ON CONFLICT, e nenhuma constraint nova foi criada só para viabilizar
-- ON CONFLICT (fora do escopo, risco desnecessário). O `ON CONFLICT (id)`
-- de handle_new_user() (seção 2) é sobre `profiles.id`, que É a chave
-- primária real — esse continua sem alteração.
--
-- APLICADA EM PRODUÇÃO: esta migration foi aplicada manualmente via SQL
-- Editor do Supabase (não via `supabase db push`) devido a uma divergência
-- pré-existente entre o histórico local de migrations e a tabela de
-- bookkeeping remota (20 entradas remotas sem arquivo local correspondente
-- — problema anterior a esta migration, não corrigido, fora de escopo).
-- Resultado real confirmado pós-aplicação: FREE 16, START 3, PRO 2,
-- SPECIALIST 1, marcador de grandfathering=1, plan_migration_v2_review=3
-- linhas — ver RELATORIO_IMPLEMENTACAO_PLANOS.md, seção "Rollout de
-- produção", para o log completo. Também validada previamente em ambiente
-- Supabase local (supabase start + db reset).
--
-- ESTRATÉGIA DE MIGRAÇÃO DE USUÁRIOS (importante — leia antes de mexer):
--
-- (a) FREE -> START é NORMALIZAÇÃO LÓGICA, não física. `profiles.plan =
--     'FREE'` nunca virou dado incorreto (era sempre o nível gratuito, antes
--     e depois desta migração), então não há necessidade nem risco em
--     convertê-lo fisicamente — `normalize_plan_code()`/`normalizePlanCode()`
--     tratam 'FREE' como 'START' em toda checagem de acesso. Reversível sem
--     reconstrução de dados.
--
-- (b) START/PRO ANTIGOS EXIGEM CONVERSÃO FÍSICA (grandfathering) — isto NÃO
--     é opcional. No sistema anterior a esta migração, o controle de acesso
--     a `asset_analyses` era binário (`plan !== 'FREE'` = acesso completo
--     aos dados — ver git history de src/utils/fieldVisibility.ts antes
--     desta mudança), ou seja:
--       - profiles.plan = 'START' (antigo) já significava "pago, acesso
--         completo aos indicadores" — o novo START é gratuito e com
--         indicadores premium bloqueados. Sem conversão, um assinante pago
--         seria rebaixado para o nível gratuito.
--       - profiles.plan = 'PRO' (antigo) já incluía benefício de
--         especialista (ver Product ID confirmado em
--         supabase/functions/_shared/planResolution.ts). O novo PRO não
--         inclui esse benefício.
--     Por isso a seção 1b converte fisicamente, uma única vez, e SOMENTE
--     para registros com EVIDÊNCIA inequívoca de terem sido um plano pago
--     deliberadamente atribuído — `plan_start_at IS NOT NULL`, e SOMENTE
--     isso (nunca promove só por o valor se chamar "START"/"PRO";
--     `stripe_customer_id` foi deliberadamente EXCLUÍDO do critério — ver
--     justificativa detalhada na seção 1b abaixo, `stripe_customer_id`
--     sobrevive a cancelamento/expiração/downgrade e por isso não prova,
--     sozinho, que o plano atual foi pago):
--       START (antigo, com evidência) -> PRO (novo)         [preserva "acesso completo"]
--       PRO (antigo, com evidência)   -> SPECIALIST (novo)   [preserva "acesso completo + especialista"]
--       SPECIALIST (antigo) permanece SPECIALIST (nunca vira WEALTH — sem
--         decisão comercial para isso).
--       START/PRO SEM evidência -> preservado como está, registrado em
--         `plan_migration_v2_review` para decisão manual do time.
--     A ordem das duas UPDATEs importa (SPECIALIST-a-partir-de-PRO primeiro,
--     depois PRO-a-partir-de-START) para não encadear START -> PRO ->
--     SPECIALIST na mesma execução. O bloco inteiro só roda se o marcador
--     'plan_migration_v2_grandfather_done' ainda não existir em
--     `app_config`, tornando a migration segura para reexecução.
--
-- (c) TESTE permanece no enum, nunca migrado fisicamente — apenas
--     normalizado (lógico) para nível PRO (acesso completo comprovado no
--     sistema anterior). FALE_C_ESPECIALISTA idem, normalizado (lógico)
--     para nível SPECIALIST — nunca convertido para WEALTH (sem evidência
--     de equivalência comercial real; ver RELATORIO_IMPLEMENTACAO_PLANOS.md).
--
-- ROLLBACK: reverter esta migration significa (a) recriar handle_new_user()
-- com plan = 'FREE'; (b) reverter a policy de SELECT de asset_analyses para
-- USING (true) para anon+authenticated; (c) DROP das views/funções/tabela
-- novas listadas abaixo; (d) o backfill de grandfathering (seção 1b) NÃO é
-- automaticamente reversível — reverter plan='PRO' para 'START' exigiria
-- saber quais linhas vieram de qual conversão, o que não é mais recuperável
-- depois de rodar. Por isso o backfill é a única parte fisicamente
-- irreversível desta migration, e é feito deliberadamente (é o que evita
-- rebaixar assinantes) — qualquer rollback precisa de uma decisão humana
-- explícita sobre como tratar esses usuários, não um DOWN script automático.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Novo valor de enum: WEALTH (preserva FREE, TESTE, FALE_C_ESPECIALISTA)
-- ----------------------------------------------------------------------------
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'WEALTH';

-- ----------------------------------------------------------------------------
-- 1a. Parsing seguro de plan_end_at. Auditoria read-only de produção
--     confirmou que `profiles.plan_end_at` é `text` no schema real (não
--     `timestamptz`) — um cast direto (`plan_end_at::timestamptz`) lançaria
--     erro em qualquer valor vazio/malformado e derrubaria a função/consulta
--     inteira. Esta função helper nunca lança: retorna NULL para
--     nulo/vazio/inválido, e o timestamp parseado para qualquer valor válido
--     (ISO 8601 ou qualquer formato que o Postgres reconheça). Reutilizada
--     tanto no backfill (seção 1b) quanto em
--     current_user_has_full_market_access() (seção 4).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_parse_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1b. Backfill de grandfathering (ver estratégia (b) acima). Protegido por
--     marcador em app_config para ser seguro em reexecução.
--
--     CRITÉRIO DE EVIDÊNCIA FINAL (revisado após auditoria read-only real de
--     produção — ver RELATORIO_IMPLEMENTACAO_PLANOS.md): só é promovido um
--     registro `START`/`PRO` que tenha as TRÊS condições simultaneamente:
--       1. plan_start_at IS NOT NULL;
--       2. plan_end_at presente e parseável (via safe_parse_timestamptz);
--       3. plan_end_at parseado > now() (período comercial ainda vigente).
--
--     Por que plan_end_at entrou no critério: a auditoria real encontrou 5
--     profiles START com plan_start_at preenchido, mas só 2 com plan_end_at
--     ainda futuro — os outros 3 já tinham o período comercial encerrado
--     (assinatura vencida). Usar só `plan_start_at IS NOT NULL` (critério da
--     rodada anterior) teria promovido esses 3 vencidos para PRO de graça,
--     concedendo acesso pago permanente sem nenhuma cobrança futura — exatamente
--     o tipo de erro que este backfill deve evitar. Um plano legado vencido
--     não é mais "assinante pago atual" — é, com a estrutura nova, um usuário
--     gratuito (START) cujo período pago já terminou; não é um rebaixamento
--     indevido, é o desfecho natural do período contratado.
--
--     Por que `stripe_customer_id` continua fora do critério: ver
--     justificativa completa em RELATORIO_IMPLEMENTACAO_PLANOS.md — resumo:
--     sobrevive a cancelamento/expiração/downgrade (é preservado
--     deliberadamente por update-client-plan/index.ts, EditPlanDialog.tsx,
--     EditClientDialog.tsx para reaproveitar o Customer num futuro checkout
--     e no customer-portal), então não prova que o plano ATUAL é pago. A
--     auditoria real confirmou isso na prática: os 2 START vigentes têm
--     Stripe Customer, mas isso é uma correlação observada nos dados atuais,
--     não uma regra — não deve virar critério de promoção.
--
--     Três desfechos possíveis para um START/PRO remanescente (nenhum
--     `UPDATE` de downgrade — o pior caso é permanecer no plano atual):
--       (a) evidência completa e vigente -> promovido (UPDATE);
--       (b) plan_start_at presente mas plan_end_at ausente/inválido/vencido
--           -> permanece no plano atual, registrado em
--           plan_migration_v2_review (motivo distingue "vencido" —
--           legacy_paid_plan_expired, resultado já resolvido, não é
--           ambíguo — de "data ausente/inválida" —
--           legacy_start_without_valid_end_date /
--           legacy_pro_without_valid_end_date, esse sim ambíguo e
--           merecendo decisão manual);
--       (c) plan_start_at ausente -> nenhuma evidência, permanece no plano
--           atual, registrado em plan_migration_v2_review.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_migration_v2_review (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL,
  plan_before text NOT NULL,
  suggested_plan text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_migration_v2_review ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view migration review" ON public.plan_migration_v2_review;
CREATE POLICY "Admins can view migration review" ON public.plan_migration_v2_review
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Mesmo padrão de bug do item 9 (asset_highlights): RLS sozinha não basta,
-- PostgREST também exige GRANT explícito na tabela para o role authenticated
-- — sem isso, nem o admin conseguiria consultar esta tabela de revisão.
GRANT SELECT ON public.plan_migration_v2_review TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_config WHERE key = 'plan_migration_v2_grandfather_done'
  ) THEN
    -- PRO antigo com evidência inequívoca E vigente de plano pago ->
    -- SPECIALIST (roda antes do próximo UPDATE para não encadear
    -- START->PRO->SPECIALIST na mesma execução)
    UPDATE public.profiles
    SET plan = 'SPECIALIST'
    WHERE plan = 'PRO'
      AND plan_start_at IS NOT NULL
      AND public.safe_parse_timestamptz(plan_end_at) IS NOT NULL
      AND public.safe_parse_timestamptz(plan_end_at) > now();

    -- START antigo com evidência inequívoca E vigente de plano pago -> PRO
    UPDATE public.profiles
    SET plan = 'PRO'
    WHERE plan = 'START'
      AND plan_start_at IS NOT NULL
      AND public.safe_parse_timestamptz(plan_end_at) IS NOT NULL
      AND public.safe_parse_timestamptz(plan_end_at) > now();

    -- Qualquer START/PRO remanescente (não promovido acima): preservado como
    -- está, registrado para auditoria/revisão — nunca promovido na dúvida,
    -- nunca rebaixado.
    INSERT INTO public.plan_migration_v2_review (profile_id, plan_before, suggested_plan, reason)
    SELECT id, plan::text,
      CASE plan::text WHEN 'START' THEN 'PRO' WHEN 'PRO' THEN 'SPECIALIST' END,
      CASE
        WHEN plan_start_at IS NULL THEN
          'Sem plan_start_at — nenhuma evidência de plano pago (stripe_customer_id sozinho não é evidência suficiente, mesmo se preenchido); não promovido automaticamente pelo backfill de grandfathering; revisar manualmente se deveria ser ' ||
          CASE plan::text WHEN 'START' THEN 'PRO' WHEN 'PRO' THEN 'SPECIALIST' END || ' ou permanecer ' ||
          CASE plan::text WHEN 'START' THEN 'START gratuito' ELSE plan::text END || '.'
        WHEN public.safe_parse_timestamptz(plan_end_at) IS NULL THEN
          (CASE plan::text WHEN 'START' THEN 'legacy_start_without_valid_end_date' WHEN 'PRO' THEN 'legacy_pro_without_valid_end_date' END) ||
          ' — plan_start_at presente, mas plan_end_at está ausente ou não pôde ser interpretado como data válida; nunca presumir que ausência de data significa assinatura ativa. Revisar manualmente se deveria ser ' ||
          CASE plan::text WHEN 'START' THEN 'PRO' WHEN 'PRO' THEN 'SPECIALIST' END || ' ou permanecer no nível atual.'
        ELSE
          'legacy_paid_plan_expired — plan_start_at e plan_end_at presentes e válidos, mas o período comercial já encerrou (plan_end_at <= now()); o plano legado pago não está mais vigente, então não é promovido — este é o desfecho natural do período contratado, não um rebaixamento indevido. Permanece ' ||
          CASE plan::text WHEN 'START' THEN 'START (gratuito, sob a nova estrutura)' ELSE plan::text END || '.'
      END
    FROM public.profiles
    WHERE plan IN ('START', 'PRO')
      AND NOT (
        plan_start_at IS NOT NULL
        AND public.safe_parse_timestamptz(plan_end_at) IS NOT NULL
        AND public.safe_parse_timestamptz(plan_end_at) > now()
      );

    -- app_config.key não tem constraint UNIQUE compatível com ON CONFLICT
    -- no schema real de produção (confirmado na aplicação manual real desta
    -- migration) — usa inserção condicional via WHERE NOT EXISTS em vez de
    -- criar uma constraint nova só para viabilizar ON CONFLICT.
    INSERT INTO public.app_config (key, value)
    SELECT 'plan_migration_v2_grandfather_done', 'true'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.app_config WHERE key = 'plan_migration_v2_grandfather_done'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Novos cadastros nascem em START, não FREE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'START'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 3. Função de normalização de plano (equivalente SQL de normalizePlanCode).
--    Depois do backfill da seção 1b, START/PRO/SPECIALIST armazenados já
--    usam o significado NOVO, então são tratados como identidade aqui.
--    Ver src/utils/planHelpers.ts para a versão TypeScript e a justificativa
--    completa de cada mapeamento.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_plan_code(p_plan text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(coalesce(p_plan, 'START'))
    WHEN 'FREE' THEN 'START'
    WHEN 'TESTE' THEN 'PRO'
    WHEN 'FALE_C_ESPECIALISTA' THEN 'SPECIALIST'
    WHEN 'START' THEN 'START'
    WHEN 'PRO' THEN 'PRO'
    WHEN 'SPECIALIST' THEN 'SPECIALIST'
    WHEN 'WEALTH' THEN 'WEALTH'
    ELSE 'START'
  END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Função que determina, para o usuário autenticado atual, se ele tem
--    acesso aos campos premium de asset_analyses (nível PRO ou superior).
--    Usada pela view asset_analyses_gated abaixo. Trata:
--    - anônimo (auth.uid() null)            -> false
--    - admin (has_role)                     -> true (bypass)
--    - plano normalizado < PRO               -> false
--    - assinatura paga expirada (plan_end_at no passado) -> false
--    Nunca confia em plano informado pelo cliente — sempre lê profiles pelo
--    auth.uid() da sessão autenticada (JWT validado pelo PostgREST/Supabase).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_has_full_market_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan text;
  v_end_at_raw text;
  v_end_at timestamptz;
  v_normalized text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN true;
  END IF;

  -- plan_end_at é `text` no schema real (confirmado por auditoria read-only
  -- de produção) — nunca um cast direto para timestamptz aqui. Lido como
  -- text e parseado com segurança via safe_parse_timestamptz (seção 1a),
  -- que nunca lança erro em valor vazio/malformado.
  SELECT plan::text, plan_end_at::text INTO v_plan, v_end_at_raw
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_plan IS NULL THEN
    RETURN false;
  END IF;

  v_normalized := public.normalize_plan_code(v_plan);

  IF v_normalized NOT IN ('PRO', 'SPECIALIST', 'WEALTH') THEN
    RETURN false;
  END IF;

  v_end_at := public.safe_parse_timestamptz(v_end_at_raw);

  -- Assinatura paga (PRO/SPECIALIST) expirada volta ao nível START até
  -- renovar. WEALTH sem plan_end_at (sob consulta/gestão manual, concessão
  -- administrativa permanente) não expira automaticamente aqui.
  --
  -- Duas situações são tratadas de forma DIFERENTE, deliberadamente:
  --   - plan_end_at genuinamente ausente (NULL/vazio) para PRO/SPECIALIST ->
  --     tratado como concessão sem data de expiração conhecida (mesmo
  --     comportamento de sempre, preserva concessões administrativas
  --     permanentes);
  --   - plan_end_at PRESENTE mas que não pôde ser interpretado como data
  --     válida (texto malformado) -> falha fechada, nega acesso premium.
  --     Um valor presente e ilegível é uma anomalia de dado, não um sinal
  --     deliberado de "sem expiração" — nunca deve ser tratado como
  --     equivalente a uma concessão permanente. Isso nunca derruba a
  --     função (safe_parse_timestamptz não lança erro), só nega o acesso
  --     premium com segurança.
  IF v_normalized IN ('PRO', 'SPECIALIST') THEN
    IF v_end_at_raw IS NOT NULL AND btrim(v_end_at_raw) <> '' AND v_end_at IS NULL THEN
      RETURN false;
    END IF;

    IF v_end_at IS NOT NULL AND v_end_at < now() THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_full_market_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_full_market_access() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Fecha COMPLETAMENTE o SELECT direto na tabela crua para anon e
--    authenticated. Todos os consumidores legítimos de usuário comum
--    (Mercado público, Mercado autenticado, home, Carteira/
--    useWalletSimulator.ts) foram migrados para as views mascaradas abaixo
--    (asset_analyses_gated / assets_market_view) ou para a RPC pública
--    get_public_assets — nenhum deles depende mais da tabela crua. A partir
--    desta migration, SELECT direto em `asset_analyses` só é possível para:
--      - admin (policy "Admins can manage analyses", FOR ALL, já existente
--        desde 20260225175110 — cobre SELECT/INSERT/UPDATE/DELETE);
--      - service_role (Edge Functions de sync/backup, que sempre bypassam RLS).
--    Não existe mais nenhuma policy de SELECT para `anon` nem `authenticated`
--    além da de admin. Um usuário START (ou qualquer authenticated não-admin)
--    que rode `supabase.from("asset_analyses").select("*")` diretamente
--    recebe 0 linhas — testado (ver RELATORIO_IMPLEMENTACAO_PLANOS.md).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view analyses" ON public.asset_analyses;
DROP POLICY IF EXISTS "Authenticated users can view analyses" ON public.asset_analyses;

-- ----------------------------------------------------------------------------
-- 6. View com campos premium mascarados (NULL) para quem não tem acesso.
--    Owned pelo executor da migration (bypassa a RLS restritiva acima),
--    padrão Postgres/Supabase para exposição controlada de colunas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.asset_analyses_gated AS
SELECT
  aa.id,
  aa.asset_id,
  aa.valor,
  aa.roi2026,
  aa.roi2025,
  aa.roi2024,
  aa.roitrim,
  aa.dy2025,
  aa.fator_mc,
  aa.roi2023a2025,
  aa.perfil_investidor,
  aa.taxa_semanal,
  aa.resumo,
  CASE WHEN public.current_user_has_full_market_access() THEN aa.tendencia ELSE NULL END AS tendencia,
  CASE WHEN public.current_user_has_full_market_access() THEN aa.carteira ELSE NULL END AS carteira,
  CASE WHEN public.current_user_has_full_market_access() THEN aa.recomendacao ELSE NULL END AS recomendacao,
  CASE WHEN public.current_user_has_full_market_access() THEN aa.nota_especialista ELSE NULL END AS nota_especialista,
  aa.updated_at
FROM public.asset_analyses aa;

-- security_invoker = false (explícito, não implícito): a view roda com o
-- privilégio de quem a criou (esta migration), não do papel que a consulta —
-- é isso que permite anon/authenticated lerem através dela mesmo com a RLS
-- restritiva da tabela base (seção 5). Se um dia alguém mudar isso para
-- security_invoker = true "por padrão de segurança", a view para de
-- funcionar para anon/authenticated (cai na RLS restritiva) — documentado
-- aqui para não ser uma surpresa numa revisão futura.
ALTER VIEW public.asset_analyses_gated SET (security_invoker = false);
REVOKE ALL ON public.asset_analyses_gated FROM PUBLIC;
GRANT SELECT ON public.asset_analyses_gated TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. View combinada assets + análises mascaradas, achatada (sem embed
--    aninhado), para consumo direto via PostgREST em /app/mercado.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.assets_market_view AS
SELECT
  a.*,
  g.perfil_investidor,
  g.recomendacao,
  g.tendencia,
  g.taxa_semanal AS analysis_taxa_semanal,
  g.roi2026,
  g.carteira,
  g.nota_especialista,
  g.valor,
  g.roitrim,
  g.roi2025,
  g.dy2025,
  g.roi2024,
  g.fator_mc,
  g.roi2023a2025,
  g.resumo
FROM public.assets a
JOIN public.asset_analyses_gated g ON g.asset_id = a.id;

ALTER VIEW public.assets_market_view SET (security_invoker = false);
REVOKE ALL ON public.assets_market_view FROM PUBLIC;
GRANT SELECT ON public.assets_market_view TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC pública para /mercado (visitante/anônimo): sempre nível básico
--    (nunca inclui os 4 campos premium — nem sequer os seleciona), com
--    proteções de busca:
--      - sem termo: 20 primeiros ativos ativos, ordem alfabética, sem
--        parâmetro de página (não dá para paginar até a base inteira);
--      - termo com match exato de código B3: retorna só essa linha;
--      - termo com match exato de nome não-ambíguo: retorna só essa linha;
--      - termo curto (<2 caracteres) sem match exato: retorna vazio (evita
--        enumeração ampla da base com um único caractere);
--      - busca parcial: no máximo 10 resultados, curingas de LIKE (% e _)
--        escapados para o termo do cliente nunca ser tratado como padrão SQL.
--    Não aceita limit/offset/page do cliente. Não retorna contagem total.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_assets(p_search text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  codigo_b3 text,
  nome text,
  tipo text,
  setor text,
  valor text,
  roi2026 text,
  roi2025 text,
  dy2025 text,
  roitrim text,
  fator_mc text,
  roi2023a2025 text,
  perfil_investidor text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_search text;
  v_escaped text;
BEGIN
  v_search := left(btrim(coalesce(p_search, '')), 50);

  IF v_search = '' THEN
    RETURN QUERY
      SELECT a.id, a.codigo_b3, a.nome, a.tipo, a.setor,
             g.valor, g.roi2026, g.roi2025, g.dy2025, g.roitrim, g.fator_mc, g.roi2023a2025, g.perfil_investidor
      FROM public.assets a
      JOIN public.asset_analyses_gated g ON g.asset_id = a.id
      WHERE a.is_active = true
      ORDER BY a.codigo_b3 ASC
      LIMIT 20;
    RETURN;
  END IF;

  -- Match exato de código B3 tem prioridade absoluta sobre qualquer outro resultado.
  IF EXISTS (SELECT 1 FROM public.assets a WHERE a.is_active = true AND upper(a.codigo_b3) = upper(v_search)) THEN
    RETURN QUERY
      SELECT a.id, a.codigo_b3, a.nome, a.tipo, a.setor,
             g.valor, g.roi2026, g.roi2025, g.dy2025, g.roitrim, g.fator_mc, g.roi2023a2025, g.perfil_investidor
      FROM public.assets a
      JOIN public.asset_analyses_gated g ON g.asset_id = a.id
      WHERE a.is_active = true AND upper(a.codigo_b3) = upper(v_search);
    RETURN;
  END IF;

  -- Match exato de nome, só quando inequívoco (exatamente 1 ativo com esse nome).
  IF (SELECT count(*) FROM public.assets a WHERE a.is_active = true AND upper(a.nome) = upper(v_search)) = 1 THEN
    RETURN QUERY
      SELECT a.id, a.codigo_b3, a.nome, a.tipo, a.setor,
             g.valor, g.roi2026, g.roi2025, g.dy2025, g.roitrim, g.fator_mc, g.roi2023a2025, g.perfil_investidor
      FROM public.assets a
      JOIN public.asset_analyses_gated g ON g.asset_id = a.id
      WHERE a.is_active = true AND upper(a.nome) = upper(v_search);
    RETURN;
  END IF;

  -- Termo curto demais para busca parcial permitiria enumerar boa parte da
  -- base (ex.: "A" bateria em dezenas de nomes) — exige >= 2 caracteres.
  IF length(v_search) < 2 THEN
    RETURN;
  END IF;

  -- Escapa curingas do LIKE para o termo do cliente ser tratado como texto
  -- literal, nunca como padrão SQL controlado por quem pesquisa.
  v_escaped := replace(v_search, '\', '\\');
  v_escaped := replace(v_escaped, '%', '\%');
  v_escaped := replace(v_escaped, '_', '\_');

  RETURN QUERY
    SELECT a.id, a.codigo_b3, a.nome, a.tipo, a.setor,
           g.valor, g.roi2026, g.roi2025, g.dy2025, g.roitrim, g.fator_mc, g.roi2023a2025, g.perfil_investidor
    FROM public.assets a
    JOIN public.asset_analyses_gated g ON g.asset_id = a.id
    WHERE a.is_active = true
      AND (a.codigo_b3 ILIKE '%' || v_escaped || '%' ESCAPE '\' OR a.nome ILIKE '%' || v_escaped || '%' ESCAPE '\')
    ORDER BY a.codigo_b3 ASC
    LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_assets(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_assets(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Curadoria manual do "Top 20" da home. Não há hoje nenhum critério de
--    ranking real (auditoria não encontrou coluna de posição/ranking nem
--    ordenação administrável pré-existente) — este campo fica vazio até um
--    admin curar manualmente via painel administrativo. Leitura pública (só
--    tem asset_id + posição, nenhum dado sensível), escrita só admin.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_highlights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  position integer NOT NULL CHECK (position >= 1 AND position <= 20),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uma posição por vez (impede dois ativos na mesma posição simultaneamente).
DROP INDEX IF EXISTS asset_highlights_position_unique;
CREATE UNIQUE INDEX asset_highlights_position_unique ON public.asset_highlights (position);

ALTER TABLE public.asset_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view highlights" ON public.asset_highlights;
CREATE POLICY "Anyone can view highlights" ON public.asset_highlights
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage highlights" ON public.asset_highlights;
CREATE POLICY "Admins can manage highlights" ON public.asset_highlights
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Bug encontrado por execução real em homologação local (não só leitura de
-- código): a RLS acima permite SELECT público, mas sem GRANT explícito o
-- PostgREST nega acesso à tabela antes mesmo de avaliar a policy (RLS e
-- GRANT são checagens independentes no Postgres) — anon/authenticated
-- recebiam "permission denied for table asset_highlights" ao consultar a
-- seção "Ativos em Destaque" da home. Sem este GRANT, a curadoria nunca
-- teria funcionado em produção.
GRANT SELECT ON public.asset_highlights TO anon, authenticated;

DROP TRIGGER IF EXISTS update_asset_highlights_updated_at ON public.asset_highlights;
CREATE TRIGGER update_asset_highlights_updated_at
  BEFORE UPDATE ON public.asset_highlights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- 9b. Número de WhatsApp comercial para o CTA "Falar com Especialista" do
--     plano WEALTH (src/components/ContactSpecialistDialog.tsx). Nenhum
--     número é inserido aqui (não inventamos um) — a chave fica ausente de
--     app_config até um admin configurá-la. `app_config` em geral é
--     admin-only (RLS restrita desde a correção de PII de 2026-03-08), mas
--     este único valor é comercial/público por natureza (é para ser
--     divulgado a visitantes), então é exposto por uma RPC estreita e
--     somente-leitura desse valor específico, sem abrir a tabela inteira.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_whatsapp_number()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT value FROM public.app_config WHERE key = 'sales_whatsapp_number' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_sales_whatsapp_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_whatsapp_number() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. subscription_plans: novo flag para planos "sob consulta" (WEALTH) e
--     upsert idempotente dos 4 planos canônicos com os textos/preços atuais.
--     Os stripe_price_id de PRO/SPECIALIST NÃO são preenchidos aqui (os
--     price IDs novos ainda não existem — ver .env.example). create-checkout
--     lê os price IDs novos diretamente das env vars STRIPE_PRICE_*, não
--     desta coluna — decisão deliberada (ver RELATORIO_IMPLEMENTACAO_PLANOS.md
--     item 9): evita que um valor desatualizado/errado gravado no banco por
--     um admin gere cobrança para o price errado. Esta tabela permanece a
--     fonte de verdade para texto/preço de exibição e para o flag
--     is_contact_only.
-- ----------------------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS is_contact_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price_monthly numeric;

-- plan_code não tem constraint UNIQUE compatível com ON CONFLICT no schema
-- real de produção (confirmado na aplicação manual real desta migration) —
-- usa UPDATE das linhas existentes + INSERT ... WHERE NOT EXISTS para as
-- que ainda não existem, em vez de criar uma constraint nova só para
-- viabilizar ON CONFLICT. CTE única com os 4 planos para não repetir os
-- literais entre o UPDATE e o INSERT.
WITH new_plans (plan_code, display_name, description, price_monthly, price_quarterly, price_note, stripe_price_id, features, is_active, is_contact_only, sort_order) AS (
  VALUES
    ('START', 'START', 'Para começar a comparar investimentos.', 0::numeric, 0::numeric, 'Grátis', NULL::text,
      '["Acesso à lista completa de ativos após cadastro", "Indicadores básicos dos ativos", "Busca e filtros", "Acesso limitado aos indicadores premium"]'::jsonb,
      true, false, 1),
    ('PRO', 'PRO', 'Acesso completo aos dados e indicadores de todos os ativos.', 29.90::numeric, 89.70::numeric, 'R$ 29,90/mês ou R$ 89,70/trimestre', NULL::text,
      '["Todos os ativos", "Todos os indicadores", "Tendência TRIM", "Carteira TRIM", "Recomendação TRIM", "Nota Especialista"]'::jsonb,
      true, false, 2),
    ('SPECIALIST', 'SPECIALIST', 'Todos os benefícios do PRO, com acesso a especialista.', 249.90::numeric, 749.70::numeric, 'R$ 249,90/mês ou R$ 749,70/trimestre', NULL::text,
      '["Todos os benefícios do PRO", "Acesso a especialista", "Carteira personalizada"]'::jsonb,
      true, false, 3),
    ('WEALTH', 'WEALTH', 'Atendimento personalizado para investidores com maior capacidade de investimento.', NULL::numeric, NULL::numeric, 'Sob consulta', NULL::text,
      '["Todos os dados e indicadores", "Acesso a especialista", "Atendimento personalizado", "Cobrança comercial baseada em percentual sobre o valor investido"]'::jsonb,
      true, true, 4)
)
UPDATE public.subscription_plans sp SET
  display_name = np.display_name,
  description = np.description,
  price_monthly = np.price_monthly,
  price_quarterly = np.price_quarterly,
  price_note = np.price_note,
  features = np.features,
  is_active = np.is_active,
  is_contact_only = np.is_contact_only,
  sort_order = np.sort_order,
  updated_at = now()
FROM new_plans np
WHERE sp.plan_code = np.plan_code;

WITH new_plans (plan_code, display_name, description, price_monthly, price_quarterly, price_note, stripe_price_id, features, is_active, is_contact_only, sort_order) AS (
  VALUES
    ('START', 'START', 'Para começar a comparar investimentos.', 0::numeric, 0::numeric, 'Grátis', NULL::text,
      '["Acesso à lista completa de ativos após cadastro", "Indicadores básicos dos ativos", "Busca e filtros", "Acesso limitado aos indicadores premium"]'::jsonb,
      true, false, 1),
    ('PRO', 'PRO', 'Acesso completo aos dados e indicadores de todos os ativos.', 29.90::numeric, 89.70::numeric, 'R$ 29,90/mês ou R$ 89,70/trimestre', NULL::text,
      '["Todos os ativos", "Todos os indicadores", "Tendência TRIM", "Carteira TRIM", "Recomendação TRIM", "Nota Especialista"]'::jsonb,
      true, false, 2),
    ('SPECIALIST', 'SPECIALIST', 'Todos os benefícios do PRO, com acesso a especialista.', 249.90::numeric, 749.70::numeric, 'R$ 249,90/mês ou R$ 749,70/trimestre', NULL::text,
      '["Todos os benefícios do PRO", "Acesso a especialista", "Carteira personalizada"]'::jsonb,
      true, false, 3),
    ('WEALTH', 'WEALTH', 'Atendimento personalizado para investidores com maior capacidade de investimento.', NULL::numeric, NULL::numeric, 'Sob consulta', NULL::text,
      '["Todos os dados e indicadores", "Acesso a especialista", "Atendimento personalizado", "Cobrança comercial baseada em percentual sobre o valor investido"]'::jsonb,
      true, true, 4)
)
INSERT INTO public.subscription_plans
  (plan_code, display_name, description, price_monthly, price_quarterly, price_note, stripe_price_id, features, is_active, is_contact_only, sort_order)
SELECT np.plan_code, np.display_name, np.description, np.price_monthly, np.price_quarterly, np.price_note, np.stripe_price_id, np.features, np.is_active, np.is_contact_only, np.sort_order
FROM new_plans np
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans sp WHERE sp.plan_code = np.plan_code
);

-- ----------------------------------------------------------------------------
-- 10b. Proteção definitiva contra comissão de afiliado duplicada. A checagem
--      em código (SELECT antes do INSERT em processAffiliateCommission(),
--      supabase/functions/stripe-webhook/index.ts) já existia, mas sozinha
--      não protege contra dois webhooks concorrentes chegando ao INSERT
--      quase ao mesmo tempo (race condition — o segundo SELECT pode rodar
--      antes do primeiro INSERT commitar). Auditoria read-only real de
--      produção confirmou ZERO duplicidades existentes em
--      `commissions.stripe_payment_id` até esta data — o índice abaixo não
--      altera nenhuma linha, só impede duplicatas futuras.
--
--      Índice único PARCIAL (não em toda a coluna): `stripe_payment_id` é
--      nullable e pode ser string vazia em fluxos legados/administrativos
--      sem pagamento Stripe associado — um índice único sem o WHERE
--      rejeitaria múltiplas comissões manuais com o campo NULL/vazio, o que
--      nunca foi a intenção. O filtro `WHERE stripe_payment_id IS NOT NULL
--      AND btrim(stripe_payment_id) <> ''` restringe a unicidade só a
--      pagamentos Stripe reais identificados.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS commissions_stripe_payment_id_unique
ON public.commissions (stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL
  AND btrim(stripe_payment_id) <> '';

-- ----------------------------------------------------------------------------
-- 11. Dívida técnica documentada (não corrigida nesta migration): profiles.plan
--     e asset_analyses.carteira compartilham o mesmo enum `plan_type` por
--     herança histórica, embora representem conceitos diferentes (plano de
--     assinatura do usuário vs. classificação de conteúdo do ativo). O valor
--     'WEALTH' adicionado na seção 1 é um plano de assinatura — NUNCA deve
--     ser usado como valor de `carteira` (isso é decidido pelo
--     sincronizador da planilha, que não foi alterado para reconhecer
--     "WEALTH" como texto de carteira nesta migration, deliberadamente).
--     Separar os dois em enums distintos exigiria uma migração maior (novo
--     tipo + ALTER COLUMN em asset_analyses.carteira + validação de dados
--     existentes) que não foi feita aqui para não expandir o escopo sem
--     necessidade — não há hoje nenhum caminho de código que grave 'WEALTH'
--     em asset_analyses.carteira, então o risco prático atual é nulo, mas o
--     enum compartilhado continua sendo uma fragilidade estrutural a
--     resolver em uma tarefa dedicada.
-- ----------------------------------------------------------------------------
