

## Diagnóstico Completo da Migração

### Estado Atual do Banco

**Dados presentes (OK):**
- 18 perfis em `profiles`
- 598 ativos + 598 análises em `assets`/`asset_analyses`
- 10 carteiras, 28 itens, 34 movimentações
- 2 admins em `user_roles` (Douglas + Franklin)
- 5 planos de assinatura, 5 categorias, 4 blog authors, 3 blog posts
- 5 afiliados, 1 grupo de notificação, 1 SMTP config
- `app_config`: VAPID key, WhatsApp link, admin_email -- tudo correto

**Problemas Críticos Identificados:**

1. **auth.users está VAZIO** -- Nenhum usuário existe na tabela de autenticação. Ninguém consegue fazer login.
2. **Nenhuma trigger/function existe** -- `handle_new_user`, `has_role`, `request_affiliate_activation` estão ausentes.
3. **RLS desabilitado em TODAS as 39 tabelas** -- O banco está completamente aberto.
4. **Nenhuma RLS policy existe** -- Zero políticas de segurança.
5. **Nenhum enum `app_role` existe** -- Os tipos necessários para o sistema de roles não foram criados.
6. **Nenhuma foreign key existe** -- As relações entre tabelas foram perdidas.

**Erros de Build (8 erros):**
Todos causados pelo types.ts gerado não ter enums (`app_role`), ter `features` como `string` em vez de array, `metadata` como `string` em vez de `jsonb`, e não ter a function `request_affiliate_activation` registrada.

---

### Plano de Execução (7 etapas)

#### Etapa 1 -- Criar Edge Function para migrar usuários para auth.users
Recriar a edge function `migrate-users` que:
- Lê todos os perfis de `profiles` com email
- Cria cada usuário em `auth.users` preservando o UUID original
- Usa a senha temporária `Valuation@2025`
- Registra resultados no config.toml

#### Etapa 2 -- Criar enums, functions e triggers via migração SQL
Uma migração única que cria:
- **Enum `app_role`**: `('admin', 'editor', 'moderator', 'user')`
- **Function `has_role`**: Security definer para checar roles sem recursão RLS
- **Function `handle_new_user`**: Trigger que cria perfil automaticamente com `ON CONFLICT DO NOTHING`
- **Function `request_affiliate_activation`**: RPC para ativação de afiliados
- **Trigger `on_auth_user_created`**: Liga `handle_new_user` a `auth.users`

#### Etapa 3 -- Habilitar RLS e criar policies em todas as tabelas
Ativar RLS e criar políticas adequadas para cada tabela:
- `profiles`: usuário vê/edita o próprio, admin vê todos
- `user_roles`: apenas leitura via `has_role`, admin gerencia
- `assets`, `asset_analyses`: leitura pública, admin gerencia
- `wallet_*`: usuário vê/edita os próprios dados
- `asset_favorites`, `asset_views`: usuário gerencia os próprios
- `blog_posts`, `blog_authors`, `categories`: leitura pública, admin/editor gerencia
- `app_config`, `smtp_config`, `tracking_scripts`: admin only
- `affiliates`, `commissions`, `referrals`: usuário vê os próprios, admin vê todos
- `admin_audit_log`: admin only
- Tabelas de suporte (`leads`, `push_*`, `notification_*`, `sync_*`, `import_*`, `rate_limit_log`, `cancellation_feedback`, `profile_*`): políticas adequadas por contexto

#### Etapa 4 -- Corrigir schema do banco (colunas com tipos incorretos)
As colunas no banco estão todas como `text` quando deveriam ter tipos corretos. Ajustes necessários:
- `admin_audit_log.metadata`: de `text` para `jsonb` (o código insere objetos JSON)
- `subscription_plans.features`: de `text` para `jsonb` (o código espera `string[]`)
- Adicionar constraints/defaults onde necessário (`id` com `gen_random_uuid()`, `created_at` com `now()`, etc.)

#### Etapa 5 -- Corrigir erros de build no código TypeScript
Após a migração de schema, o types.ts será regenerado automaticamente. Os erros restantes que precisam de correção manual:
- **`useSubscriptionPlans.ts`**: Parsear `features` como JSON string se necessário, ou ajustar o cast
- **`EditClientDialog.tsx` / `EditPlanDialog.tsx`**: Serializar `metadata` como `JSON.stringify()` antes de inserir
- **`AdminBlog.tsx`**: Corrigir a query join `user_roles -> profiles` (não existe foreign key, precisa fazer queries separadas)
- **`AdminClients.tsx` / `AdminUsers.tsx`**: Remover referência a `Database["public"]["Enums"]["app_role"]` e usar tipo string
- **`Afiliado.tsx`**: A function `request_affiliate_activation` precisa ser recriada (etapa 2)

#### Etapa 6 -- Deploy da Edge Function e execução da migração de usuários
- Registrar `migrate-users` no `config.toml`
- Deploy e executar a migração
- Validar que os 18 usuários foram criados em `auth.users`

#### Etapa 7 -- Limpeza e validação final
- Remover edge function temporária `migrate-users`
- Verificar todos os dados: profiles, assets, wallets, blog, affiliates, app_config
- Validar que login funciona com senha `Valuation@2025`
- Confirmar que admins (Douglas/Franklin) têm acesso ao painel admin

---

### Detalhes Técnicos

**Sobre os tipos gerados (types.ts):**
O arquivo atual reflete o schema "vazio" -- todas as colunas como nullable text, sem enums, sem functions, sem relationships. Após as migrações SQL (etapas 2-4), o types.ts será regenerado automaticamente pelo Supabase com os tipos corretos, o que resolverá a maioria dos erros de build.

**Sobre as foreign keys ausentes:**
A migração original tinha foreign keys (ex: `wallet_items.wallet_id -> wallet_simulator.id`), mas elas não existem no banco atual. Serão recriadas na migração SQL.

**Sobre a edge function `migrate-users`:**
Usará a Service Role Key para chamar `auth.admin.createUser()` preservando UUIDs, mesma abordagem que funcionou anteriormente.

