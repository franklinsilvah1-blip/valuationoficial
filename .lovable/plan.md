

## Diagnóstico: Carteiras com erro 400 (Bad Request)

### Problemas Identificados

Analisando os screenshots e o código, existem **dois problemas críticos**:

**1. Foreign Keys ausentes entre `assets` e `asset_analyses`**

O código em `useWalletSimulator.ts` (linhas 48-53, 134-149) e em `MercadoApp.tsx` faz queries com embedded resources do PostgREST:

```sql
assets?select=*,asset_analyses(*)
```

Isso **requer** uma foreign key `asset_analyses.asset_id -> assets.id`. Sem ela, o PostgREST retorna **400 Bad Request** -- exatamente o erro nos screenshots.

**2. Todas as RLS policies ainda são RESTRICTIVE**

Toda policy listada no schema mostra `Permissive: No`. Quando há múltiplas policies RESTRICTIVE no mesmo comando (ex: SELECT), **todas** precisam passar simultaneamente. Isso bloqueia o acesso em tabelas como `profiles` (um usuário normal nunca é admin E dono ao mesmo tempo, pois ambas precisam ser true).

A correção anterior pode ter falhado ou sido sobrescrita.

---

### Plano de Correção (2 etapas)

#### Etapa 1 -- Criar Foreign Keys essenciais

Uma migração SQL que adiciona as relações necessárias para as queries PostgREST funcionarem:

- `asset_analyses.asset_id` -> `assets.id` (ON DELETE CASCADE)
- `wallet_items.wallet_id` -> `wallet_simulator.id` (ON DELETE CASCADE)
- `wallet_items.asset_id` -> `assets.id` (ON DELETE SET NULL)
- `asset_favorites.asset_id` -> `assets.id` (ON DELETE SET NULL)
- `asset_favorites.user_id` -> `profiles.id`
- `wallet_movements.asset_id` -> `assets.id` (ON DELETE SET NULL)
- `blog_posts.blog_author_id` -> `blog_authors.id`
- `post_categories.post_id` -> `blog_posts.id`
- `post_categories.category_id` -> `categories.id`
- `commissions.affiliate_id` -> `affiliates.id`
- `commissions.referral_id` -> `referrals.id`
- `referrals.affiliate_id` -> `affiliates.id`

#### Etapa 2 -- Recriar TODAS as RLS policies como PERMISSIVE

Dropar e recriar cada policy sem a keyword `RESTRICTIVE` (que é o padrão no PostgreSQL para `CREATE POLICY` quando não especificado -- mas a migração anterior pode ter usado explicitamente). Tabelas afetadas:

- `profiles`, `user_roles`, `assets`, `asset_analyses`
- `wallet_simulator`, `wallet_items`, `wallet_movements`
- `asset_favorites`, `asset_views`, `subscription_plans`
- `blog_posts`, `blog_authors`, `categories`, `post_categories`
- `affiliates`, `commissions`, `referrals`, `affiliate_clicks`
- `leads`, `cancellation_feedback`, `app_config`, `smtp_config`
- `admin_audit_log`, `push_notifications`, `push_subscriptions`
- `notification_groups`, `notification_group_members`
- `tracking_scripts`, `tracking_events`
- `sync_logs`, `sync_queue`, `import_jobs`, `rate_limit_log`
- `profile_questions`, `profile_options`, `profile_answers`
- `exclusive_videos`, `sites`, `blog_authors_public`

---

### Detalhes Técnicos

A causa raiz do erro 400 é que o PostgREST precisa de foreign keys para resolver embedded selects (`asset_analyses(*)`). Sem elas, a query é rejeitada antes mesmo de chegar ao RLS.

Após adicionar as FKs, as queries PostgREST vão funcionar, mas o RLS RESTRICTIVE ainda bloquearia os dados. Por isso as duas etapas são necessárias juntas.

O `types.ts` será regenerado automaticamente após a migração, refletindo as novas `Relationships` no schema.

