# Relatório do Sistema ValuationIT

> Relatório consolidado produzido a partir de análise direta do código-fonte (não há, no projeto, um documento único de arquitetura/onboarding — ver seção 1). Data da análise: 2026-07-30.

## 1. Documentação já existente

Encontrados 9 documentos na raiz do projeto (fora `node_modules` e a pasta duplicada `valuationit-main/valuationit-main/`, que é uma cópia obsoleta do repositório e não deve ser usada como referência):

| Arquivo | Conteúdo | Estado |
|---|---|---|
| [README.md](README.md) | Boilerplate padrão do Lovable, sem informação específica do projeto | Inútil como documentação |
| [AFFILIATES_TECH_DOC.md](AFFILIATES_TECH_DOC.md) | Programa de afiliados completo (schema, edge functions, fluxo de comissão) | **Verificado e atual** — melhor doc do conjunto |
| [CRON_JOBS_SETUP.md](CRON_JOBS_SETUP.md) | Configuração dos 6 cron jobs protegidos por `CRON_SECRET` | Verificado e atual |
| [STRIPE_WEBHOOK_SETUP.md](STRIPE_WEBHOOK_SETUP.md) | Configuração do webhook Stripe | Verificado, atual |
| [WEBHOOK_IMPLEMENTATION_SUMMARY.md](WEBHOOK_IMPLEMENTATION_SUMMARY.md) | Changelog da migração para webhooks | Redundante com o anterior; inconsistência interna (diz "6 tipos de eventos" mas lista e implementa só 5) |
| [ADMIN_NOTIFICATIONS_SETUP.md](ADMIN_NOTIFICATIONS_SETUP.md) | Alertas por e-mail para admin (falhas de webhook/pagamento/sync) | Verificado e atual |
| [BACKUP_SYSTEM_DOCS.md](BACKUP_SYSTEM_DOCS.md) | Arquitetura de backup via GitHub | Template genérico reaproveitável, não descrição exata deste schema |
| [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) | Runbook de migração/disaster recovery | Parcialmente stale — snapshot de 22/02/2026; 24 das 110 migrations são posteriores |
| [SCHEMA_EXPORT.sql](SCHEMA_EXPORT.sql) | Dump de schema (37 tabelas) | **Desatualizado** — faltam pelo menos a tabela `sites` e mudanças de RLS de fev–jul/2026 |
| `.lovable/plan.md` | Plano de uma tarefa pontual (alterar um banner) | Não é documentação, é um ticket |

**Conclusão**: nenhum desses documentos é uma visão geral de arquitetura/onboarding do sistema como um todo — todos são guias de subsistemas específicos (vários bem mantidos, principalmente o de afiliados e o de cron jobs). Não existe uma fonte única de verdade para "como o ValuationIT funciona" de ponta a ponta. Recomenda-se tratar `AFFILIATES_TECH_DOC.md` e `CRON_JOBS_SETUP.md` como referência confiável para seus respectivos tópicos, e este relatório como visão geral consolidada — sem duplicar o que já existe nos dois primeiros.

## 2. Resumo executivo

**ValuationIT não é uma calculadora de valuation de empresas (DCF/WACC/múltiplos).** É uma **plataforma de assinatura de conteúdo de investimentos e acompanhamento de carteira**, com recomendações e notas de "especialista" **inseridas manualmente/importadas de planilha Google Sheets**, não calculadas por um motor no código. Conclusão baseada em busca exaustiva no código-fonte (`src/`) por termos como DCF, WACC, fluxo de caixa descontado, múltiplos, perpetuidade — nenhuma ocorrência encontrada. O único "cálculo" real no sistema é aritmética de carteira (ROI, preço médio, dividend yield) em [walletCalculations.ts](src/utils/walletCalculations.ts) e [movementCalculations.ts](src/utils/movementCalculations.ts).

Stack: React + TypeScript + Vite no frontend, Supabase (Postgres + Auth + 48 Edge Functions) no backend, Stripe para pagamentos, Resend para e-mail, GitHub como destino de backup. Sistema em **produção ativa**, não protótipo — há webhook Stripe funcional, RLS reforçado por várias rodadas de hardening de segurança recentes, e dados reais de assinatura.

## 3. Objetivo e usuários

- **Objetivo**: fornecer aos assinantes acesso a uma base curada de ativos da B3 (ações, BDRs, cripto, ETFs, FIIs, índices, renda fixa) com recomendações/notas de especialista, permitindo simular e acompanhar uma carteira de investimentos.
- **Problema resolvido**: consolidar análises de mercado + gestão de carteira pessoal em uma plataforma paga, com conteúdo (blog, vídeos exclusivos) e um programa de afiliados para aquisição de assinantes.
- **Tipos de usuário** (por `role` em `user_roles` + `plan` em `profiles`):
  - **Usuário comum** (planos FREE/START/PRO/SPECIALIST/FALE_C_ESPECIALISTA) — acesso ao mercado, carteira, histórico, afiliados.
  - **Editor** — acesso a blog/conteúdo (`hasPermission('blog')`).
  - **Moderador** — acesso a relatórios (`hasPermission('reports')`).
  - **Admin** — acesso irrestrito a todo o painel administrativo.
  - Não existe role de banco "affiliate" — afiliado é um estado (tabela `affiliates`, `status`), não um papel de autenticação.
- **Fluxos principais**: cadastro/login → assinatura de plano (Stripe) → uso do mercado/carteira/RMC → indicação via afiliados → administração via painel admin.
- **Estágio**: produção. Não há suíte de testes automatizados (nenhum framework de teste em `package.json`), o que é um risco, mas o sistema está operacional com pagamentos reais, e-mails transacionais e backups automatizados.

## 4. Arquitetura

- **Frontend**: React 18 + TypeScript + Vite 5, roteamento com `react-router-dom` v7 ([src/App.tsx](src/App.tsx)), UI com shadcn/radix + Tailwind, React Query para data-fetching, `react-hook-form` + `zod` para formulários.
- **Backend**: 100% Supabase — Postgres com RLS, Supabase Auth, e 48 Edge Functions (Deno) em [supabase/functions/](supabase/functions).
- **Banco de dados**: Postgres gerenciado pelo Supabase; 110 arquivos de migração em [supabase/migrations/](supabase/migrations); tipos gerados em [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) (fonte de verdade do schema atual, mais confiável que `SCHEMA_EXPORT.sql`).
- **Serviços externos**: Stripe (pagamentos), Resend (e-mail transacional), Google Sheets API (fonte dos dados de ativos/análises), GitHub API (backups e versionamento de código), Cloudflare Turnstile (anti-bot), Web Push/VAPID (notificações).
- **Hospedagem**: indícios fortes de Netlify/Cloudflare Pages (arquivos [public/_redirects](public/_redirects) e [public/_headers](public/_headers) com CSP completo) para o frontend estático; Edge Functions hospedadas na infraestrutura Supabase. Construído originalmente via Lovable (dependência `lovable-tagger`, endpoint `ai.gateway.lovable.dev` liberado no CSP).
- **Variáveis de ambiente**: no frontend, apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` (chaves públicas, sem risco). Nas Edge Functions (nomes apenas, sem valores): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_START/PRO/SPECIALIST`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`, `GITHUB_BACKUP_TOKEN`, `GITHUB_BACKUP_REPO`, `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID/SHEET_NAME/RANGE`, `SMTP_ENCRYPTION_KEY`, `VAPID_PRIVATE_KEY`/`VAPID_PUBLIC_KEY`.
- **Ambientes**: não foi possível confirmar separação formal dev/homolog/produção — não há arquivos `.env.production`/`.env.staging` nem configuração de múltiplos projetos Supabase no repo; aparenta ser um único ambiente de produção.
- **Organização de pastas**: `src/pages` (páginas públicas/marketing), `src/pages/app` (páginas autenticadas, incluindo ~26 telas `Admin*`), `src/components` (componentes reutilizáveis + `ui/` do shadcn), `src/contexts` (Auth, Theme), `src/hooks`, `src/utils`, `src/integrations/supabase` (client + tipos), `supabase/functions` (edge functions), `supabase/migrations` (schema).

## 5. Módulos

| Módulo | Objetivo | Rotas | Tabelas | Status |
|---|---|---|---|---|
| **Auth** | Login/cadastro/2FA/recuperação | `/auth`, `/reset-password` | `profiles`, `user_roles` (via `auth.users`) | Completo |
| **Mercado** | Catálogo de ativos com análises/recomendações | `/mercado`, `/app/mercado` | `assets`, `asset_analyses`, `asset_favorites`, `asset_views` | Completo |
| **Carteira** | Simulador de carteira com ROI/proventos | `/app/carteira` | `wallet_simulator`, `wallet_items`, `asset_favorites` | Completo |
| **RMC** (registro de movimentações) | Lançamento de compra/venda de ativos | `/app/rmc` | `wallet_movements` | Completo |
| **Assinatura/Pagamentos** | Checkout, portal, histórico | `/assinatura*`, `/app/historico` | `profiles`, integração Stripe | Completo |
| **Afiliados** | Indicação com comissão | `/app/afiliado`, painel admin | `affiliates`, `affiliate_clicks`, `referrals`, `commissions` | Completo (ver [AFFILIATES_TECH_DOC.md](AFFILIATES_TECH_DOC.md)) |
| **Blog/Conteúdo** | Blog institucional + vídeos exclusivos | `/blog*`, `/app/conteudos` | `blog_posts`, `blog_authors`, `categories`, `exclusive_videos` | Completo |
| **Notificações Push** | Campanhas segmentadas | painel admin | `push_notifications`, `push_subscriptions`, `notification_groups` | Completo |
| **Sync Google Sheets** | Importa dados de ativos/análises da planilha | painel admin (`/app/admin/sync`) | `sync_logs`, `sync_queue`, `assets`, `asset_analyses` | Completo, com fila e cron |
| **Backups** | Snapshot/restore via GitHub | `/app/admin/backups` | leitura de tabelas críticas, sem tabela própria de backup | Completo |
| **Admin geral** | Gestão de usuários, planos, leads, relatórios | ~26 telas `Admin*.tsx` | várias | Completo |

Regras de negócio, permissões e integrações de cada módulo estão detalhadas nas seções 6, 9 e 10.

## 6. Fluxos principais

- **Cadastro/login**: `SignupForm.tsx` → `supabase.auth.signUp` → trigger `handle_new_user()` cria linha em `profiles` com plano `FREE`. Login por senha (`Auth.tsx:246`, com suporte a 2FA/TOTP) ou magic link (via Edge Function `send-magic-link`, protegida por Cloudflare Turnstile). Recuperação de senha via Edge Function `send-password-recovery-request` (não usa o fluxo nativo do Supabase diretamente), redirecionando para `/reset-password` no evento `PASSWORD_RECOVERY`.
- **Assinatura**: usuário escolhe plano → `create-checkout` cria sessão Stripe → `stripe-webhook` recebe `checkout.session.completed` → atualiza `profiles.plan`/`plan_end_at` → dispara comissão de afiliado (se aplicável) + e-mails de boas-vindas/notificação admin.
- **Consumo de mercado**: `MercadoApp.tsx` lista `assets` com join em `asset_analyses`, filtra por plano do usuário (`fieldVisibility.ts` — usuários FREE têm campos ocultos/bloqueados).
- **Carteira**: usuário favorita um ativo (`asset_favorites`) → aparece em `Carteira.tsx` → preenche preço de compra/quantidade → sistema calcula ROI, proventos, resultado.
- **RMC**: lançamento manual de compra/venda com data, preço e quantidade, usado para histórico de movimentações (distinto do simulador de carteira).
- **Sincronização de dados**: cron `auto-sync-sheets` → dispara `sync-google-sheets` → lê a planilha Google → grava fila (`sync_queue`) → `process-sync-queue` aplica em `assets`/`asset_analyses` → notifica admin via `send-sync-notification`.
- **Cancelamento**: usuário cancela pelo portal Stripe (`customer-portal`) ou preenche pesquisa de cancelamento (`cancellation_feedback`); `stripe-webhook` trata `customer.subscription.deleted`.
- **Backup**: cron `backup-database` gera snapshot para GitHub; `restore-backup` restaura (admin-only); `list-code-versions`/`restore-code-version` versiona e reverte o próprio código-fonte via commits GitHub.
- **Exclusão de conta**: `delete-own-account` (usuário, com confirmação textual "DELETAR") ou `delete-user` (admin exclui terceiro).

## 7. Motor de valuation e cálculos

**Não existe motor de valuation de empresas.** Confirmado por busca exaustiva no código — sem DCF, WACC, múltiplos, valor terminal, taxa de desconto. O nome "ValuationIT" é apenas a marca do produto.

O que existe de fato:

- **Dados de análise** (`asset_analyses`): campos como `recomendacao`, `tendencia`, `nota_especialista`, `preco_justo`, `roi2024/2025/2026`, `dy2025`, `fator_mc` são **importados de uma planilha Google Sheets** via [sync-google-sheets/index.ts](supabase/functions/sync-google-sheets/index.ts) — curados manualmente por analistas, não calculados pelo sistema.
- **Cálculos de carteira** (aritmética simples, não valuation): [src/utils/walletCalculations.ts](src/utils/walletCalculations.ts) e [src/utils/movementCalculations.ts](src/utils/movementCalculations.ts) calculam preço médio, valor investido, ROI %, ROI em R$, dividend yield em R$ e resultado consolidado — usados em `Carteira.tsx` e `RMC.tsx`.
- **Não há testes automatizados** para essas fórmulas (nenhum framework de teste configurado no projeto).
- **Validações**: a importação da planilha passa por validação Zod em `sync-google-sheets`, o que evita gravar linhas malformadas, mas não valida a correção financeira dos dados em si (isso depende do analista que preenche a planilha).

Se a intenção original do produto era ter um motor de cálculo de valuation, ele **não foi implementado** — o que existe é uma curadoria manual replicada no app.

## 8. Banco de dados

Fonte: `src/integrations/supabase/types.ts` (39 tabelas), cruzado com as migrações mais recentes.

| Tabela | Finalidade | Campos-chave |
|---|---|---|
| `profiles` | Perfil + plano do usuário | `id`(=auth.uid), `plan`, `plan_end_at`, `stripe_customer_id` |
| `user_roles` | RBAC | `user_id`, `role` (admin/editor/moderator) |
| `admin_audit_log` | Auditoria de ações admin | `user_id`, `granted_by`, `old_plan`/`new_plan` |
| `assets` | Ativos B3 | `codigo_b3` (UNIQUE), `ticker`, `sector` |
| `asset_analyses` | Dados de análise (importados) | FK 1:1 → `assets`, `recomendacao`, `preco_justo` |
| `asset_favorites`/`asset_views` | Interação do usuário | FK → `assets`, `user_id` |
| `wallet_simulator`/`wallet_items` | Carteira simulada | FK → `assets` |
| `wallet_movements` | Compra/venda (RMC) | `asset_id`, `quantidade`, `valor_por_acao` |
| `affiliates`/`affiliate_clicks`/`referrals`/`commissions` | Programa de afiliados | ver [AFFILIATES_TECH_DOC.md](AFFILIATES_TECH_DOC.md) |
| `subscription_plans` | Catálogo de planos | `plan_code`, `stripe_price_id` |
| `leads` | Captação de leads | `email`, UTMs |
| `blog_posts`/`blog_authors`/`blog_authors_public`/`categories` | Blog | `slug`, `status` |
| `notification_groups`/`push_notifications`/`push_subscriptions` | Push | — |
| `smtp_config` | Remetente de e-mail (senha criptografada AES-256-GCM) | admin-only |
| `app_config` | Config chave/valor | admin-only |
| `sync_logs`/`sync_queue`/`import_jobs` | Fila de sincronização | admin-only |
| `rate_limit_log` | Rate limiting | corrigido em migração recente (era pública) |
| `cancellation_feedback` | Pesquisa de cancelamento | `user_id`, `reason` |
| `exclusive_videos` | Vídeos exclusivos | `youtube_id` |

**Não foi possível confirmar** a existência de uma tabela formal de backup — os backups são feitos como snapshots externos no GitHub, não persistidos em tabela própria.

**Funções/triggers**: `handle_new_user()` (cria profile no signup), `has_role()` (helper de RLS SECURITY DEFINER), `update_updated_at()`, `cleanup_old_rate_limits()`, `request_affiliate_activation()` (RPC), `sync_admin_to_specialist()`, `trigger_process_sync_queue()`, `cleanup_orphaned_syncs()`.

**`SCHEMA_EXPORT.sql` está desatualizado** — falta a tabela `sites` e não reflete as correções de RLS/PII de fev–jul/2026. Usar `types.ts` como referência de schema atual.

## 9. Autenticação e permissões

- Login por senha com 2FA/TOTP opcional; magic link e recuperação de senha via Edge Functions próprias protegidas por Cloudflare Turnstile ([Auth.tsx](src/pages/Auth.tsx)).
- Sessão gerenciada pelo SDK padrão do Supabase (`onAuthStateChange`/`getSession`), sem gestão manual de token.
- Roles (`admin`/`editor`/`moderator`) ficam em `user_roles`; permissões são **hardcoded no frontend** em [AuthContext.tsx](src/contexts/AuthContext.tsx) (`hasPermission`) — admin tem tudo, editor só `blog`, moderator só `reports`; qualquer outra chave de permissão só é liberada para admin.
- Isolamento de dados por usuário é reforçado no banco via RLS (`auth.uid() = user_id`) e não apenas no frontend — importante, pois o frontend sozinho não seria suficiente para segurança.
- Guard de rota central: [ProtectedRoute.tsx](src/components/ProtectedRoute.tsx).

## 10. APIs e integrações

| Serviço | Finalidade | Funções | Env vars (nomes) |
|---|---|---|---|
| Stripe | Pagamentos/assinaturas | create-checkout, customer-portal, check-subscription, stripe-webhook, stripe-reports, payment-history | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` |
| Resend | E-mail transacional | send-*-email, send-admin-notification | `RESEND_API_KEY` |
| Google Sheets | Fonte de dados de ativos/análises | sync-google-sheets, process-sync-queue, auto-sync-sheets | `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID/SHEET_NAME/RANGE` |
| GitHub | Backup e versionamento de código | backup-database, restore-backup, list/restore-code-version | `GITHUB_BACKUP_TOKEN`, `GITHUB_BACKUP_REPO` |
| Cloudflare Turnstile | Anti-bot em auth/contato | send-magic-link, send-password-recovery-request, send-contact-email | `TURNSTILE_SECRET_KEY` |
| Web Push/VAPID | Notificações push | send-push-notification | `VAPID_PRIVATE_KEY`/`VAPID_PUBLIC_KEY` |

Erros são tratados centralmente em `_shared/errors.ts` (mensagens genéricas ao usuário, sem vazar detalhes internos), e logs mascaram PII (`_shared/logger.ts`). Nenhum valor de credencial é exposto neste relatório.

## 11. Relatórios e exportações

- Relatórios de assinatura (12 meses) para admin via `stripe-reports`.
- Histórico de pagamentos do próprio usuário via `payment-history`.
- Relatório mensal de performance de afiliados via `send-monthly-affiliate-report`.
- Sitemap dinâmico via `generate-sitemap`.
- Backups completos exportáveis via `download-backup`/`list-backups` (admin).
- **Não foi possível confirmar** geração de PDF de relatórios de valuation — não há motor de valuation, logo não há esse tipo de relatório.

## 12. Segurança

| Item | Avaliação |
|---|---|
| Isolamento de dados (RLS) | Bom — padrão `auth.uid() = user_id` + bypass via `has_role()`, reforçado por várias migrações recentes de correção |
| **`send-subscription-notification`** | **Risco médio-alto** — única função de e-mail sem checagem de service-role/auth, ao contrário das irmãs; permite disparo anônimo de e-mail com a marca da empresa (vetor de spam/phishing) |
| **`diagnose-sheets`** | **Risco médio** — endpoint sem qualquer autenticação, expõe amostra de dados da planilha de análises proprietária |
| `update-client-plan` | Risco baixo — auth correta, mas sem rate limit (diferente das funções irmãs) |
| Ações destrutivas (delete-user, restore-backup, restore-code-version) | Verificadas com checagem de admin + log em `admin_audit_log` |
| Senhas SMTP | Criptografadas AES-256-GCM, nunca retornadas ao frontend |
| CSP/headers | Bem configurados em `public/_headers` |
| Testes automatizados | **Ausentes** — nenhum framework de teste no projeto |

## 13. Estado atual da implementação

- **Concluído**: auth completo com 2FA, mercado, carteira, RMC, assinatura Stripe, afiliados, blog, push, sync de planilha, backups, painel admin extenso.
- **Divergência de doc**: `WEBHOOK_IMPLEMENTATION_SUMMARY.md` afirma 6 tipos de evento Stripe tratados; código trata 5.
- **Riscos técnicos**: ausência de testes automatizados; duas falhas de autenticação identificadas na seção 12; `SCHEMA_EXPORT.sql` desatualizado se usado para restauração.
- **Pasta duplicada** `valuationit-main/valuationit-main/` no repositório — parece artefato de import/export do Lovable, não é usada pelo app e não deve ser confundida com o código ativo.
- Não foram encontrados comentários TODO/FIXME relevantes pendentes (apenas 1 comentário informativo em `Carteira.tsx:39`).

## 14. Execução, build e deploy

Baseado em `package.json`:
```bash
npm install
npm run dev      # servidor de desenvolvimento (porta 8080)
npm run build    # build de produção (Vite)
npm run build:dev
npm run lint
npm run preview
```
Requer as 3 variáveis `VITE_SUPABASE_*` em `.env`. Não há scripts de seed/migration no `package.json` — migrações são aplicadas via Supabase CLI/dashboard usando os arquivos em `supabase/migrations/`. Deploy do frontend aparenta ser via Netlify/Cloudflare Pages (arquivos `_redirects`/`_headers`); Edge Functions são deployadas separadamente na infraestrutura Supabase (não confirmado no repo como, provavelmente via Supabase CLI/dashboard).

## 15. Problemas e riscos encontrados

1. **`send-subscription-notification` sem autenticação** — corrigir adicionando a mesma checagem de service-role usada nas funções irmãs.
2. **`diagnose-sheets` sem autenticação** — restringir a admin como em `check-sheet-rows`.
3. **`SCHEMA_EXPORT.sql` desatualizado** — não usar para decisões de segurança/restauração sem revalidar contra migrações recentes.
4. **Ausência de testes automatizados** para os cálculos financeiros de carteira.
5. **`README.md` genérico** — não orienta um novo desenvolvedor.

## 16. Recomendações (prioridade)

1. Corrigir os dois endpoints sem autenticação (seção 12/15).
2. Regenerar `SCHEMA_EXPORT.sql` a partir do schema atual.
3. Escrever um README real de onboarding técnico (pode reaproveitar este relatório como base).
4. Adicionar testes unitários para `walletCalculations.ts`/`movementCalculations.ts`.
5. Adicionar rate limit em `update-client-plan`.

## 17. Mapa de arquivos relevantes

- Rotas/guards: [src/App.tsx](src/App.tsx), [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx)
- Auth: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx), [src/pages/Auth.tsx](src/pages/Auth.tsx)
- Módulos core: [src/pages/app/MercadoApp.tsx](src/pages/app/MercadoApp.tsx), [src/pages/app/Carteira.tsx](src/pages/app/Carteira.tsx), [src/pages/app/RMC.tsx](src/pages/app/RMC.tsx)
- Cálculos: [src/utils/walletCalculations.ts](src/utils/walletCalculations.ts), [src/utils/movementCalculations.ts](src/utils/movementCalculations.ts)
- Schema atual: [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts)
- Edge functions críticas: [supabase/functions/stripe-webhook/index.ts](supabase/functions/stripe-webhook/index.ts), [supabase/functions/sync-google-sheets/index.ts](supabase/functions/sync-google-sheets/index.ts)

## 18. Conclusão

O ValuationIT é uma plataforma de assinatura de conteúdo de investimentos e gestão de carteira em **produção**, tecnicamente madura em pagamentos, afiliados e segurança de dados (RLS bem implementado, hardening recente ativo), mas **não contém um motor de valuation** apesar do nome — as análises são curadas manualmente via planilha. Principais lacunas: dois endpoints sem autenticação, ausência de testes automatizados, e documentação fragmentada (embora os documentos de afiliados e cron jobs sejam de boa qualidade). Recomenda-se corrigir os dois achados de segurança antes de qualquer outra prioridade.
