

## Varredura Completa do Site - Diagnóstico Pós-Migração

### Resumo Executivo

A migração SQL trouxe apenas parte dos dados. Das 37 tabelas do sistema, **16 tabelas estão vazias mas tinham dados no backup**. Além disso, falta o secret `STRIPE_SECRET_KEY` nas Edge Functions, o que impede pagamentos.

---

### Tabelas que Precisam de Restauração (dados zerados)

| Tabela | Backup | Impacto |
|---|---|---|
| **subscription_plans** | 5 planos | Página de assinatura quebrada, checkout não funciona |
| **affiliates** | 5 afiliados | Programa de afiliados não funciona |
| **blog_posts** | 3 posts | Blog vazio |
| **blog_authors** | 4 autores | Blog sem autores |
| **categories** | 5 categorias | Blog sem categorias |
| **app_config** | 8 configs | Links de WhatsApp, backup configs, VAPID key perdidos |
| **smtp_config** | 1 config | Envio de emails não funciona |
| **tracking_scripts** | 3 scripts | Meta Pixel, Google Analytics e GTM não rastreiam |
| **profile_questions** | 3 perguntas | Perfil do investidor quebrado |
| **profile_options** | 12 opções | Perfil do investidor quebrado |
| **profile_answers** | 57 respostas | Respostas dos usuários perdidas |
| **asset_favorites** | 31 favoritos | Favoritos dos usuários perdidos |
| **notification_groups** | 1 grupo | Push notifications não funcionam |
| **notification_group_members** | 2 membros | Push notifications não funcionam |
| **push_notifications** | 1 notificação | Histórico de notificações perdido |

### Tabelas Vazias sem Impacto (eram vazias no backup também)

- `commissions`, `referrals`, `affiliate_clicks`, `leads`, `post_categories`, `tracking_events`, `asset_views`, `sync_queue` -- todas tinham 0 registros no backup.

### Tabelas OK (já restauradas anteriormente)

- `profiles` (18), `user_roles` (2), `assets` (598), `asset_analyses` (598), `exclusive_videos` (2), `wallet_simulator` (10), `wallet_items` (28), `wallet_movements` (34), `push_subscriptions` (2)

---

### Secret Faltando: STRIPE_SECRET_KEY

Os logs da Edge Function `payment-history` mostram:
```
ERROR: STRIPE_SECRET_KEY is not set
```

As seguintes Edge Functions dependem do Stripe e não funcionam sem esse secret:
- `create-checkout` (criar assinatura)
- `stripe-webhook` (processar pagamentos)
- `customer-portal` (portal do cliente)
- `payment-history` (histórico de pagamentos)
- `check-subscription` (verificar assinatura)
- `force-sync-subscription` (sincronizar assinatura)
- `stripe-reports` (relatórios)

**Ação necessária**: O Douglas precisa fornecer a `STRIPE_SECRET_KEY` do Stripe para que os pagamentos voltem a funcionar.

---

### Tabelas com dados sensíveis (smtp_config)

A tabela `smtp_config` continha a senha SMTP. No backup está como `[REDACTED]`. Será necessário reinserir a senha manualmente pelo painel admin após restaurar a estrutura.

---

### Plano de Restauração

Vou criar uma **Edge Function `restore-all-data`** que restaura todas as 15 tabelas de uma vez, usando os dados dos backups JSON. Isso inclui:

1. `subscription_plans` (5 registros) -- **Crítico para pagamentos**
2. `blog_authors` (4 registros)
3. `blog_posts` (3 registros)
4. `categories` (5 registros)
5. `app_config` (8 registros)
6. `smtp_config` (1 registro, sem senha -- precisará ser reconfigurada)
7. `tracking_scripts` (3 registros)
8. `profile_questions` (3 registros)
9. `profile_options` (12 registros)
10. `profile_answers` (57 registros)
11. `asset_favorites` (31 registros)
12. `affiliates` (5 registros)
13. `notification_groups` (1 registro)
14. `notification_group_members` (2 registros)
15. `push_notifications` (1 registro)

A Edge Function usará `upsert` com `ON CONFLICT DO NOTHING` para segurança.

### Após a Restauração

1. Solicitar a `STRIPE_SECRET_KEY` ao Douglas
2. Reconfigurar senha SMTP pelo painel admin
3. Testar o fluxo de assinatura ponta a ponta
4. Limpar Edge Functions temporárias (`migrate-users`, `restore-wallets`, `restore-all-data`)

### Arquivos a criar/modificar

1. **`supabase/functions/restore-all-data/index.ts`** -- Edge Function com todos os dados de backup embutidos
2. **`supabase/config.toml`** -- Registrar a nova função

