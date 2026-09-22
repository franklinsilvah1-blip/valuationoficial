# Matriz de acesso ao Mercado — rodada de 2026-09-22

Continuação de `RELATORIO_IMPLEMENTACAO_PLANOS.md` (rodada de 2026-04-15).
Revisado após revisão de segurança pré-produção — a seção 7 lista o que a
revisão encontrou e como foi corrigido.

> **Status: NADA FOI APLICADO EM PRODUÇÃO.** Nenhuma migration executada,
> nenhum deploy, nenhum merge. As duas migrations estão prontas e testadas
> localmente, aguardando aplicação manual.

---

## 1. Auditoria

| Item | Achado |
|---|---|
| Stack | Vite 5 + React 18 + TypeScript + Tailwind + shadcn/ui, React Router 7, TanStack Query 5. **Não há SSR** — todo HTML é gerado no cliente. |
| Banco / fonte de dados | Supabase (Postgres 17, projeto `mbnjjbtllzgatkjtsvrg`, sa-east-1). Ativos alimentados por planilha Google via Edge Function `sync-google-sheets`. |
| Autenticação | Supabase Auth. `src/contexts/AuthContext.tsx` expõe `user` e `userPlan`. |
| Identificação de plano | `profiles.plan` → `normalizePlanCode()` (TS) / `normalize_plan_code()` (SQL). Legados `FREE`/`TESTE`/`FALE_C_ESPECIALISTA` continuam mapeados. Admin (`has_role`) bypassa. |
| PERFIL do ativo | `asset_analyses.perfil_investidor` — **texto livre** da coluna `PERFIL DO ATIVO`. Sem enum, sem FK, sem normalização no sync. Valores reais: `START` 19, `PRO` 12, `SPECIALIST` 588, zero nulos. |
| Volume | 619 ativos, 607 com `is_active = true`. |
| `roi2026` | **Texto** com ponto decimal (`"105.71"`, `"-15.11"`, `"0"`). |

### Mapeamento planilha → coluna (de `sync-google-sheets/index.ts`)

| Planilha | Coluna |
|---|---|
| `CD B3` / `TIPO` | `assets.codigo_b3` / `assets.tipo` |
| `PERFIL DO ATIVO` | `asset_analyses.perfil_investidor` |
| `ROI 2026` | `asset_analyses.roi2026` |
| **`ROI TRIM (R)`** | **`asset_analyses.taxa_semanal`** |
| **`ROI TRIM (T)`** | **`asset_analyses.roitrim`** |
| `CARTEIRA TRIM` | `asset_analyses.carteira` |
| `RECOMENDAÇÃO TRIM` | `asset_analyses.recomendacao` |
| `NOTA ESPECIALISTA` | `asset_analyses.nota_especialista` |
| `TENDÊNCIA TRIM` | `asset_analyses.tendencia` |

---

## 2. Matriz implementada

### Os 5 campos da regra nova (dependem do PERFIL do ativo)

`taxa_semanal` (ROI TRIM R), `roitrim` (ROI TRIM T), `carteira`,
`recomendacao`, `nota_especialista`:

|  | ativo START | ativo PRO | ativo SPECIALIST |
|---|---|---|---|
| anônimo | bloqueado | bloqueado | bloqueado |
| START | bloqueado | bloqueado | bloqueado |
| PRO | **liberado** | **liberado** | **bloqueado** |
| SPECIALIST / WEALTH / admin | liberado | liberado | liberado |

### TENDÊNCIA TRIM — regra antiga preservada, fora da matriz

| | tendência |
|---|---|
| anônimo, START | bloqueada |
| PRO, SPECIALIST, WEALTH, admin | **liberada em QUALQUER ativo** |

`tendencia` não está na lista de 5 campos que o cliente pediu para bloquear ao
PRO. Colocá-la na matriz tiraria do assinante PRO a tendência de **588 dos 607**
ativos ativos — benefício que `getPlanInfo('PRO')` anuncia na página de planos.
No banco ela continua ancorada em `current_user_market_level() IN ('PRO','FULL')`,
que é exatamente o predicado de `current_user_has_full_market_access()` da
migration anterior. Comportamento idêntico ao de antes desta rodada.

---

## 3. Onde a autorização vive

```
normalize_asset_profile(text)          -- eixo "coluna" (perfil do ativo)
current_user_market_level()            -- eixo "linha"  (ANON|START|PRO|FULL)
        ↓
can_view_asset_premium(level, perfil)  -- A MATRIZ, definida UMA vez (IMMUTABLE)
        ↓
asset_analyses_gated (view)            -- CASE ... ELSE NULL por linha
        ↓                    ↓
assets_market_view          top_assets_year()  [INTERNA]
(só authenticated)                  ↓
                            get_public_market_assets()  [única porta do anon]
```

- `asset_analyses` (tabela CRUA): `authenticated` MANTÉM o GRANT — o painel
  Admin lê essa tabela do navegador e admin é o papel `authenticated`. Quem
  barra o usuário START aqui é a **RLS**, não o GRANT (ver seção 9).
- `asset_analyses_gated` / `assets_market_view`: só `authenticated` (FASE B).
- `assets`: só `authenticated`, por GRANT **e** por policy RLS (FASE B).
- Visitante anônimo tem **uma** rota: `get_public_market_assets`, que limita
  linhas (Top 20) e colunas (5) no servidor e não aceita `limit`/`offset`/ordem.
- Valores bloqueados saem **`NULL` do Postgres**. Não existem em DevTools,
  Network, HTML, state do React nem cache.

`src/utils/marketAccess.ts` espelha a matriz só para escolher a apresentação
(cadeado vs. traço). Apagá-lo não vazaria nada.

---

## 4. Rollout em duas fases — sem janela quebrada

| # | Ação | Estado do site |
|---|---|---|
| 1 | Aplicar **FASE A** (`20260922120000_market_access_matrix.sql`) | Frontend antigo continua funcionando. A fase **não revoga nenhuma tabela/view** (0 REVOKE de relação); há 6 REVOKE de EXECUTE em funções, sempre seguidos de GRANT nominal — nenhum consumidor técnico perde acesso (ver seção 11.5). |
| 2 | Publicar o **frontend novo** | Home e `/mercado` passam a usar `get_public_market_assets`, que já existe desde o passo 1. |
| 3 | **Validar**: Network mostra `POST /rest/v1/rpc/get_public_market_assets`; `/app/mercado` e `/app/carteira` OK | — |
| 4 | Aplicar **FASE B** (`20260922130000_market_access_lockdown.sql`) | Fecha os caminhos de enumeração anônima. O frontend novo não depende de nenhum deles. |

Em nenhum momento existe um estado em que o site esteja quebrado. A FASE B tem
preflight que aborta se a FASE A não estiver aplicada, e um bloco de verificação
final que faz ROLLBACK se qualquer invariante de segurança falhar.

**Reversão**: o rodapé da FASE B traz um rollback **FUNCIONAL** (não simétrico)
— ver seção 10.

---

## 5. Superfície do papel `anon` DEPOIS da FASE B

Verificado com `SET ROLE anon` num Postgres real (suíte 03).

### Tabelas/views com SELECT

**Nenhuma**, entre as de mercado. Revogadas: `assets`, `asset_analyses`,
`assets_market_view`, `asset_analyses_gated`, `asset_highlights`.

### Funções com EXECUTE (relacionadas a mercado)

| Função | anon | Por quê |
|---|---|---|
| `get_public_market_assets(text)` | ✅ **sim** | Única porta. Top 20, 5 colunas, sem paginação. |
| `top_assets_year(integer)` | ❌ não | Interna; só alcançável de dentro das SECURITY DEFINER. |
| `get_public_assets(text)` | ❌ não | RPC antiga; alcançava a base toda. Mantida só para `authenticated`. |
| `current_user_market_level()` | ❌ não | Usada só dentro das views/RPCs. |
| `current_user_has_full_market_access()` | ❌ não | idem. |
| `can_view_asset_premium(text)` e `(text,text)` | ❌ não | idem. |
| `normalize_asset_profile(text)` | ❌ não | Pura; EXECUTE default de PUBLIC revogado. |
| `safe_parse_numeric(text)` | ❌ não | idem. |

Fora do escopo de mercado, `anon` mantém `get_sales_whatsapp_number()` (número
comercial, público por natureza) e `request_affiliate_activation` (programa de
afiliados) — ambos inalterados por esta rodada.

---

## 6. Testes automatizados

`supabase/tests/` — 218 casos executados num **PostgreSQL real** (PGlite/WASM,
sem Docker). Ver `supabase/tests/README.md`.

| Suíte | Casos | Cobre |
|---|---|---|
| `01-matriz-de-acesso.mjs` | 62 | Níveis de plano (incl. fail-closed), matriz por campo × perfil, Top 20, busca restrita |
| `02-rollout-e-desempenho.mjs` | 25 | Preflight, atomicidade, FASE B, idempotência, `EXPLAIN ANALYZE` |
| `03-superficie-anon.mjs` | 21 | `SET ROLE anon` antes/depois da FASE B |
| `04-bypass-e-privilegio-efetivo.mjs` | 51 | Herança de PUBLIC, `has_table_privilege`, RLS ativa, bypass pela tabela crua, escrita do Admin/service_role |
| `05-policies-schema-e-dml.mjs` | 59 | Whitelist de policies (leitura E escrita), CREATE no schema, DML mínimo, DELETE real por plano |

**Total: 218 casos.**

```bash
npm install --no-save @electric-sql/pglite
node supabase/tests/01-matriz-de-acesso.mjs   # 62 passaram, 0 falharam
node supabase/tests/02-rollout-e-desempenho.mjs # 25 passaram, 0 falharam
node supabase/tests/03-superficie-anon.mjs    # 21 passaram, 0 falharam
node supabase/tests/04-bypass-e-privilegio-efetivo.mjs # 51 passaram, 0 falharam
node supabase/tests/05-policies-schema-e-dml.mjs # 59 passaram, 0 falharam
```

### Desempenho — medido, não estimado

`EXPLAIN (ANALYZE, VERBOSE)` sobre `assets_market_view`:

```
InitPlan 1
  ->  Result (actual rows=1.00 loops=1)
        Output: current_user_market_level()
```

**6 nós InitPlan, cada um com `loops=1`** — com 30 linhas e também com 330.
Ou seja, `current_user_market_level()` (que consulta `profiles` e `has_role`)
roda 6 vezes por query, não 6 × nº de linhas. Sem o padrão de sub-SELECT
escalar seriam ~3.600 avaliações numa varredura dos 607 ativos.

---

## 7. O que a revisão de segurança encontrou (e correção)

| # | Achado | Correção |
|---|---|---|
| 1 | **`get_public_market_assets` permitia sair do Top 20.** Os ramos de busca consultavam `public.assets` direto: `p_search="AALR3"` devolvia um ativo com ROI 2026 = −37,62, e `"PET"` devolvia 7 ativos em sua maioria fora do Top 20. | Busca reescrita para operar **exclusivamente** sobre `top_assets_year(20)`. Nenhum ramo toca `public.assets`. Provado na suíte 01 e 03. |
| 2 | **`public.assets` estava aberta para `anon`** — 619 linhas, com `offset` livre (`?select=codigo_b3&offset=600` devolvia AZUL3, BGIP3, BAAX39). A migration anterior não tocava nela. | FASE B: policy RLS passa a valer só para `authenticated` **e** GRANT de anon revogado (dois cadeados independentes). |
| 3 | **`get_public_assets` (RPC antiga) continuaria sendo rota de enumeração**, mesmo com a tabela fechada, por ser SECURITY DEFINER. | FASE B revoga o EXECUTE de `anon`. Mantida para `authenticated`, que já tem direito à lista completa. |
| 4 | **`current_user_market_level()` tinha catch-all `return 'FULL'`.** | Reescrita com um ramo explícito por plano e `START` como padrão. Plano desconhecido/nulo/expirado → `START`, nunca `FULL`. Mesma mudança em `getMarketLevel()` no TS. |
| 5 | **`tendencia` havia sido movida para a matriz**, o que tiraria do PRO a tendência de 588 ativos. | Devolvida à regra antiga (`nível IN ('PRO','FULL')`), separada dos 5 campos. Ajustado também em `marketAccess.ts`, `fieldVisibility.ts` e `AssetCard.tsx` (onde o bloco de tendência saiu do gate do card completo). |
| 6 | Migration não era atômica. | `BEGIN; ... COMMIT;` nas duas. Todos os comandos usados são transacionais (não há `CREATE INDEX CONCURRENTLY`). Testado: erro no meio → ROLLBACK, nada criado. |
| 7 | Sem preflight. | Bloco `DO` no topo das duas fases valida tabelas, views, funções, colunas e **a ordem exata das colunas** de `asset_analyses_gated` (que o `CREATE OR REPLACE VIEW` exige), abortando antes de qualquer alteração. |
| 8 | Rollout com janela quebrada. | Duas fases (seção 4). |
| 9 | `asset_highlights` continuava legível por `anon` sem utilidade. | Revogada na FASE B, de forma **condicional** (não aborta a fase se a tabela não existir). |
| 10 | Custo da view não avaliado. | Medido com `EXPLAIN ANALYZE` (seção 6). |

### Defeito encontrado pelos próprios testes

`v_missing := v_missing || 'texto'` é ambíguo em PostgreSQL: o literal é
resolvido como `text[]` e o bloco morria com *"malformed array literal"* em vez
da mensagem de preflight. Abortava com segurança, mas com diagnóstico inútil —
exatamente o que o preflight deveria evitar. Trocado por `array_append()` nas
duas migrations. Só apareceu porque as migrations foram **executadas**, não
apenas parseadas.

---

## 8. Checklist pós-aplicação

### Depois da FASE A (antes de publicar o frontend)

```sql
-- as 6 funções novas existem
select proname, pronargs from pg_proc
where pronamespace='public'::regnamespace
  and proname in ('normalize_asset_profile','safe_parse_numeric',
                  'current_user_market_level','can_view_asset_premium',
                  'top_assets_year','get_public_market_assets')
order by 1,2;

-- Top 20 sai ordenado por ROI 2026 desc, no máximo 20 linhas
select codigo_b3, tipo, roi2026 from public.get_public_market_assets(NULL);

-- ticker FORA do Top 20 não volta (use um código que você sabe estar fora)
select * from public.get_public_market_assets('AALR3');   -- esperado: 0 linhas

-- perfis reconhecidos
select public.normalize_asset_profile(perfil_investidor) perfil, count(*)
from public.asset_analyses group by 1 order by 2 desc;

-- desempenho: procure "InitPlan" com loops=1
explain (analyze, verbose) select * from public.assets_market_view;
```

O site antigo deve continuar normal neste ponto.

### Depois da FASE B — PRIVILÉGIO EFETIVO (SQL Editor)

```sql
-- TODAS estas devem retornar FALSE. has_table_privilege considera GRANT
-- direto, herança de PUBLIC e membership — ao contrário de role_table_grants.
select has_table_privilege('anon','public.assets','SELECT')               as assets,
       has_table_privilege('anon','public.asset_analyses','SELECT')       as analyses,
       has_table_privilege('anon','public.assets_market_view','SELECT')   as market_view,
       has_table_privilege('anon','public.asset_analyses_gated','SELECT') as gated,
       has_table_privilege('anon','public.asset_highlights','SELECT')     as highlights;

-- RLS precisa estar ATIVA nas duas tabelas cruas (a policy sozinha não basta)
select relname, relrowsecurity from pg_class
where oid in ('public.assets'::regclass, 'public.asset_analyses'::regclass);

-- authenticated NÃO pode ter sido quebrado
select has_table_privilege('authenticated','public.assets','SELECT')             as assets,
       has_table_privilege('authenticated','public.asset_analyses','SELECT')     as analyses_admin,
       has_function_privilege('authenticated','public.normalize_asset_profile(text)','EXECUTE') as fn_perfil,
       has_function_privilege('authenticated','public.safe_parse_numeric(text)','EXECUTE')     as fn_numeric;
```

As duas últimas são a lição da suíte 04: **uma view não empresta privilégio de
FUNÇÃO**, só de tabela. Sem esses EXECUTE, todo usuário logado receberia
`permission denied for function` ao abrir /app/mercado.

---

### Depois da FASE B — ANÔNIMO

Substitua `<ANON_KEY>` e rode com o `curl` (ou aba anônima + DevTools):

| Teste | Esperado |
|---|---|
| `GET /rest/v1/assets_market_view?select=id` | **negado** (401/permission denied) |
| `GET /rest/v1/asset_analyses_gated?select=id` | **negado** |
| `GET /rest/v1/assets?select=id` | **negado** |
| `GET /rest/v1/asset_analyses?select=id` | **negado** |
| `GET /rest/v1/asset_highlights?select=id` | **negado** |
| `POST /rpc/get_public_assets {"p_search":"AALR3"}` | **negado** |
| `POST /rpc/top_assets_year {"p_limit":20}` | **negado** |
| `POST /rpc/get_public_market_assets {"p_search":null}` | 20 linhas (ou menos, se a base não tiver 20 com ROI legível) |
| ...mesma chamada: campo `recomendacao` | `null` em **todas** as linhas |
| ...mesma chamada: colunas do JSON | só `id`, `codigo_b3`, `tipo`, `roi2026`, `recomendacao` — sem `nome`, sem ROI TRIM |
| `{"p_search":"<ticker DENTRO do Top 20>"}` | encontra |
| `{"p_search":"<ticker FORA do Top 20>"}` | **0 linhas** |
| `{"p_search":"%"}` / `{"p_search":"_"}` | 0 linhas (curingas escapados) |
| Tentar paginar / aumentar o limite | impossível: a RPC não aceita `limit`/`offset`/`page` |

```bash
# exemplo do teste decisivo
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://mbnjjbtllzgatkjtsvrg.supabase.co/rest/v1/assets?select=id&limit=1" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
# esperado: 401 (antes: 206 com Content-Range 0-0/619)
```

### Depois da FASE B — AUTENTICADO

| Perfil | Esperado |
|---|---|
| **START** | vê todos os ativos; os 5 campos premium bloqueados em qualquer ativo; **tendência bloqueada** (como antes) |
| **PRO** + ativo START | 5 campos liberados |
| **PRO** + ativo PRO | 5 campos liberados |
| **PRO** + ativo SPECIALIST | 5 campos bloqueados; **tendência VISÍVEL** (regra antiga preservada) |
| **SPECIALIST** | acesso integral a todos os ativos |
| **WEALTH** | acesso integral a todos os ativos |
| **ADMIN** | bypass preservado |
| **PRO/SPECIALIST vencido** | rebaixado para START |
| **Plano inválido no banco** | rebaixado para START, nunca FULL |

No DevTools, para um usuário START, o JSON de `assets_market_view` deve trazer
`null` nos 5 campos — não o valor real escondido por CSS.

### Regressão

Login, cadastro, assinatura/checkout, Admin, Blog, `/app/carteira` e o
simulador de carteira. Nenhum deles foi alterado nesta rodada, mas a FASE B
mexe em privilégios que `/app/mercado` e `/app/carteira` usam.

---

## 9. Como um usuário START é impedido de ler `asset_analyses` cru

Esta é a propriedade que faz o mascaramento valer alguma coisa: se o START
pudesse consultar a tabela crua, a view seria decorativa.

**A barreira é a RLS, não o GRANT.** E isso é deliberado:

No Supabase, um administrador do produto continua sendo o papel Postgres
`authenticated` — ser admin é uma **linha em `user_roles`**, lida por
`has_role()`, não um papel de banco. E o painel administrativo lê
`asset_analyses` cru direto do navegador
(`src/pages/app/AdminDebug.tsx`, `src/pages/app/AdminSync.tsx`). Revogar
`authenticated` dessa tabela quebraria o Admin.

Então a cadeia é:

1. RLS **habilitada** em `public.asset_analyses` (`pg_class.relrowsecurity`);
2. desde `20260415120000`, a única policy remanescente é
   `"Admins can manage analyses" FOR ALL USING (has_role(auth.uid(),'admin'))`;
3. para qualquer não-admin — START, PRO, SPECIALIST, WEALTH — o `USING`
   avalia **false** e a tabela devolve **zero linhas**;
4. para `anon`, além disso, o próprio GRANT foi revogado na FASE B (de
   `anon` **e** de `PUBLIC`): ele recebe *permission denied* antes mesmo da RLS.

Ou seja: **dois cadeados para o anônimo, um (RLS) para o autenticado
não-admin.** Como a RLS é aqui load-bearing, o preflight da FASE B **aborta**
se `relrowsecurity` estiver false, e a verificação final aborta se alguém
tiver recriado uma policy permissiva (`USING (true)`) de leitura nessa tabela.

### Resultado medido (suíte 04)

| Papel / plano | `SELECT` em `asset_analyses` cru | `assets_market_view` |
|---|---|---|
| anônimo | permission denied | permission denied |
| START | **0 linhas** | vê os ativos, 5 campos + tendência **NULL** |
| PRO | **0 linhas** | 5 campos NULL em ativo SPECIALIST, visíveis em START/PRO; tendência sempre visível |
| SPECIALIST | **0 linhas** | tudo visível |
| ADMIN | acessa (o painel depende disso) | tudo visível |

---

## 10. Rollback da FASE B — funcional, não simétrico

O rodapé da FASE B é um rollback **funcional**: devolve ao frontend ANTIGO as
leituras de que ele dependia, e nada além disso.

**Restaura**: SELECT anônimo em `assets`, `asset_analyses`,
`assets_market_view`, `asset_analyses_gated`; EXECUTE anônimo em
`get_public_assets(text)`; a policy permissiva original de `public.assets`.

**Não restaura, de propósito** (nada no frontend usa): SELECT anônimo em
`asset_highlights`; EXECUTE anônimo em `current_user_market_level`,
`current_user_has_full_market_access`, `can_view_asset_premium` (as duas
assinaturas), `normalize_asset_profile`, `safe_parse_numeric`; e o
privilégio que `PUBLIC` tinha nas tabelas — o acesso volta por GRANT nominal
a `anon`, equivalente na prática e auditável.

Os GRANTs explícitos para `authenticated` criados pela FASE B são **mantidos**:
são os mesmos privilégios que o app já usava, agora nominais em vez de
herdados. Removê-los é que quebraria o app.

---

## 11. Gate final — três pontos fechados

### 11.1 Policies de `asset_analyses`: whitelist, não `qual = 'true'`

Checar só `qual = 'true'` era ingênuo: `USING (auth.uid() IS NOT NULL)`
liberaria a tabela crua para todo usuário logado e passaria batido.

Regra nova: **toda policy PERMISSIVE de leitura (SELECT ou ALL) que alcance
PUBLIC / anon / authenticated precisa ter `has_role(...'admin')` no seu
`USING`**. Qualquer outra aborta a FASE B. Policies RESTRICTIVE ficam de fora
(só restringem), assim como policies limitadas a papéis de serviço.

A FASE B também imprime, via `RAISE NOTICE`, **todas** as policies da tabela
(policyname, permissive, roles, cmd, qual, with_check) no momento da
aplicação — auditoria humana do estado real do banco.

Testado com 5 policies perigosas, todas abortando, e 3 legítimas, nenhuma
falso-positivo.

### 11.2 `search_path` das SECURITY DEFINER

Passou de `SET search_path TO 'public'` para `SET search_path TO 'public', 'pg_temp'`
nas 5 funções SECURITY DEFINER.

Motivo: quando `pg_temp` não é citado, o PostgreSQL o pesquisa **antes de
tudo** para relações — e qualquer usuário logado pode criar tabelas
temporárias. Citá-lo por último inverte essa ordem. `pg_catalog` não precisa
ser citado (é implicitamente o primeiro), e todas as referências do projeto já
são schema-qualificadas (`public.*`, `auth.uid()`), então o search_path não
decide nada de fato — é defesa em profundidade.

A premissa de que `public` é confiável **não é presumida**: a FASE B aborta se
`anon` ou `authenticated` tiver CREATE nesse schema.

### 11.3 `public.assets`: DML mínimo provado

Auditoria exaustiva de `.from("assets")` e `.from("asset_analyses")`:

| Operação | `assets` | `asset_analyses` |
|---|---|---|
| SELECT | AdminAssetHighlightsPanel:81, Admin:119, AdminSync:22, Dashboard:24 | AdminDebug:148,195,199,219, AdminSync:23 |
| DELETE | **AdminSync:567** ("Limpar Banco") | **AdminSync:560** (mesmo botão) |
| INSERT / UPDATE / UPSERT | nenhum no frontend | nenhum no frontend |

Logo: `GRANT SELECT, DELETE TO authenticated` nas duas — o conjunto exato com
consumidor provado. INSERT e UPDATE ficam de fora. Quem controla **quem** pode
apagar continua sendo a RLS (`"Admins can manage assets"`), que esta migration
não toca: um START com DELETE no GRANT não apaga nada, porque nenhuma linha
satisfaz a policy para ele.

### 11.4 Defeito grave encontrado neste gate

Ao apertar os privilégios, a suíte 04 pegou:

```
service_role faz UPDATE -> erro: permission denied for function safe_parse_numeric
```

A FASE A cria um índice de expressão
`asset_analyses (public.safe_parse_numeric(roi2026) DESC)`. O PostgreSQL
avalia essa expressão a cada INSERT/UPDATE e **checa EXECUTE contra o papel que
escreve**. Como a FASE B revoga a função de PUBLIC, `service_role` — que é
quem as Edge Functions do sync usam — perderia o acesso e **a sincronização da
planilha pararia inteira**, silenciosamente, só falhando no próximo cron.

Corrigido com `GRANT EXECUTE ... TO service_role` (condicional à existência do
papel) e uma asserção na verificação final que aborta se ele faltar.

---

### 11.5 Gate de integridade — a ESCRITA no mesmo rigor da leitura

Como `authenticated` recebe DELETE em `assets` e `asset_analyses` (o botão
"Limpar Banco"), o GRANT autoriza a OPERAÇÃO para todo usuário logado e **só a
RLS decide quais linhas ele alcança**. Isso põe a escrita no mesmo patamar de
criticidade da leitura.

A whitelist de policies foi ampliada. Antes olhava só `cmd IN ('SELECT','ALL')`
em `asset_analyses`; agora cobre:

| | antes | agora |
|---|---|---|
| Tabelas | `asset_analyses` | `assets`, `asset_analyses`, `asset_highlights` |
| Comandos | SELECT, ALL | SELECT, INSERT, UPDATE, DELETE, ALL |
| Expressões | só `USING` | `USING` **e** `WITH CHECK` |

**Regra:** toda policy PERMISSIVE que alcance PUBLIC/anon/authenticated precisa
ter `has_role(..., 'admin')` em **todas** as expressões que possui. Policy sem
nenhuma expressão também é tratada como vazamento.

Por que `WITH CHECK` importa: `USING` filtra linhas existentes, `WITH CHECK`
valida o estado novo. Uma policy com `USING (has_role(...admin))` e
`WITH CHECK (true)` ainda deixaria um não-admin gravar. Caso testado e
abortando.

**Exceções deliberadas:** policies RESTRICTIVE (só restringem); policies
limitadas a papéis de serviço; e, em `assets`, a policy de SELECT criada por
esta própria migration (`"Authenticated users can view assets"`) — todo usuário
logado PODE listar ativos; o que ele não pode é ler campos premium (mascarados
na view) nem escrever. A exceção é nominal e vale só para `cmd = 'SELECT'`.

#### Policies consideradas legítimas

| Tabela | Policy | Situação |
|---|---|---|
| `assets` | `"Authenticated users can view assets"` (SELECT, TO authenticated, USING true) | criada por esta migration — exceção nominal |
| `assets` | `"Admins can manage assets"` (ALL, USING has_role admin) | preexistente, não tocada |
| `asset_analyses` | `"Admins can manage analyses"` (ALL, USING has_role admin) | preexistente, não tocada |
| `asset_highlights` | `"Admins can manage highlights"` (ALL, USING has_role admin) | preexistente, não tocada |
| `asset_highlights` | `"Anyone can view highlights"` (SELECT, USING true) | **abortaria** — mas a home não a usa mais e a FASE B revoga o GRANT de anon; se ela ainda existir no banco, a FASE B para e aponta o nome. Decisão consciente: preferimos parar e revisar a remover policy automaticamente. |

#### DELETE real por plano (medido, não inspecionado)

```
ok  START  DELETE em asset_analyses: 0 linhas   |  DELETE em assets: 0 linhas
ok  PRO    DELETE em asset_analyses: 0 linhas   |  DELETE em assets: 0 linhas
ok  SPEC   DELETE em asset_analyses: 0 linhas   |  DELETE em assets: 0 linhas
ok  WEALTH DELETE em asset_analyses: 0 linhas   |  DELETE em assets: 0 linhas
ok  o ativo alvo NÃO foi apagado por nenhum não-admin
ok  ADMIN apaga a análise (passo 1 do Limpar Banco)
ok  ADMIN apaga o ativo  (passo 2 do Limpar Banco)
```

O modelo: **GRANT permite a operação no objeto; a RLS decide as linhas;
somente o Admin encontra linhas elegíveis.**

### 11.6 Gate de CREATE movido para a FASE A

A asserção de `has_schema_privilege(..., 'CREATE')` estava só na FASE B — ou
seja, as funções SECURITY DEFINER eram instaladas ANTES de provar a premissa
que elas próprias documentam. Agora ela é a **primeira coisa** do preflight da
FASE A, antes de qualquer `CREATE OR REPLACE FUNCTION`, e continua repetida na
FASE B como defesa em profundidade.

### 11.7 Precisão sobre "FASE A aditiva"

O arquivo **contém** 6 comandos `REVOKE` — todos de EXECUTE em funções, no
padrão `REVOKE ... FROM PUBLIC` + `GRANT ... TO anon, authenticated` (trocar o
EXECUTE implícito de PUBLIC por concessão nominal auditável). **Zero REVOKE de
tabela ou view.**

Auditoria de quem poderia perder EXECUTE efetivo: nenhuma Edge Function chama
essas funções (as de sync leem `assets`/`asset_analyses` crus com
service_role); nenhum trigger ou função do banco as referencia; as views são
`security_invoker = false` e as RPCs são SECURITY DEFINER, logo executam como o
DONO; e o dono (postgres) nunca perde EXECUTE por REVOKE de PUBLIC.

Redação correta: **a FASE A não fecha nenhum caminho de leitura existente e não
retira acesso funcional de nenhum consumidor** — não "zero REVOKE".

---

## 12. Dívida técnica conhecida (não corrigida — fora do escopo)

- **Histórico de migrations divergente.** `supabase db push` falha com
  `LegacyDbPushMissingLocalError`: 21 versões remotas sem arquivo local.
  Anterior a esta rodada. Por isso as migrations são aplicadas manualmente pelo
  SQL Editor. Corrigir exige `migration repair` + `db pull`, que reescreve a
  tabela de controle em produção.
- **`asset_highlights`** deixou de ser usada (a home calcula o ranking).
  Tabela, dados e painel preservados; o painel exibe aviso de que a lista não
  aparece mais no site.
- **Lint pré-existente**: 800 problemas (678 erros, majoritariamente
  `@typescript-eslint/no-explicit-any`). Esta rodada não adicionou nenhum.
- O número de reviews do schema.org foi alinhado a 500 junto com a contagem de
  usuários (decisão registrada com o cliente).
