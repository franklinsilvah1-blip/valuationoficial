# Relatório de Implementação — Migração para 4 Planos (START/PRO/SPECIALIST/WEALTH)

> Terceira rodada desta tarefa. As duas rodadas anteriores deixaram riscos residuais
> conhecidos (`asset_analyses` aberta para `authenticated`, `useWalletSimulator.ts`
> não migrado, comparações `FREE` espalhadas, grandfathering sem critério de
> evidência, 2 erros de lint novos). Esta rodada eliminou todos eles. Relatório em
> tempo passado, baseado em evidências reais — testes SQL executados contra
> Postgres 15 isolado via Docker, comandos executados de verdade, sem afirmações
> não verificadas.

## 1. Política final de `asset_analyses`

**Fechada por completo para `anon` e `authenticated`.** A policy aberta
`"Authenticated users can view analyses" FOR SELECT TO authenticated USING (true)`
foi removida (não recriada) na migration. A partir de agora, SELECT direto na
tabela crua só é possível para:
- **admin**, via a policy `"Admins can manage analyses" FOR ALL USING (has_role(auth.uid(),'admin'))`, já existente desde `20260225175110` e nunca alterada;
- **service_role**, que sempre bypassa RLS (Edge Functions de sync/backup).

**Testado e confirmado** (não apenas revisado estaticamente — ver seção 13): um
usuário `authenticated` comum (START, PRO grandfathered, SPECIALIST ou WEALTH)
que rode `supabase.from("asset_analyses").select("*")` diretamente recebe **0
linhas**, igual a `anon`. Só o usuário admin de teste recebeu as linhas
completas.

## 2. Migração de `useWalletSimulator.ts`

[src/hooks/useWalletSimulator.ts](src/hooks/useWalletSimulator.ts) tinha 2 queries que liam `asset_analyses` diretamente (a 3ª, de itens da carteira, já selecionava só campos não-premium). Ambas foram migradas para `assets_market_view` (a mesma view gated usada por `/app/mercado`):

- Query de favoritos (linhas ~54-90): trocou `assets` + embed `asset_analyses(*)` por `assets_market_view` achatada — os 4 campos premium (`tendencia`, `carteira`, `recomendacao`, `nota`) agora vêm `null` para quem não tem acesso completo, exatamente como em `/app/mercado`.
- Query de itens da carteira (linhas ~142-160): trocou `assets` + embed por `assets_market_view`, mesmos campos não-premium de antes (`valor`, `roitrim`, `dy2025`, `roi2025`) — nenhuma mudança de comportamento para esses campos.

Nenhum cálculo financeiro (`src/utils/walletCalculations.ts`) foi tocado — só a fonte dos dados brutos mudou. `src/pages/app/Carteira.tsx` (que consome este hook via `AssetCard`) também teve o fallback de plano trocado de `"FREE"` para `"START"` para consistência.

**Consequência**: como este era o único consumidor de usuário comum que ainda dependia da tabela crua, sua migração é o que tornou possível fechar a policy da seção 1 sem quebrar a Carteira.

## 3. Auditoria final de consumidores de `asset_analyses`

| Arquivo | Consulta | Usuário | Situação após fechar a policy |
|---|---|---|---|
| `src/pages/Mercado.tsx`, `Index.tsx` | RPC `get_public_assets` | visitante | ✅ nunca usou a tabela crua |
| `src/pages/app/MercadoApp.tsx` | `assets_market_view` | START/PRO+ | ✅ já migrado (rodada anterior) |
| `src/hooks/useWalletSimulator.ts` | `assets_market_view` | authenticated comum | ✅ migrado nesta rodada (seção 2) |
| `src/pages/app/AdminDebug.tsx`, `AdminSync.tsx` | `asset_analyses` (crua) | **admin** | ✅ funciona — RLS permite só admin via policy `FOR ALL` |
| `src/pages/app/AdminMigration.tsx` | nome da tabela numa lista, sem SELECT | admin | ✅ não é uma consulta real |
| `supabase/functions/sync-google-sheets`, `process-sync-queue`, `backup-database` | `asset_analyses` (crua) | **service_role** | ✅ sempre bypassa RLS |

Confirmado por `grep` completo (`asset_analyses`, `.from("asset_analyses")`, `asset_analyses(`) em `src/` e `supabase/` — nenhum outro arquivo consulta a tabela crua. Todas as rotas `/app/admin/debug`, `/app/admin/sync`, `/app/admin/migration-tool` são gated por `ProtectedRoute requiredPermission="system"`/`"all"` em `src/App.tsx`, que só resolve `true` para admin em `hasPermission()`.

## 4. Resultado: START consultando a tabela crua diretamente

```
SET ROLE authenticated; SET request.jwt.uid = '<uuid de um usuário START>';
SELECT * FROM asset_analyses;
→ 0 linhas
```
Testado de verdade (não é uma previsão) — ver seção 13.

## 5. Resultado: START usando a Carteira

Com `useWalletSimulator.ts` migrado para `assets_market_view`, um usuário START que acesse `/app/carteira` recebe, para os campos premium, exatamente `null` — testado via a mesma view (cenários 8/10 da seção 13, que são a mesma fonte de dados). Nenhuma tela de usuário comum retorna mais os 4 campos premium reais para quem não tem PRO+.

## 6. Auditoria final das ocorrências de `FREE`

Buscas completas (`"FREE"`, `plan ===`, `plan !==`, `old_plan`, `new_plan`) em `src/` e `supabase/functions/` (excluindo migrations históricas, que não foram editadas) encontraram e corrigiram, nesta rodada:

**Escritas incorretas de plano (bugs reais, corrigidos):**
- `src/contexts/AuthContext.tsx` — estado local para usuário deslogado: `"FREE"` → `"START"`.
- `src/components/SignupForm.tsx` — 2 pontos de tracking (Meta Pixel/GTM) usavam `'FREE'` como fallback; e a condição que decide se dispara checkout automático não excluía `"START"` (corrigido: START nunca tenta checkout).
- `src/pages/CadastroObrigado.tsx` — parâmetro de URL `plan` teria fallback `"FREE"`.
- `src/pages/AssinaturaSucesso.tsx` — 2 blocos de tracking de compra usavam preços antigos hardcoded (`R$ 147`/`R$ 297`, da estrutura comercial anterior) e checagem `plan !== "FREE"` sem excluir START; substituídos por `hasFullMarketAccess()` + preço real vindo de `getPlanInfo()`.
- `src/pages/app/Perfil.tsx` — **duplicata completa e desatualizada da grade de planos de `/assinatura`**: injetava um card "FREE" sintético, usava os 5 preços antigos hardcoded (`R$ 49/99/199` mensais, `R$ 147/297/597` trimestrais) e filtrava `dbPlans` excluindo um `plan_code` "FREE" que não existe mais na tabela. Reescrita para usar a mesma fonte central de `/assinatura` (`SELECTABLE_PLANS` + `getPlanInfo` + `subscription_plans`). `handleSubscribe` também não tratava `"START"` (tentaria checkout inválido) — corrigido.
- `supabase/functions/stripe-webhook/index.ts` — a branch `canceled`/`incomplete_expired` de `customer.subscription.updated` ainda escrevia `plan: "FREE"` (a outra branch de cancelamento, `customer.subscription.deleted`, já tinha sido corrigida na rodada anterior; esta segunda ocorrência havia passado despercebida). Corrigida para `"START"`.
- `supabase/functions/force-sync-subscription/index.ts` — **função inteira não migrada nas rodadas anteriores**: tinha seu próprio dicionário `PRODUCT_TO_PLAN` duplicado e escrevia `plan: "FREE"` em 2 pontos. Reescrita para usar `resolvePlanFromStripe()` (fonte única) e escrever `"START"`.
- `supabase/functions/payment-history/index.ts` — dicionário `PRODUCT_TO_PLAN` duplicado (2 usos). Substituído por `resolvePlanFromStripe()`.
- `supabase/functions/stripe-reports/index.ts` — dicionário `PRODUCT_TO_PLAN` duplicado; contagem de usuários "FREE" não incluía START; hierarquia de upgrade/downgrade não tratava START/WEALTH. Reescrito para usar `resolvePlanFromStripe()`, contar `plan IN ('FREE','START')` como gratuitos, e adicionar bucket WEALTH (a partir do banco, já que WEALTH nunca gera assinatura Stripe).

**Leituras/comparações que já existiam e foram estendidas para tratar `FREE` e `START` como equivalentes** (não eram bugs de escrita, mas ficariam desatualizadas se não incluíssem o novo código gratuito): `src/components/CommunityBanner.tsx`, `UserHeader.tsx`, `EditClientDialog.tsx`, `EditPlanDialog.tsx` (também ganhou WEALTH nas opções e removeu FREE/FALE_C_ESPECIALISTA do select, replicando a correção já feita em `EditClientDialog.tsx`), `src/pages/app/Admin.tsx`, `AdminSubscribers.tsx`, `AdminSubscriptionsPanel.tsx`, `AdminUsers.tsx`, `ModeratorDashboard.tsx`, `AdminReports.tsx`, `supabase/functions/check-expiring-plans`, `check-subscription`, `send-push-notification` (segmentação de campanhas — ver seção 8), `send-welcome-email`.

**`src/components/AssetCard.tsx`** e **`src/components/UpgradeModal.tsx`**: `AssetCard` só é usado hoje por `Carteira.tsx` (Mercado público/autenticado já usa `AssetsTable`); seu default de `userPlan` mudou de `"FREE"` para `"START"`. `UpgradeModal` está **órfão** (não importado em nenhum lugar — confirmado por grep) mas foi corrigido mesmo assim (hierarquia de planos e mensagens usando os helpers centrais) para não deixar um componente inconsistente no repositório, ainda que não usado.

**FREE remanescente (justificado, não é regra comercial ativa)**: tipos legados (`LegacyPlanCode` em `planHelpers.ts`), comentários explicativos, badges que exibem histórico de usuários com o valor antigo ainda não resincronizado, e a normalização (`normalizePlanCode`) que precisa reconhecer o valor para tratá-lo como START — todos intencionais e documentados.

## 7. Mapa final dos planos

| Código antigo | Novo (com evidência de pagamento) | Novo (sem evidência) |
|---|---|---|
| `FREE` | — (nunca foi pago) | `START` (lógico, nunca físico) |
| `START` | **`PRO`** (físico, backfill) | `START` (preservado, registrado para revisão) |
| `PRO` | **`SPECIALIST`** (físico, backfill) | `PRO` (preservado, registrado para revisão) |
| `SPECIALIST` | `SPECIALIST` (preservado) | — |
| `TESTE` | `PRO` (lógico) | — |
| `FALE_C_ESPECIALISTA` | `SPECIALIST` (lógico, nível de acesso — nunca vira código comercial WEALTH) | — |

## 8. Segurança do backfill (evidência, não só nome do plano)

Corrigido o problema apontado: a versão anterior promovia **qualquer** `profiles.plan = 'START'/'PRO'` só pelo nome, sem checar se era de fato um assinante pago antigo. A versão atual só promove registros com **evidência real**:

```sql
WHERE plan = 'PRO' AND (plan_start_at IS NOT NULL OR stripe_customer_id IS NOT NULL)
```
(e o equivalente para START → PRO). `plan_start_at` é setado por **todo** checkout Stripe e por **toda** alteração manual via `update-client-plan`/`EditClientDialog`/`EditPlanDialog` — nunca pelo novo `handle_new_user()` (que só grava `plan='START'`, sem `plan_start_at`). Isso significa que um cadastro novo genuinamente gratuito nunca tem essa evidência, mesmo que o backfill fosse (hipoteticamente) executado de novo no futuro.

Registros **sem** evidência não são promovidos — ficam como estão e são inseridos em uma nova tabela `plan_migration_v2_review` (admin-only, RLS) para decisão manual do time, em vez de serem silenciosamente ignorados ou promovidos às cegas. Não foi usado e-mail hardcoded em nenhum critério.

**Testado de verdade** (seção 13): com dados sintéticos simulando 3 assinantes legados **com evidência** (`plan_start_at` preenchido) e 1 usuário START **sem evidência**, o resultado foi exatamente o esperado — os 3 com evidência foram promovidos corretamente (START→PRO, PRO→SPECIALIST, SPECIALIST preservado), e o sem evidência permaneceu STARTe foi registrado em `plan_migration_v2_review`. Idempotência reconfirmada (2 execuções consecutivas, resultado idêntico, sem dupla-promoção).

## 9. Resolver Stripe — fonte única confirmada

Depois desta rodada, `grep` por `PRODUCT_TO_PLAN|PLAN_PRICE_IDS` em `supabase/functions/` (fora de `_shared/`) não retorna mais nenhum resultado — os 2 dicionários duplicados encontrados (`payment-history`, `stripe-reports`) e a função inteira não migrada (`force-sync-subscription`) foram corrigidos. Todas as Edge Functions que resolvem plano a partir de dados do Stripe (`create-checkout`, `stripe-webhook`, `check-subscription`, `force-sync-subscription`, `payment-history`, `stripe-reports`, `update-client-plan`) usam exclusivamente `resolvePlanFromStripe()`/`getCheckoutPriceId()` de `supabase/functions/_shared/planResolution.ts`. Essa função já reconhece: os 3 Product IDs legados (com grandfathering), os 2 Product IDs de TESTE, e os 4 novos Price IDs (PRO/SPECIALIST × mensal/trimestral) assim que as env vars `STRIPE_PRICE_*` forem configuradas — sem precisar editar nenhuma Edge Function individualmente. Não foi possível executar um teste automatizado da função (ambiente sem Deno instalado — `deno --version` não encontrado); a verificação foi por leitura de código.

## 10. Resultado — TypeScript

`npx tsc --noEmit -p tsconfig.app.json` → **sem erros** (saída vazia).

## 11. Resultado — Build

`npm run build` → **sucesso**. Mesmos avisos pré-existentes de sempre (chunk >500kB, import dinâmico vs. estático do cliente Supabase) — nenhum novo.

## 12. Resultado — Lint

- **Antes de qualquer correção desta tarefa (linha de base original)**: 801 problemas.
- **Depois da 2ª rodada** (que introduziu 2 erros novos em `AdminAssetHighlightsPanel.tsx`): 803 problemas.
- **Depois desta rodada**: **800 problemas** (678 erros, 122 avisos) — abaixo até da linha de base original.
- **Erros corrigidos nesta rodada**: os 2 `catch (error: any)` de `AdminAssetHighlightsPanel.tsx` foram substituídos por `catch (error: unknown)` com narrowing seguro (`isPostgrestError`/`getErrorMessage`, sem usar `any` em nenhum ponto). `AdminAssetHighlightsPanel.tsx` agora tem **zero** problemas de lint. Os 2 dicionários Stripe duplicados removidos (`payment-history`, `stripe-reports`) também reduziram código morto/duplicado, sem afetar contagem de lint diretamente.
- **Erros pré-existentes que permanecem** (não introduzidos por esta tarefa, mesmo em arquivos tocados): `@typescript-eslint/no-explicit-any` em blocos `catch`/`logStep` que já existiam antes desta tarefa em arquivos como `useWalletSimulator.ts`, `AssinaturaSucesso.tsx`, `Perfil.tsx`, `Admin.tsx`, `Carteira.tsx`, `force-sync-subscription/index.ts`, `payment-history/index.ts` (1 `any` remanescente em um `.map((payment: any) =>`não relacionado à mudança) e outros — todos seguem o mesmo padrão já estabelecido no resto do projeto (nenhum destes é uma regressão desta tarefa; não foram "zerados" porque isso exigiria refatorar dezenas de arquivos não relacionados ao objetivo da tarefa, fora do pedido).
- **Resultado global**: nenhum aumento — reduziu 1 problema líquido em relação à linha de base original do projeto.

## 13. Testes SQL repetidos (evidência real, não estática)

Ambiente: Postgres 15 em container Docker isolado (`docker run postgres:15`), com um schema equivalente reconstruído manualmente a partir das definições reais lidas nas migrations (não foi possível usar `supabase start`/`db reset` com o histórico completo de 110 migrations — 3 problemas pré-existentes e não relacionados a esta migration impedem isso, documentado na seção 15). A migration `20260415120000_plan_model_v2.sql` foi aplicada, e os 12 cenários pedidos foram executados com `SET ROLE`/`SET request.jwt.uid` simulando cada tipo de usuário:

| # | Cenário | Resultado |
|---|---|---|
| 1 | anon → `asset_analyses` direto | 0 linhas ✅ |
| 2 | START → `asset_analyses` direto | 0 linhas ✅ |
| 3 | PRO (grandfathered) → `asset_analyses` direto | 0 linhas ✅ |
| 4 | SPECIALIST → `asset_analyses` direto | 0 linhas ✅ |
| 5 | WEALTH → `asset_analyses` direto / via view | 0 linhas direto; campos completos via `assets_market_view` ✅ |
| 6 | admin → `asset_analyses` direto | Acesso completo ✅ |
| 7 | service_role (superuser) → `asset_analyses` | Acesso completo (bypassa RLS) ✅ |
| 8 | START via `assets_market_view` | `tendencia/carteira/recomendacao/nota_especialista = null`; `roi2026` visível ✅ |
| 9 | PRO (grandfathered) via `assets_market_view` | Todos os campos completos ✅ |
| 10 | START via Carteira (`useWalletSimulator`) | Mesma fonte do cenário 8 → `null` nos premium ✅ |
| 11 | PRO via Carteira | Mesma fonte do cenário 9 → completo ✅ |
| 12 | visitante via `get_public_assets` | Sem colunas premium na resposta (nem existem no retorno da função) ✅ |

Testes adicionais executados: `get_public_assets` com busca exata (case-insensitive), termo de 1 caractere (retorna vazio), tentativa de wildcard `%`/`P%` (tratado como texto literal, não casou nada indevido); `asset_highlights` com posição duplicada entre 2 ativos diferentes (rejeitado pelo índice único); `get_sales_whatsapp_number()` sem configuração (retorna null) e com configuração (retorna o valor), e leitura direta de `app_config` por `anon` (negada — `permission denied for table app_config`). Migration reaplicada 2x consecutivas sem erro e sem duplicar dados (idempotência).

## 14. Status dos tipos

**TYPES REGENERADOS: NÃO.** `src/integrations/supabase/types.ts` continua **editado manualmente**. Tentativas de regenerar via `supabase gen types typescript --local` falharam porque `supabase start`/`db reset` não completa com o histórico real de 110 migrations (seção 15). Não havia projeto de homologação autorizado disponível neste ambiente para gerar contra um DB real. A edição manual foi conferida linha a linha contra o SQL da migration (nomes de view, argumentos e tipo de retorno das RPCs, nullable, enum, colunas novas de `subscription_plans`, `asset_highlights`) mas **isto não substitui geração real** — comando pendente exato: `supabase gen types typescript --local --schema public` depois de aplicar a migration num ambiente onde `supabase db reset` funcione, ou `supabase gen types typescript --project-id <PROJECT_ID> --schema public` contra homologação.

## 15. Status da migration

Arquivo: [supabase/migrations/20260415120000_plan_model_v2.sql](supabase/migrations/20260415120000_plan_model_v2.sql). Nenhuma migration antiga foi editada. Aplicada e testada com sucesso contra um schema equivalente em Postgres isolado (seção 13), incluindo idempotência genuína (múltiplas execuções). **Não foi aplicada** a nenhum ambiente Supabase real (local, homologação ou produção).

Réplica completa do histórico via `supabase start` continua bloqueada por 3 problemas **pré-existentes e não relacionados** a esta migration (achado já relatado na rodada anterior, reconfirmado): `20260107120404` referencia uma tabela (`tracking_events`) criada só numa migration posterior; `20260225154727` insere UUIDs de usuários reais de produção que não existem num banco local vazio; `20260225175110` falha ao recriar `has_role()`. Isso indica que o histórico de migrations deste repositório nunca foi pensado para replay a partir de um banco vazio — é aplicado incrementalmente contra um banco já existente. Não foi corrigido (fora do escopo: não editar migrations antigas).

## 16. Pendências externas

- 4 price IDs Stripe novos (`STRIPE_PRICE_PRO_MONTHLY/QUARTERLY`, `STRIPE_PRICE_SPECIALIST_MONTHLY/QUARTERLY`) — ainda não existem no Stripe.
- Número de WhatsApp comercial (`app_config.sales_whatsapp_number`) — estrutura pronta (RPC pública restrita, painel admin com validação/normalização/limpeza), nenhum número real configurado.
- `supabase gen types` real pendente (seção 14).
- Réplica completa do histórico de migrations via `supabase db reset` pendente de correção pelo time (dívida técnica pré-existente, fora do escopo desta tarefa).
- Confirmação comercial do mapeamento `TESTE → PRO`.
- Os 5 registros (se houver, em produção) sinalizados em `plan_migration_v2_review` após a aplicação real precisam de decisão manual do time (promover para PRO/SPECIALIST ou manter START).

## 17. Homologação local (Docker + Supabase CLI local)

**Contexto**: não existe hoje projeto Supabase de homologação separado — o único projeto Supabase do ValuationIT (`mbnj***vrg`, "ValuationIT Oficial") é produção real, confirmado pelo responsável do projeto. Decisão explícita: **não criar** um segundo projeto Supabase remoto agora; validar via um ambiente **100% local**, sem nenhuma escrita no projeto remoto. Documentado em [DIAGNOSTICO_AMBIENTE_HOMOLOGACAO.md](DIAGNOSTICO_AMBIENTE_HOMOLOGACAO.md) o raciocínio que levou a essa decisão.

**1. Estratégia local**: stack completo do Supabase local (`supabase start`) — Postgres real + GoTrue (Auth) + PostgREST + Kong + Studio — rodando em containers Docker isolados, num diretório de trabalho temporário fora do repositório (`.../scratchpad/local-homolog/`), nunca vinculado (`supabase link`) ao projeto de produção. Isso permite testar com Auth/PostgREST reais (JWTs verdadeiros por usuário), não apenas simulação de `SET ROLE`.

**2. Schema utilizado**: como o replay completo das 110 migrations históricas continua bloqueado pelos 3 problemas pré-existentes já documentados (seção 15), foi usada uma migration "baseline" (`00000000000001_baseline.sql`) reconstruída manualmente a partir de `src/integrations/supabase/types.ts` e do uso real no código (17 tabelas: `profiles`, `user_roles`, `assets`, `asset_analyses`, `asset_favorites`, `asset_views`, `wallet_simulator`, `wallet_items`, `wallet_movements`, `admin_audit_log`, `subscription_plans`, `app_config` + roles/policies/triggers equivalentes), seguida da migration real e **inalterada** (`20260415120000_plan_model_v2.sql`, copiada byte-a-byte — conferido com `diff`) como segunda migration.

**3. Diferenças conhecidas para produção**: o baseline **não** replica ~29 outras tabelas de produção não relacionadas a planos (`blog_posts`, `tracking_scripts`, `affiliates`, `push_notifications` etc.) — só o necessário para testar o modelo de planos. Isso significa que os testes cobrem com fidelidade tudo que a migration `plan_model_v2` toca, mas não substituem uma validação contra o schema real completo.

**4. Migration aplicada**: sim, `20260415120000_plan_model_v2.sql` sem nenhuma edição (conferido por `diff` contra o arquivo do repositório antes de cada aplicação).

**5. Número de execuções**: aplicada e reaplicada **3 vezes consecutivas** contra o mesmo banco já migrado (via `psql` direto no container, sem `db reset` entre elas) — as 3 sem erro.

**6. Idempotência**: confirmada. `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO UPDATE`, `CREATE TABLE IF NOT EXISTS`/`DROP POLICY IF EXISTS` se comportaram como esperado nas reaplicações — nenhum erro, nenhuma duplicação (`subscription_plans` continuou com exatamente 4 linhas; marcador `plan_migration_v2_grandfather_done` continuou único).

**7. Dados sintéticos**: 13 perfis fictícios (`@example.test`, senha de teste local, nunca dados reais) cobrindo os 13 casos pedidos (FREE legado, START com/sem evidência, PRO com/sem evidência, SPECIALIST, TESTE, FALE_C_ESPECIALISTA, START/PRO/SPECIALIST novos pós-migration, WEALTH, admin) + 29 ativos sintéticos (25 para paginação/busca parcial, 2 com nome ambíguo duplicado, 1 para busca exata (`PETR4`), 1 inativo) + 2 posições de curadoria.

**8. Grandfathering — resultado real** (backfill rodado sobre os dados pré-migration, antes de qualquer usuário "novo" ser criado, replicando a ordem real de um deploy):

| Usuário | Plano antes | Plano depois | Esperado |
|---|---|---|---|
| free-legado | FREE | FREE (normalizado→START) | ✅ |
| start-evid (com `plan_start_at`+`stripe_customer_id`) | START | **PRO** | ✅ físico |
| start-noevid (sem evidência) | START | START (preservado) | ✅ |
| pro-evid (com evidência) | PRO | **SPECIALIST** | ✅ físico |
| pro-noevid (sem evidência) | PRO | PRO (preservado) | ✅ |
| specialist | SPECIALIST | SPECIALIST | ✅ |
| teste | TESTE | TESTE (normalizado→PRO) | ✅ |
| fale-especialista | FALE_C_ESPECIALISTA | FALE_C_ESPECIALISTA (normalizado→SPECIALIST, nunca WEALTH) | ✅ |

**9. Casos em revisão**: `plan_migration_v2_review` recebeu exatamente os 2 usuários sem evidência (`start-noevid`, `pro-noevid`) e nenhum outro — confirmado por contagem antes/depois. Reaplicar a migration com os dados já convertidos **não promoveu de novo** `start-evid`/`pro-evid` (protegido pelo marcador), evitando dupla-promoção (ex.: PRO→SPECIALIST→WEALTH, que nunca deve acontecer).

**10. RLS — bugs reais encontrados e corrigidos na migration**: a execução real (não revisão estática) achou 2 bugs — `asset_highlights` e `plan_migration_v2_review` tinham policy de leitura correta, mas **nenhum `GRANT SELECT`** para `anon`/`authenticated` respectivamente. No Postgres, RLS e GRANT são checagens independentes: sem o GRANT, o PostgREST nega o acesso à tabela **antes** de avaliar a policy — a seção "Ativos em Destaque" da home e a consulta do admin a `plan_migration_v2_review` teriam falhado com "permission denied" em produção, mesmo com a policy certa. **Corrigido na migration** (`GRANT SELECT ON public.asset_highlights TO anon, authenticated;` e `GRANT SELECT ON public.plan_migration_v2_review TO authenticated;`), retestado com sucesso, e o histórico completo (idempotência 3x + grandfathering) foi re-executado do zero com o fix para confirmar que nada mais quebrou.

**11. anon**: `SELECT * FROM asset_analyses` direto → 0 linhas (permission denied, tabela fechada). `get_public_assets()` → máx. 20 sem busca, nunca inclui os 4 campos premium (nem no schema de retorno da função).

**12. START (sem evidência, `start-noevid`)**: via JWT real (login por senha no GoTrue local) → `assets_market_view` retorna `tendencia/carteira/recomendacao/nota_especialista = null`, demais campos (`valor`, `roi2025` etc.) preenchidos.

**13. PRO (`pro-noevid`, permaneceu PRO por não ter evidência)**: mesma view → todos os campos premium preenchidos.

**14. SPECIALIST**: idem PRO, campos completos.

**15. WEALTH**: idem PRO/SPECIALIST, campos completos (confirmado que WEALTH nunca aparece como opção de checkout — `create-checkout` só aceita PRO/SPECIALIST).

**16. admin**: `SELECT * FROM asset_analyses` direto → acesso completo (policy `FOR ALL` de admin). `plan_migration_v2_review` → visível só para admin (RLS filtra corretamente mesmo com o GRANT liberado para `authenticated` em geral — testado com usuário não-admin, retornou vazio).

**17. Mercado**: `get_public_assets` testado exaustivamente — sem busca (20, alfabético), string vazia/espaços (20), código B3 exato (1 resultado, prioridade absoluta), nome exato ambíguo (cai corretamente para busca parcial em vez de retornar 1 errado), nome exato único (1 resultado), busca parcial (máx. 10), 1 caractere sem match exato (vazio), `%`/`_` literais (não enumeram a base — escaped corretamente), termo inexistente (vazio), ativo inativo (nunca aparece). Confirmado também via navegador real (ver item 25): página pública `/mercado` renderizou exatamente 20 ativos, sem nenhuma coluna premium no DOM.

**18. Carteira**: confirmado por grep que `useWalletSimulator.ts` não consulta `asset_analyses` diretamente (usa `assets_market_view`, mesma fonte gated do Mercado autenticado) — os mesmos resultados de mascaramento das seções 12-15 se aplicam automaticamente à Carteira, sem fórmula financeira alterada.

**19. Busca**: coberta no item 17.

**20. Curadoria**: testados via SQL direto (papel `authenticated`) e via PostgREST: inserir 2 posições válidas ✅; posição duplicada → rejeitada pelo índice único `asset_highlights_position_unique` ✅; posição 0 → rejeitada pelo `CHECK (position >= 1 AND position <= 20)` ✅; posição 21 → rejeitada pelo mesmo CHECK ✅; mesmo ativo em 2 posições → rejeitado pela constraint `UNIQUE (asset_id)` ✅; `anon` consegue **ler** (após o fix do GRANT) mas **não escrever** (permission denied em POST) ✅. Rótulo neutro "Ativos do nosso catálogo em ordem alfabética" confirmado quando não há curadoria suficiente.

**21. WhatsApp**: `get_sales_whatsapp_number()` sem configuração → `null` (frontend cairia no fallback `/contato`, código já existente, não re-testado nesta rodada); com um número fictício de teste (`5511999998888`, nunca um número real) configurado → retorna só o número; `anon` tentando ler `app_config` diretamente → negado (`permission denied for table app_config`), confirmando que só o único valor comercial é exposto pela RPC, não a tabela inteira.

**22. Stripe mockado**: não foi possível reexecutar testes automatizados do resolver nesta rodada (ambiente sem Deno instalado, mesma limitação já registrada na seção 9) — a garantia de fonte única (`resolvePlanFromStripe`) já havia sido confirmada por leitura de código e por `grep` (seção 9), não alterada nesta rodada.

**23. Relatórios/notificações**: não re-executados nesta rodada (sem mudança de código nessas Edge Functions desde a validação SQL anterior); a lógica testada na seção 13 (START gratuito não conta como pago, WEALTH não gera MRR automático via Stripe) permanece válida pois não depende do ambiente, só do código já revisado.

**24. Frontend local**: `.env.local` (git-ignored via `*.local`, nunca commitado) apontando exclusivamente para `http://127.0.0.1:54321`. **Achado real durante o teste**: `src/integrations/supabase/client.ts` é um arquivo "gerado" que **hardcoda** a URL/chave de produção diretamente no código — nunca leu `VITE_SUPABASE_*` do `.env`. Ou seja, hoje, mesmo criando um `.env.local`, o app sempre apontaria para produção, porque o arquivo gerado ignora completamente as variáveis de ambiente. Para viabilizar o teste local sem tocar no `.env` de produção, o arquivo foi temporariamente editado para ler de `import.meta.env` com fallback para os valores de produção — **testado, e revertido integralmente ao final** (`git diff` confirma zero alteração líquida neste arquivo). Fica documentado como achado a corrigir de verdade (não nesta tarefa, fora do escopo pedido): as env vars `VITE_SUPABASE_*` já documentadas em `.env.example` estão hoje mortas/sem efeito.

**25. Rede sem produção**: confirmado via DevTools do navegador (console + aba de rede) que, após o fix acima, as chamadas a `/rest/v1/rpc/get_public_assets`, `/rest/v1/asset_highlights` etc. foram para `http://127.0.0.1:54321`, nunca para `*.supabase.co`. Também foi necessário liberar temporariamente `http://127.0.0.1:54321` no `Content-Security-Policy` de `index.html` (que por padrão só permite `connect-src` para `https://*.supabase.co` — bloqueio de segurança correto e **também revertido integralmente** ao final, `git diff` limpo). Login real funcionou (`pro-noevid@example.test`, sessão criada via GoTrue local) e a página pública `/mercado` renderizou os 20 ativos esperados via chamada real à RPC local.

**Limitação honesta**: o ambiente de navegador usado por esta ferramenta (Browser pane sandboxed) bloqueou consistentemente requisições `GET` para `http://127.0.0.1:54321` (mas não `POST` — a RPC pública, que usa POST, funcionou; chamadas `GET` de `.select()` para tabelas, incluindo o dashboard autenticado e a seção "Ativos em Destaque" da home, falharam com `net::ERR_FAILED` mesmo com CSP liberado e com o mesmo `curl`/`fetch` funcionando fora do navegador). Isso impediu confirmar visualmente no navegador o mascaramento de campos premium nas telas autenticadas (Mercado logado, Carteira, Dashboard) — mas essas mesmas checagens **foram** confirmadas com evidência equivalente (ou mais forte, por testar a API diretamente) via `curl` com JWTs reais de cada usuário sintético (itens 11-16 acima). Não é um problema do código da aplicação — é uma limitação do sandbox de rede desta ferramenta de teste.

**26. Tipos**: `npx supabase gen types typescript --local` foi executado com sucesso (1050 linhas geradas), mas **não foi usado para substituir `types.ts`** — o schema local só tem 17 tabelas (reconstrução parcial, item 3) contra 46 objetos no `types.ts` real; substituir apagaria as definições de ~29 tabelas de produção não relacionadas a planos (blog, afiliados, notificações etc.), o que seria destrutivo. Em vez disso, foi feita comparação estrutural direta entre a saída gerada e o `types.ts` atual para cada objeto que a migration toca (`asset_highlights`, `plan_type` enum, `get_public_assets`) — **idênticos**, confirmando que a edição manual está correta. **TYPES REGENERADOS LOCALMENTE: NÃO** (geração funcionou; substituição foi deliberadamente evitada por ser destrutiva contra um schema parcial).

**27. TypeScript**: `npx tsc --noEmit -p tsconfig.app.json` → sem erros.

**28. Build**: `npm run build` → sucesso, mesmos avisos pré-existentes (chunk >500kB).

**29. Lint**: 800 problemas — idêntico à contagem da rodada anterior (seção 12). Nenhum novo erro introduzido pelas correções desta rodada (2 `GRANT` em SQL, não afetam lint de TS/JS).

**30. `git diff --check`**: limpo (só avisos de LF→CRLF em arquivos já modificados em rodadas anteriores, nenhum whitespace error novo).

**31. Zero escrita remota**: confirmado. Todos os comandos `supabase` executados nesta rodada usaram `--local`, ou operaram exclusivamente sobre o projeto temporário `local-homolog` (nunca vinculado via `supabase link` ao projeto real). Nenhum `db push`, `functions deploy`, `secrets set`, `migration repair` ou SQL de escrita foi executado contra `mbnj***vrg`. Nenhuma chamada Stripe (live ou test) foi feita. Nenhum commit, push ou deploy foi realizado. O projeto de produção não foi tocado.

**32. Limitações**: schema local parcial (item 3); sandbox de rede do navegador bloqueou verificação visual de telas autenticadas (item 25); Deno indisponível para reexecutar testes do resolver Stripe (item 22); dados sintéticos, não o volume/diversidade reais de produção (o comportamento do backfill contra os dados reais só será conhecido ao aplicar de fato, e por isso a seção "Casos em revisão" precisa ser conferida manualmente após a aplicação real).

**33. Pendências para produção**: as mesmas da seção 16, mais: aplicar a correção dos 2 `GRANT` faltantes (já está na migration, não requer ação adicional); decidir se/quando criar um projeto de homologação remoto de verdade para uma validação final antes de produção (não foi autorizado nesta tarefa); regenerar `types.ts` contra o schema real (produção ou homologação) quando disponível, já que a comparação estrutural feita aqui cobre só os objetos desta migration, não o schema inteiro.

## Preparação final pré-produção

**1. Correção definitiva de `client.ts`**: [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) tinha URL e chave de produção **hardcoded** e nunca lia `VITE_SUPABASE_*` (achado real da homologação local anterior). Corrigido definitivamente: lê exclusivamente `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, **sem nenhum fallback hardcoded**. Se qualquer uma faltar, lança `throw new Error(...)` imediatamente (fail-fast), com mensagem que nunca inclui o valor das variáveis — um ambiente mal configurado agora quebra visivelmente em vez de cair silenciosamente em produção.

**2. Variáveis utilizadas**: `.env` e `.env.example` já documentam `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_SUPABASE_PROJECT_ID` não é lida por nenhum código ativo (`grep` confirmou zero uso em `src/`) — não é usada pelo `createClient`, mantida apenas como documentação/possível uso futuro, sem risco (não é secreta, é só o project ref). Nenhum valor real foi exibido nesta auditoria — só nomes de variáveis. `.gitignore` já cobre `*.local` (inclui `.env.local`), confirmando que testes locais nunca vazam para o git.

**3. Busca por secrets/URLs hardcoded** (`supabase.co`, `eyJ`, `VITE_SUPABASE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` etc., fora de `node_modules`/`dist`/`valuationit-main/valuationit-main`):
   - **Removido**: a URL e a chave anon de produção hardcoded em `client.ts` (item 1).
   - **Achado, não relacionado ao ValuationIT, fora de escopo — apenas reportado, não alterado** (conforme instruído): [src/lib/supabase-external.ts](src/lib/supabase-external.ts) tem uma URL (`supabaseapi.atendeflow.com.br`) e uma chave anon **hardcoded** de um projeto Supabase **de terceiros** (integração "AtendeFlow", usada só em `src/pages/AtendeFlowAuth.tsx`) — não é o projeto do ValuationIT (domínio diferente, nunca `*.supabase.co`). Não foi tocado nesta tarefa nem sua chave rotacionada, conforme instruído.
   - **Achado adicional, correção de baixo risco NÃO aplicada (fora do escopo pedido, reportado apenas)**: [src/components/ResourceHints.tsx:79](src/components/ResourceHints.tsx) e [src/pages/app/AdminSync.tsx:457](src/pages/app/AdminSync.tsx) referenciam um project ref `yoazkdmzjibogpxkjseh.supabase.co` **diferente** do ref real de produção (`mbnjjbtllzgatkjtsvrg`) — não é uma chave/secret, é só um hostname; o primeiro é um `<link rel=preconnect>` morto (sem efeito funcional, só perde uma otimização de performance), o segundo é um template SQL de exemplo (`net.http_post`) mostrado ao admin para configurar um cron job — se copiado literalmente, apontaria para o projeto errado. Nenhum dos dois expõe uma chave secreta; ambos são referências desatualizadas de outro projeto. Reportado para correção numa tarefa futura dedicada, não corrigido aqui por estar fora do escopo dos 15 itens pedidos.
   - Nenhuma URL/chave de **produção do ValuationIT** hardcoded permanece em frontend ativo após a correção do item 1.

**4. CSP compatível com desenvolvimento, sem reduzir produção**: [index.html](index.html) mantém o CSP original e restritivo (`connect-src` só permite `https://*.supabase.co`) — **não alterado**. Em vez disso, [vite.config.ts](vite.config.ts) ganhou um plugin Vite novo (`localSupabaseCspDevPlugin`) com `apply: "serve"` — roda **exclusivamente** no dev server (`npm run dev`), nunca em `vite build`; ele injeta `http://127.0.0.1:54321 ws://127.0.0.1:54321` no `connect-src` só na resposta HTML servida em desenvolvimento, sem tocar no arquivo `index.html` do repositório nem no build de produção. Confirmado por teste real (item 5) que o `dist/index.html` gerado por `npm run build` mantém o CSP original, idêntico ao do repositório.

**5. Reexecução mínima (smoke tests) após corrigir `client.ts`**:
   - **Local**: `.env.local` (git-ignored) apontando para um Supabase local recém-iniciado (`supabase start`, mesma estratégia de homologação local já validada). `npm run dev` + navegador real: todas as chamadas de rede observadas foram para `127.0.0.1:54321` (`/auth/v1/user`, `/rest/v1/profiles`); **zero** chamada a `*.supabase.co`; nenhuma violação de CSP no console (confirma que o plugin dev-only funcionou). Ambiente local encerrado e limpo ao final (containers parados, `.env.local`/`.claude` removidos).
   - **Produção configurada (sem deploy)**: `npm run build` usando as variáveis já existentes em `.env` do repositório (aponta para `mbnjjbtllzgatkjtsvrg`, produção real) — **build aprovado**, sem erros; `dist/index.html` gerado com o CSP restritivo original, intacto. Nenhum valor de chave foi exibido em nenhum momento. Nenhum deploy foi feito — o `dist/` gerado foi apagado logo em seguida.

**6. Zero acesso involuntário à produção**: confirmado por dois testes complementares — (a) o smoke test local (item 5) mostrou 100% das chamadas indo para `127.0.0.1`, nunca para produção; (b) o build de produção (item 5) só gera arquivos estáticos localmente, sem nenhuma chamada de rede durante o build em si. Nenhuma escrita foi feita em nenhum projeto Supabase durante esta rodada.

**7. Auditoria read-only de planos reais (produção) — BLOQUEADA, informação faltante**: esta tarefa pediu contagens read-only de `profiles` no projeto `mbnj***vrg` (produção). **Não foi possível executar.** O ambiente desta sessão não tem acesso a uma conexão SQL direta com o banco de produção: não há senha/connection string de banco em `.env`, em nenhuma variável de ambiente do sistema, nem um token de acesso da Management API do Supabase armazenado localmente (verificado em `~/.supabase/`, que só contém telemetria/traces, não credenciais). O Supabase CLI não tem um subcomando genérico de "executar SQL arbitrário" contra o projeto remoto sem uma dessas credenciais. Não tentei contornar essa ausência (ex.: procurar a senha em outros lugares do sistema) — reportando exatamente o que falta, conforme instruído. **Para desbloquear**: fornecer a connection string/senha do Postgres de produção (via `SUPABASE_DB_PASSWORD` ou string completa), ou autorizar `supabase link --project-ref mbnj...vrg` interativo com a senha, ou um token de acesso da Management API com escopo de leitura.

**8. Simulação do backfill (produção) — também bloqueada pela mesma ausência do item 7.** A query exata que precisa ser rodada (só leitura, sem PII, com as contagens pedidas) está pronta e documentada abaixo para quando o acesso for viabilizado:
```sql
-- Contagens por plano/evidência (sem nomes/e-mails/IDs)
SELECT plan::text,
  count(*) FILTER (WHERE plan_start_at IS NOT NULL AND stripe_customer_id IS NULL) AS so_plan_start_at,
  count(*) FILTER (WHERE plan_start_at IS NULL AND stripe_customer_id IS NOT NULL) AS so_stripe_customer_id,
  count(*) FILTER (WHERE plan_start_at IS NOT NULL AND stripe_customer_id IS NOT NULL) AS ambos,
  count(*) FILTER (WHERE plan_start_at IS NULL AND stripe_customer_id IS NULL) AS nenhum,
  count(*) FILTER (WHERE plan_end_at IS NOT NULL AND plan_end_at > now()) AS end_at_futuro,
  count(*) FILTER (WHERE plan_end_at IS NOT NULL AND plan_end_at <= now()) AS end_at_expirado,
  count(*) AS total
FROM public.profiles
GROUP BY plan;

-- Simulação do backfill: ESTA VERSÃO FICOU DESATUALIZADA (usava
-- "plan_start_at IS NOT NULL OR stripe_customer_id IS NOT NULL", critério
-- revisado na rodada seguinte). Não usar — a query correta e atual está na
-- seção "Correção final do grandfathering" abaixo, item 10.
```
**Downgrades previstos pela lógica do backfill: 0** — é uma garantia estrutural do SQL da migration (as `UPDATE` do backfill só promovem para um nível igual ou superior; nunca há um `UPDATE` que reduza `plan`), confirmada por leitura de código e pelos testes locais — não depende dos dados reais de produção, mas a contagem real de quantos registros seriam promovidos/revisados depende do acesso bloqueado no item 7 (query atualizada na seção seguinte).

**9. Avaliação da qualidade da evidência de pagamento — achado real, corrigido nesta rodada (revisado na rodada seguinte — ver seção "Correção final do grandfathering" abaixo)**: revisão de código (não hipótese) encontrou que **3 caminhos de escrita administrativa** carimbavam `plan_start_at`/`stripe_customer_id` mesmo ao rebaixar um usuário para START/FREE (o nível grátis):
   - [supabase/functions/update-client-plan/index.ts](supabase/functions/update-client-plan/index.ts) (branch "atualizar também no Stripe"): sempre gravava `plan_start_at: new Date().toISOString()` e `stripe_customer_id: customerId`, mesmo quando `isNoCheckoutPlan` (downgrade para START/FREE, sem cobrança).
   - [src/components/EditPlanDialog.tsx](src/components/EditPlanDialog.tsx) (branch "alteração administrativa"): mesmo padrão, sempre carimbava `plan_start_at`.
   - [src/components/EditClientDialog.tsx](src/components/EditClientDialog.tsx): mesmo padrão.

   Isso é um **falso-positivo concreto e confirmado** (não hipotético) para a evidência que a migration usava naquele momento (`plan_start_at OR stripe_customer_id`). **Nesta rodada foi corrigido de forma incompleta**: `plan_start_at` foi corretamente limpo ao rebaixar para START/FREE (correção que permanece válida — ver seção seguinte), mas `stripe_customer_id` **também** foi apagado por engano no Edge Function. Isso foi identificado como incorreto na rodada seguinte e revertido — `stripe_customer_id` não deve ser apagado num downgrade (é o identificador do Customer no Stripe, que continua existindo independente do plano atual). Ver a seção "Correção final do grandfathering" para o estado definitivo.

**10. Situação de `plan_migration_v2_review`**: confirmado por leitura do SQL final da migration — RLS habilitada, policy `FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'))` (só admin), **e** `GRANT SELECT ON public.plan_migration_v2_review TO authenticated` (necessário para o PostgREST nem sequer avaliar a policy sem negar de cara — achado da rodada anterior, seção 17 item 10). `anon` não tem GRANT nenhum na tabela (nega antes da RLS). Colunas: `profile_id` (uuid, não é PII por si só sem join), `plan_before` (texto do plano anterior), `reason` (motivo textual, sem dado sensível), `created_at` (timestamp) — nenhum e-mail/nome armazenado diretamente na tabela. Confirmado nos testes locais (seção 17): admin lê, authenticated comum recebe vazio, anon recebe permission denied.

**11. Os 2 `GRANT`s corrigidos — reconfirmados**: `grep` no arquivo final da migration confirma as duas linhas: `GRANT SELECT ON public.plan_migration_v2_review TO authenticated;` (linha 109) e `GRANT SELECT ON public.asset_highlights TO anon, authenticated;` (linha 474). Comportamento (testado na rodada anterior, seção 17): anon lê destaques (✅), anon não escreve destaques (✅, permission denied), authenticated não-admin não vê `plan_migration_v2_review` (✅, RLS retorna vazio mesmo com GRANT), admin vê (✅).

**12. Price IDs Stripe — não criados, apenas confirmados**: o código já espera exatamente `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_QUARTERLY`, `STRIPE_PRICE_SPECIALIST_MONTHLY`, `STRIPE_PRICE_SPECIALIST_QUARTERLY` (confirmado em `supabase/functions/_shared/planResolution.ts`). Nenhum ID foi inventado ou configurado. **Instrução para criação futura no Stripe** (não executada nesta tarefa):
   | Price a criar | Valor | Ciclo | Moeda |
   |---|---|---|---|
   | PRO mensal | R$ 29,90 | Recorrente, mensal | BRL |
   | PRO trimestral | R$ 89,70 | Recorrente, a cada 3 meses | BRL |
   | SPECIALIST mensal | R$ 249,90 | Recorrente, mensal | BRL |
   | SPECIALIST trimestral | R$ 749,70 | Recorrente, a cada 3 meses | BRL |

   Após criados no Stripe (test ou live), os 4 IDs devem ser configurados como *secrets* das Edge Functions com esses nomes exatos — nenhuma outra mudança de código é necessária (o resolver já está pronto para lê-los).

**13. WhatsApp — confirmado como pendência comercial, não bloqueador técnico**: `get_sales_whatsapp_number()` retorna `null` quando não configurado, e `ContactSpecialistDialog.tsx` cai no fallback `navigate("/contato?assunto=...")` nesse caso (não abre nenhum `wa.me` sem destino). Quando configurado, monta a URL `https://wa.me/${digitsOnly}` com o número normalizado (`.replace(/\D/g, "")`). Nenhum número foi inventado. Classificado como configuração comercial pendente (item 16 do relatório), não como falha de sistema.

**14. `types.ts`**: **não substituído.** Continua a versão editada manualmente da rodada anterior (conferida estruturalmente contra a saída de `supabase gen types --local`, seção 17 item 26). A regeneração definitiva só deve ocorrer depois que a migration existir de fato no schema real (produção ou homologação remota), não antes.

**15. TypeScript**: `npx tsc --noEmit -p tsconfig.app.json` → sem erros.

**16. Build**: `npm run build` → sucesso, com `.env` real de produção (sem deploy); `dist/index.html` confirmado com CSP restritivo original intacto.

**17. Lint**: 800 problemas — idêntico às rodadas anteriores. Nenhum erro novo introduzido pelas correções desta rodada (`client.ts`, `vite.config.ts`, `EditClientDialog.tsx`, `EditPlanDialog.tsx`, `update-client-plan/index.ts`).

**18. `git diff --check`**: limpo (só avisos de LF→CRLF pré-existentes, nenhum whitespace error novo).

**Bloqueadores restantes**:
- Acesso de leitura à produção (itens 7/8) — precisa de credencial (senha do Postgres ou token de Management API) que não está disponível neste ambiente.
- Os 4 Price IDs Stripe (item 12) — não criados.
- Número de WhatsApp comercial (item 13) — não bloqueador, mas pendente.
- `types.ts` definitivo (item 14) — pendente de schema real.
- Projeto de homologação remoto real, se decidido criar um antes da produção.

## Correção final do grandfathering

A rodada anterior identificou corretamente que `plan_start_at`/`stripe_customer_id` podiam ser carimbados por engano num downgrade administrativo, mas **corrigiu isso além do necessário**: além de parar de carimbar `stripe_customer_id` num downgrade (correto), o Edge Function `update-client-plan` passou a **apagar** (`null`) um `stripe_customer_id` já existente sempre que o plano virava START/FREE. Isso estava errado — corrigido nesta rodada.

**1. Por que `stripe_customer_id` foi preservado**: `stripe_customer_id` é o identificador do Customer do usuário no Stripe — uma entidade que continua existindo no Stripe independente do plano atual no banco. Apagar essa coluna ao rebaixar alguém para START destruiria a referência a um Customer real que:
- pode ter histórico de pagamentos genuíno (relevante para suporte/auditoria);
- é reaproveitado por um futuro checkout do mesmo usuário (evita criar um Customer duplicado no Stripe);
- é usado pelo customer-portal e por relatórios de pagamento para localizar o histórico correto.

Corrigido em [supabase/functions/update-client-plan/index.ts](supabase/functions/update-client-plan/index.ts): `stripe_customer_id: customerId` é sempre gravado (nunca `null`), inclusive no branch de downgrade para START/FREE — o `customerId` já é resolvido (buscado ou criado) antes desse ponto do código independentemente do plano de destino, então preservá-lo não exige nenhuma chamada Stripe adicional. `plan_start_at` continua sendo limpo (`null`) num downgrade — essa parte da correção da rodada anterior estava certa e não mudou. `src/components/EditClientDialog.tsx` e `src/components/EditPlanDialog.tsx` nunca gravaram `stripe_customer_id` (confirmado por grep) — não precisaram de nenhuma correção neste ponto.

**2. Por que `stripe_customer_id` deixou de ser evidência isolada**: exatamente pelo motivo acima — por sobreviver a cancelamento/expiração/downgrade, `stripe_customer_id IS NOT NULL` não prova que o plano *atual* do usuário é (ou foi) pago; só prova que existiu, em algum momento, uma relação com o Stripe (que pode nunca ter virado uma assinatura paga de fato, ou pode já ter sido cancelada há muito tempo). Usar isso como evidência isolada (ou em combinação `OR` com `plan_start_at`) arriscava promover para PRO/SPECIALIST alguém genuinamente gratuito hoje.

**3. Evidência final utilizada**: [supabase/migrations/20260415120000_plan_model_v2.sql](supabase/migrations/20260415120000_plan_model_v2.sql), seção 1b, revisada — o critério passou a ser exclusivamente `plan_start_at IS NOT NULL`. `stripe_customer_id` foi removido do `WHERE` das duas `UPDATE` de promoção. Nenhum critério novo foi inventado — a mudança foi subtrativa (remover um critério fraco), conforme instruído.

**4. Auditoria completa de `stripe_customer_id`** (grep em `supabase/functions/`, fora de `_shared/`):

   | Arquivo | Uso | Depende da coluna `profiles.stripe_customer_id`? |
   |---|---|---|
   | `create-checkout/index.ts` | `stripe.customers.list({ email })` — resolve o Customer pelo e-mail do usuário, sempre via API do Stripe | **Não** — nunca lê nem grava a coluna |
   | `customer-portal/index.ts` | `stripe.customers.list({ email })` — mesmo padrão, abre o portal para o Customer encontrado por e-mail | **Não** — nunca lê nem grava a coluna |
   | `payment-history/index.ts` | `stripe.customers.list({ email })` — busca histórico de pagamentos do Customer encontrado por e-mail | **Não** — nunca lê nem grava a coluna |
   | `check-subscription/index.ts` | Resolve Customer por e-mail; **grava** `stripe_customer_id` no profile quando encontra uma assinatura válida (linha 186) | Escreve, não lê |
   | `stripe-webhook/index.ts` | **Grava** `stripe_customer_id` em 3 pontos (eventos de assinatura criada/atualizada) | Escreve, não lê |
   | `force-sync-subscription/index.ts` | Resolve Customer por e-mail; **grava** `null` só quando não existe Customer nenhum no Stripe para aquele e-mail (reflete a realidade, não é um bug), e grava o `customerId` real quando existe mas sem assinatura válida | Escreve, não lê |
   | `update-client-plan/index.ts` | Resolve/cria Customer por e-mail; **grava** `stripe_customer_id` sempre (corrigido nesta rodada — nunca mais `null` por causa do plano) | Escreve, não lê |

   **Achado importante**: `grep` por leituras (`select`/`.eq("stripe_customer_id"`) confirma que **nenhum fluxo ativo** (frontend ou Edge Function) **lê** `profiles.stripe_customer_id` do banco — todo fluxo que precisa de um Customer Stripe sempre o resolve de novo via `stripe.customers.list({ email })`. Ou seja, hoje a coluna é **apenas de escrita/registro** (útil para suporte/auditoria manual via SQL, e agora como evidência do grandfathering), não uma dependência funcional de nenhum fluxo de checkout, portal ou histórico — preservá-la corretamente não muda o comportamento de nenhuma tela hoje, mas evita destruir um dado de auditoria real e evita reintroduzir o mesmo problema se um fluxo futuro passar a lê-la diretamente.

**5. Casos enviados à revisão manual**: qualquer `START`/`PRO` sem `plan_start_at`, **mesmo com `stripe_customer_id` preenchido**, vai para `plan_migration_v2_review` em vez de ser promovido ou ignorado — nunca promovido na dúvida, nunca rebaixado.

**6. Resultado dos testes sintéticos (10 casos, ambiente local)**:

   | Caso | `plan_start_at` | `stripe_customer_id` | Resultado |
   |---|---|---|---|
   | START, só `stripe_customer_id` | ausente | presente | **Não promovido** — vai para revisão ✅ |
   | START, só `plan_start_at` | presente | ausente | **Promovido para PRO** ✅ |
   | START, ambos | presente | presente | **Promovido para PRO** ✅ |
   | START, nenhum | ausente | ausente | Não promovido — revisão ✅ |
   | PRO, só `stripe_customer_id` | ausente | presente | **Não promovido** — vai para revisão ✅ |
   | PRO, só `plan_start_at` | presente | ausente | **Promovido para SPECIALIST** ✅ |
   | PRO, ambos | presente | presente | **Promovido para SPECIALIST** ✅ |
   | PRO, nenhum | ausente | ausente | Não promovido — revisão ✅ |
   | Ex-pagante, hoje START (só `stripe_customer_id` remanescente) | ausente | presente | **Não promovido** — vai para revisão, com motivo explicando a ambiguidade ✅ |
   | Nunca pagou | ausente | ausente | Não promovido — revisão ✅ |

   Os 2 casos críticos (`stripe_customer_id` isolado, tanto em START quanto em PRO) **não** geraram promoção automática — exatamente o comportamento exigido. O caso "ex-pagante hoje START" (simula alguém que já pagou no passado mas está corretamente gratuito hoje) também não foi promovido, confirmando que o bug relatado no início desta rodada não se repete mais.

**7. Idempotência**: reconfirmada com o critério revisado — migration aplicada 3 vezes consecutivas sobre os mesmos dados (1ª aplicação dispara o backfill, 2ª e 3ª são no-op por causa do marcador em `app_config`); `plan_migration_v2_review` permaneceu com exatamente 6 linhas (os 6 casos ambíguos dos 10 sintéticos) nas 3 execuções — sem duplicar.

**8. Texto de `plan_migration_v2_review` corrigido**: um bug de texto foi encontrado e corrigido durante o teste — o motivo de "sem evidência nenhuma" dizia sempre "permanecer START gratuito", mesmo para linhas `PRO` (deveria dizer "permanecer PRO"). Corrigido para usar o plano atual dinamicamente. Também foi adicionada a coluna `suggested_plan` (`PRO` ou `SPECIALIST`, conforme o plano atual) para o admin não precisar inferir manualmente qual seria a promoção sugerida a partir de `plan_before`.

**9. Revalidação de `update-client-plan` (por código, sem chamada Stripe real)**:
   - Ao mover um usuário pago para START: `stripe_customer_id` permanece gravado com o valor real (não mais `null`) — confirmado por leitura do código corrigido.
   - Checkout futuro reutiliza o mesmo Customer: `create-checkout` sempre busca por e-mail (`stripe.customers.list`) antes de criar um novo — não depende da coluna do banco, então continua funcionando de qualquer forma; preservar a coluna no banco só melhora a consistência dos dados para auditoria, não é necessário para esse fluxo funcionar.
   - Customer-portal continua funcionando: mesmo padrão de busca por e-mail, não afetado por esta mudança.
   - `payment-history` continua funcionando: mesmo padrão.
   - `check-subscription` não quebra: não foi alterado nesta rodada; continua gravando `stripe_customer_id` normalmente quando encontra uma assinatura válida, e reseta para `START`/`null` (`plan_start_at`/`plan_end_at`) quando não encontra nenhuma — comportamento correto e inalterado.
   - Nenhuma chamada Stripe real foi feita nesta tarefa — validação só por leitura de código e pelos testes SQL locais.

**10. Query read-only atualizada para produção** (substitui a versão desatualizada da seção anterior — ainda não executada, acesso à produção continua bloqueado por falta de credencial, item 7 da seção anterior):
```sql
-- Contagens por plano (sem PII)
SELECT plan::text, count(*) AS total FROM public.profiles GROUP BY plan;

-- Detalhamento de evidência para START/PRO (sem PII)
SELECT plan::text,
  count(*) FILTER (WHERE plan_start_at IS NOT NULL) AS com_plan_start_at,
  count(*) FILTER (WHERE plan_start_at IS NULL) AS sem_plan_start_at,
  count(*) FILTER (WHERE stripe_customer_id IS NOT NULL) AS com_stripe_customer_id,
  count(*) FILTER (WHERE stripe_customer_id IS NULL) AS sem_stripe_customer_id,
  count(*) FILTER (WHERE plan_start_at IS NULL AND stripe_customer_id IS NOT NULL) AS so_stripe_customer_id,
  count(*) FILTER (WHERE plan_end_at IS NOT NULL AND plan_end_at > now()) AS end_at_futuro,
  count(*) FILTER (WHERE plan_end_at IS NOT NULL AND plan_end_at <= now()) AS end_at_expirado,
  count(*) AS total
FROM public.profiles
WHERE plan IN ('START','PRO')
GROUP BY plan;

-- Simulação READ-ONLY da lógica final de grandfathering (critério: só plan_start_at)
WITH promovidos_pro AS (
  SELECT count(*) AS n FROM public.profiles WHERE plan = 'START' AND plan_start_at IS NOT NULL
), promovidos_specialist AS (
  SELECT count(*) AS n FROM public.profiles WHERE plan = 'PRO' AND plan_start_at IS NOT NULL
), revisao_start AS (
  SELECT count(*) AS n FROM public.profiles WHERE plan = 'START' AND plan_start_at IS NULL
), revisao_pro AS (
  SELECT count(*) AS n FROM public.profiles WHERE plan = 'PRO' AND plan_start_at IS NULL
)
SELECT
  (SELECT n FROM promovidos_pro) AS start_promovidos_para_pro,
  (SELECT n FROM revisao_start) AS start_enviados_para_revisao,
  (SELECT n FROM promovidos_specialist) AS pro_promovidos_para_specialist,
  (SELECT n FROM revisao_pro) AS pro_enviados_para_revisao,
  0 AS downgrades; -- garantia estrutural do SQL da migration, não uma medição
```
`admin_audit_log.metadata->>'change_type'` (usado numa query da rodada anterior para tentar identificar downgrades administrativos históricos) **não deve ser usado para inferir dados históricos** — os valores `administrative_downgrade_to_free`/`administrative_wealth_grant`/`stripe` só passaram a ser gravados a partir da correção feita 2 rodadas atrás (`update-client-plan/index.ts`, seção "Blocker 13" do histórico deste relatório); registros de `admin_audit_log` anteriores a essa mudança não têm esse campo preenchido. Isso não compromete a lógica final (que não depende mais de `stripe_customer_id` nem de `admin_audit_log` para decidir promoção), mas invalida a query `possiveis_falsos_positivos` da seção anterior como ferramenta de auditoria histórica confiável — removida desta versão do relatório por esse motivo.

## Grandfathering ajustado aos dados reais de produção

A auditoria READ-ONLY real (fornecida pelo usuário, executada por ele diretamente no SQL Editor de produção — nenhuma consulta foi feita por esta sessão, que continua sem credencial de acesso ao banco de produção) revelou um problema que os testes sintéticos anteriores não cobriam: usar só `plan_start_at IS NOT NULL` promoveria indevidamente assinantes com o período comercial **já encerrado**.

**Dados reais de produção (sem PII — só contagens, fornecidos pelo usuário)**:
```
FREE:       16
START:       5
PRO:          0
SPECIALIST:   1
```
Dos 5 `START`, todos têm `plan_start_at` preenchido, mas:
- **2 vigentes** (`plan_end_at` futuro em relação a 2026-08-12) — ambos com Stripe Customer.
- **3 expirados** (`plan_end_at` já passado) — nenhum com Stripe Customer.

Usar apenas `plan_start_at IS NOT NULL` (critério da rodada anterior) teria promovido **os 5** para PRO — incluindo os 3 já vencidos, concedendo acesso pago permanente e gratuito para uma assinatura que já tinha terminado. Isso está corrigido.

**1. Regra final para START/PRO legado — `plan_end_at` agora faz parte do critério**: [supabase/migrations/20260415120000_plan_model_v2.sql](supabase/migrations/20260415120000_plan_model_v2.sql), seção 1b, revisada. Promoção automática exige as **três** condições simultaneamente:
```sql
plan_start_at IS NOT NULL
AND public.safe_parse_timestamptz(plan_end_at) IS NOT NULL
AND public.safe_parse_timestamptz(plan_end_at) > now()
```
Nenhum critério novo foi inventado além do que a própria tarefa pediu — `plan_end_at` sempre fez parte conceitualmente da ideia de "assinatura vigente"; só não estava sendo checado.

**2. Parsing seguro de `plan_end_at` (achado crítico — `plan_end_at` é `text`, não `timestamptz`, no schema real)**: a auditoria de produção confirmou que `profiles.plan_end_at` é uma coluna `text`, não `timestamptz`. A versão anterior da migration fazia `SELECT plan::text, plan_end_at INTO v_plan, v_end_at` dentro de `current_user_has_full_market_access()` com `v_end_at` declarado `timestamptz` — um cast implícito que **lançaria erro em produção** para qualquer valor vazio ou malformado, derrubando a função inteira (e com ela, a `asset_analyses_gated`/`assets_market_view`, que dependem dela) para esse usuário. Corrigido:
   - Nova função `public.safe_parse_timestamptz(text) RETURNS timestamptz`, `IMMUTABLE`, com bloco `BEGIN...EXCEPTION WHEN OTHERS THEN RETURN NULL`: nunca lança erro, retorna `NULL` para `NULL`/string vazia/valor malformado, e o timestamp correto para qualquer valor válido.
   - Usada em **todos** os pontos que hoje leem `plan_end_at` como data: as duas `UPDATE` de promoção do backfill, a `INSERT` de revisão, e `current_user_has_full_market_access()` (que agora lê `plan_end_at::text` para `v_end_at_raw` e só então chama `safe_parse_timestamptz`).
   - `grep` final confirma: nenhum cast direto (`plan_end_at::timestamptz`) restante em nenhum lugar da migration.
   - O baseline de testes locais (`00000000000001_baseline.sql`, fora do repositório) foi corrigido para declarar `plan_end_at text` (era `timestamptz` por engano nas rodadas anteriores — o que teria mascarado exatamente este bug se não tivesse sido corrigido antes de testar).

**3. START/PRO expirado — desfecho, não revisão ambígua**: registros com `plan_start_at` presente e `plan_end_at` válido mas já no passado **não são promovidos**, permanecem no plano atual, e são registrados em `plan_migration_v2_review` com `reason` começando em `legacy_paid_plan_expired` (motivo textual explica que é o desfecho natural do período contratado, não um rebaixamento indevido) e `suggested_plan` apontando o que teria sido caso estivesse vigente (só para contexto do admin, não uma sugestão de ação).

**4. START/PRO com `plan_end_at` ausente ou inválido — ambíguo, vai para revisão de verdade**: distinto do caso 3 (que já está resolvido), quando `plan_start_at` existe mas `plan_end_at` está `NULL`, vazio, ou não é uma data válida, o `reason` começa em `legacy_start_without_valid_end_date` (ou `legacy_pro_without_valid_end_date`) — nunca presume que ausência de data significa assinatura ativa, exatamente como pedido.

**5. `stripe_customer_id` continua fora do critério de promoção** — não mudou nesta rodada, e os dados reais confirmam por que essa decisão estava certa: os 2 START vigentes têm Stripe Customer, mas os 3 expirados não — uma correlação **observada nos dados atuais**, não uma regra confiável (um Customer pode continuar existindo em qualquer um dos 5 casos, vigente ou não). Usá-lo como atalho seria coincidência, não lógica.

**6. Resultado esperado com os dados reais** (calculado a partir dos números fornecidos, sem executar nada em produção):
```
START total: 5
START → PRO: 2
START expirados → permanecer START: 3
START revisão por data inválida/ausente: 0

PRO → SPECIALIST: 0   (não há PRO real em produção)
PRO revisão: 0

SPECIALIST preservado: 1
FREE preservado (normalização lógica, sem UPDATE físico): 16

Downgrades: 0
```

**7. FREE (16 registros) e SPECIALIST (1 registro)**: nenhuma mudança de comportamento. `FREE` continua tratado como `START` só logicamente (`normalize_plan_code`/`normalizePlanCode`), sem nenhum `UPDATE` físico — nenhuma "estética" foi aplicada aos 16 registros reais. O único `SPECIALIST` real nunca é tocado pelo backfill (`WHERE plan IN ('START','PRO')` não o inclui) e nunca vira `WEALTH` automaticamente.

**8. Testes sintéticos (11 cenários, ambiente local, `plan_end_at text` no schema de teste)**:

   | # | Cenário | Resultado |
   |---|---|---|
   | 1 | START + data futura | **Promovido para PRO** ✅ |
   | 2 | START + data passada | Permanece START, revisão `legacy_paid_plan_expired` ✅ |
   | 3 | START + data nula | Permanece START, revisão `legacy_start_without_valid_end_date` ✅ |
   | 4 | START + data vazia (`''`) | Permanece START, revisão `legacy_start_without_valid_end_date` ✅ |
   | 5 | START + data inválida (texto não-data) | Permanece START, revisão `legacy_start_without_valid_end_date` — **sem crash** (confirma que `safe_parse_timestamptz` funciona) ✅ |
   | 6 | START + Stripe Customer + data passada | Permanece START, revisão — Stripe Customer não salvou da expiração ✅ |
   | 7 | START + sem Stripe + data futura | **Promovido para PRO** — ausência de Stripe Customer não bloqueou a promoção ✅ |
   | 8 | PRO + data futura | **Promovido para SPECIALIST** ✅ |
   | 9 | PRO + data passada | Permanece PRO, revisão `legacy_paid_plan_expired` ✅ |
   | 10 | SPECIALIST vigente | Preservado, nunca entra no backfill ✅ |
   | 11 | Usuário gratuito novo (sem `plan_start_at`) | Permanece START, revisão (sem evidência) ✅ |

   Os cenários 1/7 e 8 confirmam que datas futuras promovem normalmente; os cenários 2/6/9 confirmam que datas passadas nunca promovem, mesmo com Stripe Customer presente; os cenários 3/4/5 confirmam parsing defensivo sem crash; o cenário 10 confirma que `SPECIALIST` nunca é tocado.

   **Teste adicional crítico (item 10 da tarefa)**: usando o cenário 9 (`pro-passado`, `profiles.plan` continua `'PRO'` — nunca é rebaixado fisicamente pelo backfill, só fica marcado para revisão), consultei `assets_market_view` autenticado como esse usuário via JWT real — os 4 campos premium vieram `null`, confirmando que `current_user_has_full_market_access()` **nega acesso premium** mesmo com `profiles.plan = 'PRO'` ainda gravado, porque a função já verificava (antes desta correção, e continua verificando, agora com parsing seguro) o `plan_end_at` da assinatura, não só o valor de `plan`. Testado em paralelo com o cenário 8 (`pro-futuro`, promovido para `SPECIALIST`, `plan_end_at` futuro) — campos premium vieram completos.

   **Achado adicional durante este teste, corrigido**: a primeira versão do parsing seguro tratava `plan_end_at` presente-mas-ilegível (texto malformado, não vazio/nulo) exatamente igual a `plan_end_at` ausente — ou seja, um valor corrompido teria o mesmo efeito prático de uma concessão administrativa permanente, **concedendo acesso premium indevidamente** em vez de negá-lo. Corrigido em `current_user_has_full_market_access()`: as duas situações agora são tratadas de forma diferente — `plan_end_at` genuinamente ausente/vazio continua sendo tratado como "sem expiração conhecida" (preserva concessões administrativas permanentes, ex.: WEALTH), mas `plan_end_at` **presente e ilegível** agora nega o acesso (falha fechada) em vez de conceder. Testado com 2 casos adicionais: `PRO` com `plan_end_at = 'nao-e-uma-data'` → campos premium `null` (negado, correto); `WEALTH` com `plan_end_at = NULL` → campos premium completos (concedido, concessão permanente preservada, sem regressão). Confirma que um PRO/SPECIALIST com assinatura vencida — ou com um valor de expiração corrompido — nunca mantém acesso pago indevidamente só porque `profiles.plan` ainda não foi atualizado, enquanto uma concessão administrativa deliberadamente sem data de expiração continua funcionando normalmente.

**9. Idempotência reconfirmada**: migration aplicada 3 vezes consecutivas sobre os mesmos 11 registros sintéticos — `plan_migration_v2_review` permaneceu com exatamente 7 linhas (os 7 casos não-promovidos) nas 3 execuções, sem duplicar; nenhum caso já promovido (`start-futuro`→PRO, `pro-futuro`→SPECIALIST) foi promovido de novo na reaplicação.

**10. RLS/GRANT/views — spot check (não repetido por completo, conforme instruído)**: confirmado com JWT real que `asset_analyses` cru continua fechado para um usuário START expirado (0 linhas), `plan_migration_v2_review` continua vazio para um PRO não-admin, e `asset_highlights` continua legível por `anon` sem erro de permissão — nenhuma regressão nas correções de GRANT das rodadas anteriores.

**11. Query READ-ONLY final para produção** (ainda não executada — a auditoria de contagens já foi feita manualmente pelo usuário; esta query serve para conferir os números e a simulação completa da lógica final, incluindo o detalhamento de vigência):
```sql
-- Contagens gerais por plano (sem PII)
SELECT plan::text, count(*) AS total FROM public.profiles GROUP BY plan;

-- Simulação READ-ONLY completa da lógica final de grandfathering
WITH classificado AS (
  SELECT
    id, plan::text AS plano,
    plan_start_at IS NOT NULL AS tem_start_at,
    public.safe_parse_timestamptz(plan_end_at) AS end_parsed
  FROM public.profiles
  WHERE plan IN ('START', 'PRO')
)
SELECT
  count(*) FILTER (WHERE plano = 'START') AS start_total,
  count(*) FILTER (WHERE plano = 'START' AND tem_start_at AND end_parsed IS NOT NULL AND end_parsed > now()) AS start_para_pro,
  count(*) FILTER (WHERE plano = 'START' AND tem_start_at AND end_parsed IS NOT NULL AND end_parsed <= now()) AS start_expirados,
  count(*) FILTER (WHERE plano = 'START' AND (NOT tem_start_at OR end_parsed IS NULL) AND NOT (tem_start_at AND end_parsed IS NOT NULL AND end_parsed <= now())) AS start_para_revisao,
  count(*) FILTER (WHERE plano = 'PRO') AS pro_total,
  count(*) FILTER (WHERE plano = 'PRO' AND tem_start_at AND end_parsed IS NOT NULL AND end_parsed > now()) AS pro_para_specialist,
  count(*) FILTER (WHERE plano = 'PRO' AND tem_start_at AND end_parsed IS NOT NULL AND end_parsed <= now()) AS pro_expirados,
  count(*) FILTER (WHERE plano = 'PRO' AND (NOT tem_start_at OR end_parsed IS NULL) AND NOT (tem_start_at AND end_parsed IS NOT NULL AND end_parsed <= now())) AS pro_para_revisao,
  (SELECT count(*) FROM public.profiles WHERE plan = 'SPECIALIST') AS specialist_total,
  (SELECT count(*) FROM public.profiles WHERE plan = 'FREE') AS free_total,
  0 AS downgrades -- garantia estrutural do SQL da migration (nenhum UPDATE reduz plan), não uma medição
FROM classificado;
```
Com os dados reais já fornecidos, o resultado esperado desta query é: `start_total=5, start_para_pro=2, start_expirados=3, start_para_revisao=0, pro_total=0, pro_para_specialist=0, pro_expirados=0, pro_para_revisao=0, specialist_total=1, free_total=16, downgrades=0` — consistente com os testes sintéticos e com o cálculo manual da seção 6.

**12. Validações técnicas**: `npx tsc --noEmit` sem erros; `npm run build` sucesso; `npm run lint` → 800 problemas (idêntico, nenhum novo — esta rodada só alterou SQL); `git diff --check` limpo. `grep` confirma zero cast direto perigoso de `plan_end_at` restante e uso consistente de `safe_parse_timestamptz` em todos os pontos relevantes.

**13. TypeScript não alterado**: confirmado por leitura de código que `new Date(profile.plan_end_at)` (usado em `AuthContext.tsx`, `AdminSubscribers.tsx`, `AdminSubscriptionsPanel.tsx`, `AdminClients.tsx`, `EditClientDialog.tsx`, `EditPlanDialog.tsx`, `check-subscription/index.ts`, `check-expiring-plans/index.ts`) nunca lança exceção em JavaScript mesmo com string inválida — produz `Invalid Date`, e qualquer comparação (`<`, `>`) contra `Invalid Date` retorna `false` (nunca `true`), então esse código já se comporta de forma seguramente conservadora (nunca trata um valor inválido como "ainda vigente" por engano) sem precisar de nenhuma alteração — confirma o comportamento observado, não presumido.

## Preparação Stripe Test

**Stripe Test disponível neste ambiente: NÃO.** Verificado: nenhuma variável `STRIPE_*` em `.env` nem nas variáveis de ambiente do sistema. Nenhuma chave foi buscada em nenhum outro lugar (nem live, nem test) — conforme instruído, isso não bloqueou o restante da tarefa: toda a lógica foi auditada por código e testada com funções puras/mocks, e o passo a passo do Dashboard (seção abaixo) está pronto para quando a chave `sk_test_...` estiver disponível.

**1. Arquitetura Stripe final** — confirmada por leitura completa de [supabase/functions/_shared/planResolution.ts](supabase/functions/_shared/planResolution.ts) e todos os consumidores: fonte única de verdade, nenhum dicionário paralelo. `grep` por `PRODUCT_TO_PLAN`/`PLAN_PRICE_IDS` fora de `_shared/` só retorna `create-checkout/index.ts`, que apenas **importa** `LEGACY_PLAN_PRICE_IDS` de `_shared` (não redeclara nada).

**2. Produtos e preços necessários** (nenhum criado — sem chave disponível):
```
Product: ValuationIT PRO
├── R$ 29,90 / mês        -> STRIPE_PRICE_PRO_MONTHLY
└── R$ 89,70 / 3 meses    -> STRIPE_PRICE_PRO_QUARTERLY

Product: ValuationIT SPECIALIST
├── R$ 249,90 / mês       -> STRIPE_PRICE_SPECIALIST_MONTHLY
└── R$ 749,70 / 3 meses   -> STRIPE_PRICE_SPECIALIST_QUARTERLY
```
Sem Product para START (grátis, sem Stripe) nem para WEALTH (sob consulta, sem checkout automático) — confirmado que nenhum código tenta criar checkout para nenhum dos dois (seções 15/16 abaixo).

**3. Metadata recomendada** (só para quando os objetos forem criados — não é fonte de verdade, o resolver usa exclusivamente Price ID/Product ID): `app=valuationit`, `plan=PRO|SPECIALIST`, `billing_cycle=monthly|quarterly`, `environment=test`. Auxiliar para auditoria manual no Dashboard, nunca lida pelo código.

**4. Env vars esperadas pelo código** (confirmadas em `_shared/planResolution.ts`, sem nenhuma inventada):
```
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_QUARTERLY
STRIPE_PRICE_SPECIALIST_MONTHLY
STRIPE_PRICE_SPECIALIST_QUARTERLY
```

**5. `getCheckoutPriceId`/`resolvePlanFromStripe` — testados de verdade contra o arquivo real**: Deno continua indisponível, então os testes rodaram via `bun` (já instalado neste ambiente) importando o **arquivo real** `_shared/planResolution.ts` com um shim mínimo de `Deno.env.get` (lê de `process.env`) — não uma reimplementação. Price IDs sintéticos usados (`price_test_pro_monthly` etc.), nunca gravados em código de produção. **22/22 testes passaram**:
   - `PRO+monthly → STRIPE_PRICE_PRO_MONTHLY`, `PRO+quarterly → STRIPE_PRICE_PRO_QUARTERLY`, `SPECIALIST+monthly/quarterly` idem — ✅ todos corretos.
   - `PRO` sem `STRIPE_PRICE_PRO_MONTHLY` configurada → lança erro claro, nenhum checkout, nenhum price antigo escolhido — ✅.
   - Os 5 Product IDs legados (`LEGACY_PRODUCT_TO_PLAN`) resolvem exatamente como documentado (START antigo→PRO, PRO antigo→SPECIALIST, SPECIALIST antigo→SPECIALIST, 2 IDs de TESTE→PRO) — ✅.
   - `resolvePlanFromStripe` reconhece tanto `priceId` quanto `productId` (ex.: `price.product`) — testado passando só `productId` — ✅.
   - `priceId` novo desconhecido cai corretamente para `productId` legado quando presente — ✅.
   - `priceId`/`productId` totalmente desconhecidos → retorna `null` (nunca escolhe um plano padrão, nunca rebaixa) — ✅.
   - `LEGACY_PLAN_PRICE_IDS.TESTE` preservado — ✅.

**6. Achado e correção — `resolveCheckoutPriceId` (dentro de `create-checkout/index.ts`) aceitava `billingCycle` inválido silenciosamente**: a lógica era `cycle === "monthly" ? "monthly" : "quarterly"` — qualquer valor que não fosse exatamente `"monthly"` (`undefined`, string vazia, lixo) caía silenciosamente em `"quarterly"` em vez de rejeitar o checkout. Isso violava diretamente o requisito "billing cycle inválido → rejeitado" e "nunca usar fallback silencioso para outro preço". **Corrigido**: agora valida explicitamente `cycle !== "monthly" && cycle !== "quarterly"` e lança `Invalid billing cycle: ${cycle}` nesse caso — nenhum checkout é criado com um ciclo não solicitado pelo cliente. `START`/`WEALTH`/plano inválido continuam corretamente rejeitados com `Invalid plan: ${plan}` (não alterado, já estava certo).

**7. Achado e correção — fallback de `plan_end_at` assumia 90 dias fixos no webhook**: 3 pontos em `stripe-webhook/index.ts` (`checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_succeeded`) usavam `Date.now() + 90 * 24 * 60 * 60 * 1000` como fallback quando o Stripe retornasse `current_period_end` inválido/ausente — um caso raríssimo (nunca observado em operação normal, só uma defesa contra dado malformado), mas que assumia "trimestre = 90 dias" e ignorava o ciclo real (agora existem planos **mensais**, para os quais 90 dias estaria completamente errado). **Corrigido**: nova função `estimatePeriodEndFallback()` em `_shared/planResolution.ts`, que deriva a duração real de `price.recurring.interval`/`interval_count` do próprio item da assinatura (ex.: `interval="month", interval_count=3` → 3 meses reais, não 90 dias fixos); só cai num fallback genérico de 30 dias se nem essa informação estiver disponível. Testado (mesmo script `bun`): fallback mensal ≈ 28-31 dias, trimestral (derivado de `interval_count=3`) ≈ 89-92 dias (não hardcoded), sem-info ≈ exatamente 30 dias — 3/3 ✅. Stripe continua sendo a fonte de verdade em 100% do caminho normal; isso só afeta o caminho de erro.

**8. Ciclo mensal/trimestral — como é salvo**: confirmado por `grep` que **não existe** nenhuma coluna `billing_cycle`/`subscription_interval`/`interval` em `profiles`. O ciclo não é persistido no banco — `payment-history/index.ts` e `stripe-reports/index.ts` leem `sub.items.data[0]?.price?.recurring?.interval` diretamente do Stripe sob demanda, a cada requisição. Isso já satisfaz "Stripe é fonte de verdade do período" sem precisar inventar nenhuma coluna nova.

**9. Webhook — eventos realmente tratados** (confirmado por leitura completa de `stripe-webhook/index.ts`, os nomes reais usados no `switch`, alguns diferentes dos citados na tarefa mas equivalentes): `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` (equivalente a `invoice.paid`), `invoice.payment_failed`.
   - **Nova assinatura PRO/SPECIALIST**: `plan` resolvido via `resolveSubscriptionPlan()` (nunca rebaixa — cai para o plano atual se não reconhecer); `plan_start_at`/`plan_end_at` vêm de `current_period_start`/`current_period_end` do Stripe; `stripe_customer_id` sempre gravado.
   - **`cancel_at_period_end=true`**: confirmado que o código **não trata esse campo diretamente** — e não precisa: enquanto `subscription.status === "active"` (que é o que o Stripe mantém até o período efetivamente terminar, mesmo com cancelamento agendado), o branch `status === "active"` mantém o plano e a `plan_end_at` normalmente. Só quando o Stripe transiciona `status` para `"canceled"`/`"incomplete_expired"` (ao fim do período) é que o branch de reset para `START` dispara. Comportamento correto sem nenhuma mudança de código necessária.
   - **Expiração efetiva**: confirmado — branch `status === "canceled" || status === "incomplete_expired"` reseta `plan="START"`, `plan_start_at=null`, `plan_end_at=null`. Bloqueio de premium não depende dessa atualização acontecer imediatamente — `current_user_has_full_market_access()` (migration) já verifica `plan_end_at` a cada consulta, então mesmo se o webhook atrasar, o acesso já é negado assim que o período expira.
   - **`invoice.payment_failed`**: confirmado que **não altera `profiles.plan`** — só notifica o admin. Nenhuma regra comercial nova inventada; o Stripe eventualmente muda o `status` da subscription (`past_due`/`canceled`), e é essa mudança (via `customer.subscription.updated`) que decide o acesso, não o evento de falha de pagamento isoladamente.
   - **Evento duplicado — achado real, corrigido em duas camadas nesta e na rodada seguinte**: `processAffiliateCommission()` não tinha nenhuma proteção contra reentrega do mesmo webhook pelo Stripe (entrega documentada como "at least once"). Corrigido primeiro com uma checagem em código (`SELECT` antes do `INSERT`). Uma auditoria READ-ONLY real rodada pelo usuário diretamente em produção confirmou **0 duplicidades existentes** em `commissions.stripe_payment_id` até a data da consulta — nenhuma linha foi alterada como consequência disso, só serviu de base para adicionar a proteção definitiva contra duplicatas *futuras*: ver seção "Proteção definitiva contra comissão duplicada" abaixo.

**10. Grandfathering Stripe — CRÍTICO, confirmado estruturalmente seguro**: a migration SQL (`20260415120000_plan_model_v2.sql`) **nunca faz nenhuma chamada Stripe** — o backfill de grandfathering é puro `UPDATE` no Postgres, sem `fetch`/SDK Stripe em lugar nenhum do arquivo (confirmado por leitura completa do SQL). Isso garante estruturalmente que os 2 assinantes `START` reais vigentes (que virarão `PRO` no banco) **não têm** sua assinatura Stripe tocada: preço, produto, cobrança e ciclo continuam exatamente como estavam contratados — só o campo `profiles.plan` muda, refletindo o novo nível de acesso equivalente. Se um webhook futuro chegar para uma dessas assinaturas legadas (ex.: renovação trimestral do price antigo), `resolveSubscriptionPlan()`/`resolvePlanFromStripe()` resolve o `productId` antigo via `LEGACY_PRODUCT_TO_PLAN` (`prod_TMWTUVuAcCM1Qg → PRO`) — ou seja, o webhook **confirma e mantém** o nível `PRO` (a evidência de pagamento continua sendo o mesmo produto legado, resolvido para o mesmo nível de acesso), nunca rebaixa para `START`. Nenhum código foi alterado nesta seção — o comportamento já estava correto, só foi verificado e documentado explicitamente.

**11. Usuários expirados — Stripe atrasado não reativa indevidamente**: confirmado em `force-sync-subscription/index.ts` e `check-subscription/index.ts` que a resolução sempre passa por `stripe.subscriptions.list({ status: "active" })` e, se vazio, por canceladas com `current_period_end` ainda no futuro — nunca reativa só pelo `productId` bater. Um evento atrasado de uma assinatura genuinamente encerrada (`status` não mais `active`, período expirado) não encontra nenhuma subscription válida e cai no branch que preserva/reseta para `START`, nunca promove.

**12. TESTE**: preservado sem alteração. `LEGACY_PLAN_PRICE_IDS.TESTE` continua no resolver; `normalize_plan_code`/`normalizePlanCode` continuam tratando `TESTE → PRO` (lógico, aguardando confirmação comercial, não alterado nesta rodada); nenhum novo Product/Price `TESTE` foi criado ou proposto; `TESTE` continua ausente da UI de `/assinatura`/`/perfil` (confirmado por `grep`, nenhuma referência fora do resolver e dos tipos legados).

**13. WEALTH**: confirmado sem nenhum objeto Stripe — `getCheckoutPriceId`/`resolveCheckoutPriceId` nem aceitam `"WEALTH"` como plano (tipo `CheckoutPlan = "PRO" | "SPECIALIST"`, e a validação em runtime rejeita explicitamente). CTA é sempre `ContactSpecialistDialog`/`/contato`. `plan_end_at = null` continua representando concessão administrativa permanente, sem expiração automática (comportamento de `current_user_has_full_market_access()`, não alterado).

**14. Afiliados**: confirmado que `amountPaid = session.amount_total / 100` (valor real cobrado no checkout, em centavos convertido) — nunca um preço hardcoded. `commissionAmount = (amountPaid * affiliate.commission_rate) / 100` — `commission_rate` lido do registro do afiliado, não alterado nem um novo percentual inventado. Proteção contra evento duplicado adicionada (item 9). Nenhuma mudança na lógica de cálculo de comissão.

**15. `/assinatura`**: confirmado — START sem checkout (navega para dashboard), WEALTH sem checkout (abre diálogo de contato), PRO/SPECIALIST enviam `{ plan, cycle, affiliateCode }` para `create-checkout` (nunca um preço) — a Edge Function é quem escolhe o Price ID via `getCheckoutPriceId`. Preços exibidos (R$ 29,90/89,70/249,90/749,70) vêm de `getPlanInfo()`/`subscription_plans`, já confirmados em rodadas anteriores.

**16. `/app/perfil`**: mesmo padrão confirmado — START e WEALTH bloqueados antes de qualquer chamada a `create-checkout`, mesmo formato de payload (`plan`/`cycle`).

**17. Testes puros sem Stripe real**: ver item 5 — 22 casos cobrindo os 4 novos preços, os 5 IDs legados, `TESTE`, ID desconhecido (price e product), billing cycle ausente/inválido implicitamente coberto pela correção do item 6, e env var ausente. Todos os Price IDs de teste usados são sintéticos (`price_test_*`), nunca gravados fora deste script temporário (não commitado, vive só no scratchpad da sessão).

**18/19. Stripe Test não disponível — passo a passo para criação manual pelo Dashboard**:
   1. Acessar https://dashboard.stripe.com/test/products (confirmar que o toggle "Test mode" está ativo no canto superior — nunca criar em modo Live).
   2. Criar **Product** "ValuationIT PRO" (sem descrição obrigatória; metadata opcional: `app=valuationit`, `plan=PRO`, `environment=test`).
   3. Dentro desse Product, criar 2 **Prices**: recorrente mensal R$ 29,90 BRL, e recorrente a cada 3 meses R$ 89,70 BRL (usar "Custom" no campo de recorrência → "Every 3 months").
   4. Criar **Product** "ValuationIT SPECIALIST" (mesmo padrão de metadata com `plan=SPECIALIST`).
   5. Dentro desse Product, criar 2 **Prices**: recorrente mensal R$ 249,90 BRL, e recorrente a cada 3 meses R$ 749,70 BRL.
   6. Copiar os 4 IDs gerados (formato `price_...`) e mapear exatamente assim:
      - Price mensal de PRO → `STRIPE_PRICE_PRO_MONTHLY`
      - Price trimestral de PRO → `STRIPE_PRICE_PRO_QUARTERLY`
      - Price mensal de SPECIALIST → `STRIPE_PRICE_SPECIALIST_MONTHLY`
      - Price trimestral de SPECIALIST → `STRIPE_PRICE_SPECIALIST_QUARTERLY`
   7. Não é necessário fornecer a secret key para este passo — a criação pelo Dashboard não exige nenhuma chave de API. A secret key só será necessária depois, para configurar os *secrets* das Edge Functions (fora do escopo desta tarefa) e para testes de checkout ponta a ponta.

**Objetos TEST criados nesta tarefa: NENHUM** (sem chave disponível, conforme regra).

**20. Query read-only com `safe_parse_timestamptz` — não executada em produção**: confirmado, nenhuma consulta foi feita ao SQL Editor de produção nesta rodada (o foco foi exclusivamente Stripe). Os números da auditoria anterior (FREE 16, START 5 [2 vigentes/3 expirados], PRO 0, SPECIALIST 1) continuam sendo a referência válida.

**21. Validações técnicas**: `npx tsc --noEmit` sem erros; `npm run build` sucesso; `npm run lint` → 800 problemas (idêntico, nenhum novo — as correções desta rodada foram em Edge Functions/`_shared`, fora do escopo do `tsconfig.app.json`/ESLint do frontend, mas verificadas por leitura + pelos 22 testes via `bun`); `git diff --check` limpo.

**Pendências**: os 4 Price IDs reais (aguardando criação pelo Dashboard ou autorização de chave test); configurar os 4 IDs como *secrets* das Edge Functions quando existirem (não feito — fora do escopo, e não seria em produção); testar checkout ponta a ponta contra Stripe Test real assim que a chave estiver disponível; as mesmas pendências já listadas nas seções anteriores (types.ts definitivo, WhatsApp, homologação remota).

## Proteção definitiva contra comissão duplicada

**1. Auditoria real de produção**: o usuário executou a consulta READ-ONLY diretamente no SQL Editor de produção e confirmou **0 duplicidades reais** em `commissions.stripe_payment_id` até a data da consulta. Nenhuma linha existente foi alterada, apagada ou tocada como consequência — a auditoria só confirmou que era seguro adicionar a constraint sem qualquer conflito com dados já gravados.

**2. Índice único parcial adicionado à migration**: [supabase/migrations/20260415120000_plan_model_v2.sql](supabase/migrations/20260415120000_plan_model_v2.sql), nova seção 10b:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS commissions_stripe_payment_id_unique
ON public.commissions (stripe_payment_id)
WHERE stripe_payment_id IS NOT NULL
  AND btrim(stripe_payment_id) <> '';
```
Parcial (não sobre a coluna inteira) deliberadamente: `stripe_payment_id` é nullable e fluxos legados/administrativos podem ter múltiplas comissões com o campo `NULL` ou vazio — um índice único sem o `WHERE` quebraria esses casos. A unicidade só se aplica a pagamentos Stripe reais identificados (texto não nulo e não vazio).

**3. Proteção em código preservada e combinada com a do banco**: `processAffiliateCommission()` (`supabase/functions/stripe-webhook/index.ts`) mantém as duas camadas:
   - **Checagem antecipada** (`SELECT` antes do `INSERT`): cobre o caso sequencial comum (segunda entrega chega bem depois da primeira já ter sido processada) — evita o custo de tentar o `INSERT` e tratar o erro na maioria dos casos.
   - **`UNIQUE` no banco como garantia final contra race condition**: o `INSERT` agora trata explicitamente o código de erro Postgres `23505` (unique_violation) — se ocorrer especificamente por causa de `commissions_stripe_payment_id_unique`, o evento é tratado como "já processado": não lança exceção (não derruba o webhook), não reenvia e-mail de comissão, não altera saldo/totais do afiliado (o `return` acontece antes de qualquer uma dessas ações), e registra um log **informativo** (não um log de erro alarmante) — distinto de qualquer outro erro de banco, que continua sendo logado como `ERROR` e não é escondido.

**4. Testado localmente (ambiente local com Docker, tabelas `affiliates`/`referrals`/`commissions` adicionadas ao baseline de teste, migration real aplicada por cima)**:
   | Cenário | Resultado |
   |---|---|
   | Primeira comissão com `stripe_payment_id = 'pi_test_X'` | Insere normalmente ✅ |
   | Segunda comissão com o mesmo `'pi_test_X'` (sequencial) | Rejeitada pelo índice com erro `23505` (`duplicate key value violates unique constraint "commissions_stripe_payment_id_unique"`) ✅ |
   | `stripe_payment_id` diferente (`'pi_test_Y'`) | Insere normalmente, sem nenhuma interferência do índice ✅ |
   | `stripe_payment_id = NULL` (2x) | Ambas inserem — índice parcial não afeta `NULL`, comportamento legado preservado ✅ |
   | `stripe_payment_id = ''` (string vazia, 2x) | Ambas inserem — índice parcial explicitamente exclui string vazia via `btrim(...) <> ''` ✅ |
   | **Dois `INSERT` verdadeiramente concorrentes** (2 processos `psql` disparados em paralelo com `wait`, mesmo `stripe_payment_id`) | Exatamente 1 dos 2 processos teve sucesso; o outro recebeu `23505` na hora; contagem final = **1 linha** ✅ — confirma que a proteção do banco resolve a corrida mesmo quando o `SELECT` prévio do código não consegue (os dois processos passariam pelo `SELECT` antes de qualquer um commitar o `INSERT`, num cenário real). |

**5. Migration reaplicada 3 vezes** (com os dados de teste já inseridos, incluindo o índice já criado): nenhuma falha nas 3 execuções (`NOTICE: relation "commissions_stripe_payment_id_unique" already exists, skipping` nas reaplicações); índice permanece único (`pg_indexes` confirma só 1 índice `commissions_stripe_payment_id_unique` + a PK, sem duplicação de índice); contagem de linhas em `commissions` permaneceu estável (8) nas 3 reaplicações — nenhuma duplicação de dado introduzida pela migration em si.

**6. Cálculo de comissão — não alterado**: `commissionAmount = (amountPaid * affiliate.commission_rate) / 100`, com `amountPaid` vindo de `session.amount_total / 100` (valor real cobrado no Stripe) e `commission_rate` lido do registro existente do afiliado — confirmado inalterado, nenhum percentual novo inventado.

**7. Validações técnicas**: `npx tsc --noEmit` sem erros; `npm run build` sucesso; `npm run lint` → 800 problemas (idêntico, nenhum novo); `git diff --check` limpo.

## Rollout de produção

**1. Preflight**: confirmado antes de qualquer ação — branch `main`, remote `origin` correto, `git diff --check` limpo, nenhum secret/`.env.local`/`dist`/scratchpad no `git status`.

**2. Stripe LIVE**: os 4 Prices foram confirmados manualmente pelo responsável no Dashboard Stripe (LIVE mode, não Test), com valores/ciclos batendo exatamente com a estrutura comercial (PRO R$29,90 mensal/R$89,70 trimestral, SPECIALIST R$249,90 mensal/R$749,70 trimestral). Não verificado por esta sessão via API (sem chave Stripe disponível neste ambiente) — aceito como evidência suficiente por confirmação manual explícita do responsável.

**3. Backup/ponto de retorno**: backup lógico manual confirmado pelo responsável via Supabase CLI/Session Pooler antes da migration (`roles.sql`, `schema.sql`, `data.sql` — tamanhos informados, conteúdo não solicitado nem exposto nesta conversa).

**4. Preflight de dados reais (pré-migration)**: FREE 16, START 5 (2 vigentes, 3 expirados), PRO 0, SPECIALIST 1 — auditado manualmente pelo responsável no SQL Editor de produção.

**5. Migration aplicada — SUCESSO, manualmente**: [supabase/migrations/20260415120000_plan_model_v2.sql](supabase/migrations/20260415120000_plan_model_v2.sql) foi aplicada pelo responsável via SQL Editor do Supabase (não via `supabase db push`), porque a tentativa de `db push` desta sessão falhou por uma divergência pré-existente entre o histórico local de migrations e a tabela de bookkeeping remota (20 entradas remotas sem arquivo local correspondente — problema anterior a esta migration, não relacionado a ela, e **não corrigido** nesta tarefa por estar fora do escopo autorizado: "não corrigir migrations antigas"). A correção sugerida pela CLI (`supabase migration repair`) não foi executada.

   **Duas correções de schema descobertas na aplicação manual real** (o schema real diverge do que a migration original assumia) e já incorporadas ao arquivo oficial do repositório:
   - `app_config.key` não tem constraint `UNIQUE` compatível com `ON CONFLICT` em produção → reescrito como `INSERT ... WHERE NOT EXISTS`.
   - `subscription_plans.plan_code` idem → reescrito como `UPDATE` das linhas existentes + `INSERT ... WHERE NOT EXISTS` para as que não existem, usando uma CTE `VALUES` única para não duplicar os literais dos 4 planos.
   - Nenhuma constraint nova foi criada só para viabilizar `ON CONFLICT` (deliberado, evita expandir escopo). `ON CONFLICT (id)` de `handle_new_user()` permanece — é sobre `profiles.id`, a chave primária real.
   - `grep` final confirma: nenhum `ON CONFLICT (key)` nem `ON CONFLICT (plan_code)` ativo no arquivo — só o `ON CONFLICT (id)` permitido.
   - Reconfirmado localmente após a correção: aplicação limpa + 3 reaplicações consecutivas sem erro, `subscription_plans` com exatamente 4 linhas (`UPDATE 4 / INSERT 0 0` em cada reaplicação, nunca duplica), marcador de `app_config` com exatamente 1 linha — idempotência preservada com o novo padrão.
   - **Não foi reaplicada em produção** — já está aplicada lá; a revalidação de idempotência foi feita só no ambiente local.

**6. Grandfathering real — VALIDADO**, números confirmados pelo responsável pós-migration:
   | Métrica | Antes | Depois | Esperado | Bate? |
   |---|---|---|---|---|
   | FREE | 16 | 16 | preservado fisicamente, normalizado logicamente para START | ✅ |
   | START | 5 | 3 | 3 expirados permanecem START | ✅ |
   | PRO | 0 | 2 | 2 START vigentes promovidos | ✅ |
   | SPECIALIST | 1 | 1 | preservado, nunca vira WEALTH | ✅ |
   | Marcador `app_config` | — | 1 | grandfathering rodou exatamente uma vez | ✅ |
   | `plan_migration_v2_review` | — | 3 | casos sem evidência vigente registrados para revisão manual | ✅ (número plausível — não foi pedido decompor por motivo; nenhuma correção automática foi feita, conforme instruído) |

   Nenhum downgrade. Nenhuma correção automática dos 3 registros em `plan_migration_v2_review` foi tentada — só reportado, conforme instruído.

**7. Objetos confirmados em produção pelo responsável**: `asset_highlights`, `plan_migration_v2_review`, `assets_market_view`, `commissions_stripe_payment_id_unique`, `safe_parse_timestamptz(text)`, `current_user_has_full_market_access()`, `get_public_assets(text)`, `get_sales_whatsapp_number()` — todos OK.

**8. `stripe_customer_id` dos grandfathered — não alterado**: a migration nunca faz nenhuma chamada Stripe (confirmado por leitura completa do SQL, seção "Preparação Stripe Test" anterior); os 2 START que viraram PRO no banco continuam com o contrato/preço/produto Stripe antigo intacto — só o nível de acesso no ValuationIT mudou.

**9. Secrets Stripe**: os 4 `STRIPE_PRICE_*` estão sendo configurados manualmente pelo responsável no Dashboard (não por esta sessão — uma tentativa de `supabase secrets set` falhou com `"Your account does not have the necessary privileges"`). `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` não foram tocados. Checkout end-to-end fica **pendente** até confirmação de que os secrets foram configurados — não bloqueou o restante do rollout, conforme instruído.

**10. `types.ts` regenerado contra produção real — SIM**: `npx supabase gen types typescript --linked --schema public` funcionou (a mesma sessão de CLI que permitiu `migration list --linked` também permitiu geração de tipos, via conexão real ao Postgres de produção). Comparação estrutural antes de substituir: 46 objetos no arquivo anterior (editado manualmente) → 50 no gerado contra produção real; **zero objetos desapareceram** (`comm -23` vazio — nenhuma tabela antiga sumiu, `blog_posts`/`affiliates`/`commissions`/`referrals`/`push_notifications`/`smtp_config` todos confirmados presentes); os 4 objetos novos que apareceram (`asset_analyses_gated`, `current_user_has_full_market_access`, `normalize_plan_code`, `safe_parse_timestamptz`) são exatamente os que a migration criou e que ainda não tinham sido adicionados manualmente ao arquivo antigo. Arquivo substituído. `npx tsc --noEmit` → **zero erros** contra os tipos reais — confirma que as edições manuais das rodadas anteriores estavam estruturalmente corretas.

**11. Edge Functions deployadas — SIM, todas as 11 alteradas pelo diff**: `create-checkout`, `stripe-webhook`, `check-subscription`, `force-sync-subscription`, `update-client-plan`, `payment-history`, `stripe-reports`, `check-expiring-plans`, `send-push-notification`, `send-welcome-email`, `sync-google-sheets` — cada uma via `supabase functions deploy <nome> --project-ref mbnjjbtllzgatkjtsvrg`, todas retornaram sucesso. `supabase/functions/_shared/planResolution.ts` (novo) é empacotado automaticamente junto de cada função que o importa (bundling do próprio `deploy`, não precisa de deploy separado). Uma tentativa anterior (rodada passada) de deploy tinha sido bloqueada pelo classificador de segurança da sessão; nesta retomada explícita, a mesma operação foi permitida.

**12. Validações técnicas finais**: `npx tsc --noEmit` → 0 erros (contra types.ts real); `npm run build` → sucesso; `npm run lint` → 800 problemas (idêntico, nenhum novo); `git diff --check` → limpo.

**13. `.gitignore`**: adicionada a entrada `supabase/.temp/` (estado local do CLI gerado por `supabase link`/`gen types` — connection strings de sessão, não deve ir para o git; não continha senha em texto plano, mas é lixo de ferramenta, não código do projeto).

**Pendências**: confirmação de que os 4 secrets Stripe foram configurados manualmente (item 9); checkout end-to-end (mensal/trimestral × PRO/SPECIALIST) pendente até essa confirmação; decisão manual sobre os 3 registros em `plan_migration_v2_review`; número de WhatsApp comercial (opcional, fallback `/contato` válido); `TESTE → PRO` aguardando confirmação comercial (não alterado).

## 18. PRONTO PARA PRODUÇÃO: NÃO

Faltam: os 4 price IDs Stripe reais configurados; `types.ts` regenerado contra um ambiente real (produção ou homologação, não apenas comparação estrutural parcial); número de WhatsApp comercial configurado (ou aceitar o fallback para `/contato`); um projeto de homologação remoto real para repetir esta validação (não criado nesta tarefa, por decisão explícita); e revisão manual de qualquer registro que caia em `plan_migration_v2_review` assim que a migration for aplicada de fato.
