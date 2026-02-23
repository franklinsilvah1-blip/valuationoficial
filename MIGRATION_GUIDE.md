# Guia de Migração para Supabase Independente

## Pré-requisitos
1. Criar um novo projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Instalar o [Supabase CLI](https://supabase.com/docs/guides/cli)
3. Ter os arquivos de backup em `backup/2026-02-22/full/`

---

## Passo 1: Recriar o Schema

Clone este repositório e execute:

```bash
# Vincular ao novo projeto
supabase link --project-ref SEU_NOVO_PROJECT_REF

# Aplicar todas as migrations (tabelas, enums, RLS, triggers, funções)
supabase db push
```

Isso criará toda a estrutura: tabelas, enums (`plan_type`, `asset_type`, `app_role`, etc.), funções SQL (`has_role`, `handle_new_user`, etc.), triggers e RLS policies.

---

## Passo 2: Deploy das Edge Functions

```bash
supabase functions deploy --project-ref SEU_NOVO_PROJECT_REF
```

---

## Passo 3: Configurar Secrets

No dashboard do Supabase, vá em **Settings > Edge Functions > Secrets** e adicione:

| Secret | Onde obter |
|--------|-----------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard > API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Webhooks |
| `GITHUB_BACKUP_TOKEN` | GitHub > Settings > Personal Access Tokens |
| `GITHUB_BACKUP_REPO` | Ex: `seu-usuario/valuationit-backups` |
| `VAPID_PUBLIC_KEY` | Gerar novo par VAPID ou reutilizar |
| `VAPID_PRIVATE_KEY` | Gerar novo par VAPID ou reutilizar |
| `SMTP_ENCRYPTION_KEY` | Chave AES-256 (gerar nova ou reutilizar) |
| `CRON_SECRET` | Gerar string aleatória |
| `GOOGLE_SHEETS_API_KEY` | Google Cloud Console |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | URL da planilha |
| `GOOGLE_SHEETS_SHEET_NAME` | Nome da aba |
| `GOOGLE_SHEETS_RANGE` | Ex: `A1:Z1000` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Dashboard |
| `RESEND_API_KEY` | Resend Dashboard |

---

## Passo 4: Importar Dados do Backup

### Ordem de importação (respeitar foreign keys)

Use o SQL Editor do Supabase Dashboard ou `psql` para executar os comandos abaixo.

⚠️ **IMPORTANTE**: Os arquivos JSON do backup estão no GitHub. Você precisará converter cada JSON para comandos INSERT. Abaixo está um script Node.js para facilitar:

### Script de Importação Automática (Node.js)

Crie um arquivo `import-backup.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURAR AQUI =====
const SUPABASE_URL = 'https://SEU_NOVO_REF.supabase.co';
const SERVICE_ROLE_KEY = 'sua_service_role_key_aqui';
const BACKUP_DIR = './backup/2026-02-22/full';
// ============================

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Ordem de importação (respeita foreign keys)
const IMPORT_ORDER = [
  // 1. Tabelas base (sem dependências)
  'profiles',
  'user_roles',
  'app_config',
  'categories',
  'blog_authors',
  'profile_questions',
  'profile_options',
  'subscription_plans',
  'notification_groups',
  'tracking_scripts',

  // 2. Tabelas com dependência de profiles
  'assets',
  'wallet_simulator',
  'affiliates',
  'push_subscriptions',
  'cancellation_feedback',
  'leads',

  // 3. Tabelas com dependência de assets
  'asset_analyses',
  'asset_favorites',
  'asset_views',

  // 4. Tabelas com dependência de wallet_simulator
  'wallet_items',
  'wallet_movements',

  // 5. Tabelas com dependência de affiliates
  'referrals',
  'commissions',
  'affiliate_clicks',

  // 6. Tabelas com dependência de blog_authors/categories
  'blog_posts',
  'post_categories',

  // 7. Tabelas com dependência de profile_questions
  'profile_answers',

  // 8. Tabelas com dependência de notification_groups
  'notification_group_members',

  // 9. Tabelas com dependência de tracking_scripts
  'tracking_events',

  // 10. Demais tabelas
  'push_notifications',
  'exclusive_videos',
  'smtp_config',
  'admin_audit_log',
  'sync_logs',
  'sync_queue',
  'import_jobs',
  'rate_limit_log',
];

// Tabelas a pular (dados sensíveis redactados ou gerenciados separadamente)
const SKIP_TABLES = [];

async function importTable(tableName) {
  const filePath = path.join(BACKUP_DIR, `${tableName}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  ${tableName}: arquivo não encontrado, pulando`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const records = JSON.parse(raw);

  if (!Array.isArray(records) || records.length === 0) {
    console.log(`⏭️  ${tableName}: vazio, pulando`);
    return;
  }

  // Verificar se tem dados redactados
  const hasRedacted = records.some(r =>
    Object.values(r).some(v => typeof v === 'string' && v.includes('[REDACTED]'))
  );
  if (hasRedacted) {
    console.log(`⚠️  ${tableName}: contém dados [REDACTED], pulando`);
    return;
  }

  // Inserir em lotes de 500
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      console.error(`❌ ${tableName} (lote ${i}): ${error.message}`);
      return;
    }
    inserted += batch.length;
  }

  console.log(`✅ ${tableName}: ${inserted} registros importados`);
}

async function main() {
  console.log('🚀 Iniciando importação do backup...\n');
  
  for (const table of IMPORT_ORDER) {
    if (SKIP_TABLES.includes(table)) {
      console.log(`⏭️  ${table}: na lista de skip`);
      continue;
    }
    await importTable(table);
  }

  console.log('\n✅ Importação concluída!');
  console.log('\n⚠️  LEMBRETE: Os usuários (auth.users) NÃO foram importados.');
  console.log('   Os usuários precisarão recriar suas senhas via "Esqueci minha senha".');
}

main().catch(console.error);
```

### Executar:

```bash
npm install @supabase/supabase-js
node import-backup.js
```

---

## Passo 5: Migrar Usuários (auth.users)

Os usuários de autenticação **NÃO estão no backup**. Opções:

### Opção A: Supabase CLI (recomendado se tiver acesso direto ao projeto original)
```bash
# No projeto ORIGINAL
supabase auth export --project-ref yoazkdmzjibogpxkjseh > auth_users.sql

# No projeto NOVO
psql "postgresql://postgres:SENHA@db.SEU_NOVO_REF.supabase.co:5432/postgres" < auth_users.sql
```

### Opção B: Pedir aos usuários
Configure o fluxo de "Esqueci minha senha" e peça aos usuários para recriarem suas credenciais.

### Opção C: API Admin (criar programaticamente)
```javascript
// Para cada usuário conhecido
const { data, error } = await supabase.auth.admin.createUser({
  email: 'usuario@email.com',
  password: 'senha_temporaria',
  email_confirm: true,
  user_metadata: { name: 'Nome do Usuário' }
});
```

---

## Passo 6: Migrar Storage (blog-images)

1. No Supabase Dashboard do projeto **original**, vá em Storage > blog-images
2. Baixe todos os arquivos
3. No projeto **novo**, crie o bucket:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('blog-images', 'blog-images', true);

CREATE POLICY "Public read blog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

CREATE POLICY "Admins can manage blog images"
ON storage.objects FOR ALL
USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'));
```

4. Faça upload dos arquivos via Dashboard ou CLI

---

## Passo 7: Atualizar Frontend

No `.env` do novo projeto Lovable (ou no código fonte se for hospedar fora):

```env
VITE_SUPABASE_URL=https://SEU_NOVO_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=nova_anon_key
VITE_SUPABASE_PROJECT_ID=SEU_NOVO_REF
```

---

## Passo 8: Atualizar Stripe Webhook

No [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

1. Desativar o webhook antigo apontando para `yoazkdmzjibogpxkjseh`
2. Criar novo webhook endpoint:
   - URL: `https://SEU_NOVO_REF.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
3. Copiar o novo Webhook Secret e atualizar o secret `STRIPE_WEBHOOK_SECRET`

---

## Passo 9: Criar Storage Bucket para Blog

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('blog-images', 'blog-images', true);
```

---

## Checklist Final

- [ ] Schema aplicado (`supabase db push`)
- [ ] Edge Functions deployed
- [ ] Secrets configurados
- [ ] Dados importados via script
- [ ] Usuários migrados (auth.users)
- [ ] Storage migrado (blog-images)
- [ ] Frontend atualizado (.env)
- [ ] Stripe webhook atualizado
- [ ] Testar login/cadastro
- [ ] Testar checkout/assinatura
- [ ] Testar backup automático
- [ ] Testar sync Google Sheets
- [ ] Testar envio de emails (SMTP)
- [ ] Testar push notifications

---

## Dados do Backup Atual (2026-02-22)

| Tabela | Registros |
|--------|-----------|
| profiles | 17 |
| user_roles | 2 |
| assets | 598 |
| asset_analyses | 598 |
| asset_favorites | 31 |
| wallet_simulator | 10 |
| wallet_items | 28 |
| wallet_movements | 34 |
| affiliates | 5 |
| blog_posts | 3 |
| blog_authors | 4 |
| categories | 5 |
| subscription_plans | 5 |
| push_subscriptions | 15 |
| admin_audit_log | 33 |
| import_jobs | 133 |
| sync_logs | 131 |
| profile_answers | 57 |
| profile_questions | 3 |
| profile_options | 12 |
| tracking_scripts | 3 |
| exclusive_videos | 2 |
| cancellation_feedback | 2 |
| notification_groups | 1 |
| notification_group_members | 2 |
| push_notifications | 1 |
| smtp_config | 1 |
| rate_limit_log | 1000 |
