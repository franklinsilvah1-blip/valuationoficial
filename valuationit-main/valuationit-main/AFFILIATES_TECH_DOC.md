# Documentação Técnica - Módulo de Afiliados

Este documento descreve a arquitetura, regras de negócio e instruções de manutenção do sistema de afiliados da Valuation Invest Tech.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Regras de Negócio](#regras-de-negócio)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Edge Functions](#edge-functions)
5. [Tabelas do Banco de Dados](#tabelas-do-banco-de-dados)
6. [Fluxos Principais](#fluxos-principais)
7. [Guia de Manutenção](#guia-de-manutenção)
8. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O sistema de afiliados permite que usuários se tornem parceiros da plataforma, recebendo comissões por indicações que resultem em assinaturas pagas.

### Componentes Principais

- **Frontend**: Hook de tracking, página do afiliado, painel admin
- **Backend**: Edge functions para tracking, processamento de comissões e notificações
- **Banco de Dados**: Tabelas para afiliados, referrals, comissões e cliques

---

## Regras de Negócio

### 1. Cookie/LocalStorage de Rastreamento

| Configuração | Valor | Localização |
|--------------|-------|-------------|
| **Tempo de expiração** | 30 dias | `src/hooks/useAffiliateTracking.ts` (linha 8) |
| **Chave do storage** | `valuation_affiliate_id` | `src/hooks/useAffiliateTracking.ts` (linha 5) |
| **Chave de expiração** | `valuation_affiliate_expiry` | `src/hooks/useAffiliateTracking.ts` (linha 6) |

```typescript
// Para alterar o tempo de expiração, modifique:
const EXPIRY_DAYS = 30; // Linha 8 em useAffiliateTracking.ts
```

### 2. Taxa de Comissão

| Tipo | Valor Padrão | Localização |
|------|--------------|-------------|
| **Taxa padrão** | 10% | Banco de dados: `affiliates.commission_rate` DEFAULT |
| **Taxa individual** | Configurável por afiliado | Admin panel em `/app/admin/affiliates` |

**Para alterar a taxa GLOBAL padrão:**
```sql
-- Execute via migration tool
ALTER TABLE affiliates ALTER COLUMN commission_rate SET DEFAULT 15.00; -- Exemplo: mudar para 15%
```

**Para alterar a taxa INDIVIDUAL:**
1. Acesse `/app/admin/affiliates`
2. Clique no afiliado desejado
3. Edite o campo "Taxa de Comissão"
4. Salve as alterações

A lógica de cálculo está em:
- `supabase/functions/stripe-webhook/index.ts` (linha ~188)
```typescript
const commissionAmount = (amountPaid * affiliate.commission_rate) / 100;
```

### 3. Lógica de Inatividade

| Configuração | Valor | Localização |
|--------------|-------|-------------|
| **Período de inatividade** | 60 dias | `supabase/functions/check-affiliate-activity/index.ts` |
| **Notificações enviadas** | 30, 45 e 60 dias | `supabase/functions/check-affiliate-activity/index.ts` |

O sistema verifica automaticamente (via cron job) afiliados que não geraram receita nos últimos 60 dias e envia notificações escalonadas.

```typescript
// Para alterar os períodos de inatividade:
// Arquivo: supabase/functions/check-affiliate-activity/index.ts
const INACTIVITY_THRESHOLDS = {
  warning_30: 30,   // Primeiro aviso
  warning_45: 45,   // Segundo aviso  
  inactive_60: 60   // Afiliado considerado inativo
};
```

### 4. Proteção contra Auto-Indicação

O sistema bloqueia automaticamente tentativas de auto-indicação:
- **Localização**: `supabase/functions/stripe-webhook/index.ts` (linhas ~138-143)
```typescript
// Prevent self-referral
if (affiliate.user_id === userId) {
  logStep("WARNING: Self-referral detected, skipping commission", { userId });
  return;
}
```

### 5. Bloqueio de Tracking para Admins

Admins logados não têm seu tráfego rastreado como afiliado:
- **Localização**: `src/hooks/useAffiliateTracking.ts`
- O hook verifica se o usuário é admin antes de salvar o código de afiliado

### 6. Aprovação Manual de Afiliados

Quando um usuário solicita se tornar afiliado, ele NÃO é ativado automaticamente. O fluxo é:

1. Usuário clica em "Solicitar ativação de Afiliado" na página `/app/afiliado`
2. Um registro é criado com status `pending`
3. Um e-mail poderia ser enviado ao admin (opcional - não implementado)
4. O usuário vê uma tela de "Aguardando Aprovação"
5. Admin acessa `/app/admin/affiliates` e vê o card de "Aguardando Aprovação"
6. Admin clica para aprovar (muda status para `active`)
7. Sistema envia automaticamente e-mail de aprovação ao afiliado
8. Afiliado recebe acesso ao painel completo

| Configuração | Valor | Localização |
|--------------|-------|-------------|
| **Status inicial** | `pending` | Função SQL `request_affiliate_activation` |
| **Email de aprovação** | `approved` | `supabase/functions/send-affiliate-email/index.ts` |

**Para mudar para ativação automática:**
```sql
-- Altere a função request_affiliate_activation
-- Mude 'pending' para 'active' na linha de INSERT
INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
VALUES (auth.uid(), new_code, 10.00, 'active') -- Mude 'pending' para 'active'
```

---

## Edge Functions

### 1. `track-affiliate-click`
**Propósito**: Registra cliques nos links de afiliados

**Arquivo**: `supabase/functions/track-affiliate-click/index.ts`

**Payload**:
```json
{
  "affiliateCode": "ABC123",
  "landingPage": "https://valuation.com/auth?ref=ABC123",
  "referrer": "https://google.com",
  "sessionId": "unique-session-id"
}
```

**Retorno**: 
- `200`: Click registrado com sucesso
- `400`: Código de afiliado inválido
- `404`: Afiliado não encontrado ou inativo

---

### 2. `send-affiliate-email`
**Propósito**: Envia emails transacionais para afiliados

**Arquivo**: `supabase/functions/send-affiliate-email/index.ts`

**Tipos de Email**:
- `welcome`: Boas-vindas ao programa (enviado manualmente pelo admin)
- `approved`: Conta aprovada pelo admin (enviado automaticamente na aprovação)
- `new_commission`: Nova comissão gerada
- `commission_paid`: Comissão foi paga

**Payload**:
```json
{
  "userId": "uuid-do-afiliado",
  "affiliateId": "uuid-do-registro-affiliates",
  "emailType": "welcome|approved|new_commission|commission_paid",
  "commissionAmount": 50.00
}
```

---

### 3. `check-affiliate-activity`
**Propósito**: Verifica afiliados inativos e envia notificações

**Arquivo**: `supabase/functions/check-affiliate-activity/index.ts`

**Execução**: Cron job diário (configurar no Supabase Dashboard)

**Lógica**:
1. Busca afiliados ativos sem receita há mais de 30 dias
2. Envia notificações escalonadas (30, 45, 60 dias)
3. Atualiza campo `last_inactivity_notification`

---

### 4. `send-monthly-affiliate-report`
**Propósito**: Envia relatório mensal de performance

**Arquivo**: `supabase/functions/send-monthly-affiliate-report/index.ts`

**Execução**: Cron job mensal (dia 1 de cada mês)

---

### 5. Processamento de Comissões (dentro do stripe-webhook)
**Propósito**: Processa comissões quando uma assinatura é completada

**Arquivo**: `supabase/functions/stripe-webhook/index.ts`

**Função**: `processAffiliateCommission` (linha ~107)

**Fluxo**:
1. Verifica se existe `affiliateCode` no metadata do checkout
2. Valida se o afiliado está ativo
3. Bloqueia auto-indicação
4. Calcula comissão baseada na taxa individual do afiliado
5. Cria registro na tabela `commissions`
6. Atualiza totais do afiliado
7. Envia email de notificação

---

## Tabelas do Banco de Dados

### `affiliates`
Armazena dados dos afiliados

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `user_id` | UUID | Referência ao profiles |
| `affiliate_code` | TEXT | Código único do afiliado (ex: ABC123) |
| `commission_rate` | NUMERIC | Taxa de comissão (default: 10.00) |
| `status` | ENUM | pending, active, suspended, inactive |
| `total_referrals` | INTEGER | Total de indicações |
| `total_earnings` | NUMERIC | Total ganho em comissões |
| `last_revenue_at` | TIMESTAMP | Última receita gerada |
| `last_inactivity_notification` | TEXT | Tipo da última notificação de inatividade |

### `affiliate_clicks`
Registra cliques nos links de afiliados

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `affiliate_id` | UUID | Referência ao affiliates |
| `affiliate_code` | TEXT | Código usado no clique |
| `ip_address` | TEXT | IP do visitante |
| `user_agent` | TEXT | Browser do visitante |
| `referrer` | TEXT | URL de origem |
| `landing_page` | TEXT | Página de destino |
| `session_id` | TEXT | ID da sessão (para deduplicação) |
| `created_at` | TIMESTAMP | Data/hora do clique |

### `referrals`
Vincula usuários indicados aos afiliados

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `affiliate_id` | UUID | Referência ao affiliates |
| `referred_user_id` | UUID | Usuário que foi indicado |
| `status` | TEXT | registered, converted |
| `converted_at` | TIMESTAMP | Data da conversão (assinatura) |

### `commissions`
Registra comissões geradas

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `affiliate_id` | UUID | Referência ao affiliates |
| `referral_id` | UUID | Referência ao referrals |
| `amount` | NUMERIC | Valor da comissão em R$ |
| `status` | ENUM | pending, approved, paid, cancelled |
| `stripe_payment_id` | TEXT | ID do pagamento no Stripe |
| `paid_at` | TIMESTAMP | Data do pagamento |

---

## Fluxos Principais

### Fluxo de Indicação
```
1. Visitante acessa ?ref=CODE
   ↓
2. useAffiliateTracking salva código no localStorage (30 dias)
   ↓
3. Se não for admin, registra click via track-affiliate-click
   ↓
4. Usuário faz cadastro
   ↓
5. Auth.tsx registra referral via registerAffiliateReferral()
   ↓
6. Usuário assina plano pago
   ↓
7. stripe-webhook processa comissão automaticamente
   ↓
8. Afiliado recebe email de notificação
```

### Fluxo de Pagamento de Comissão
```
1. Admin acessa /app/admin/affiliates
   ↓
2. Visualiza comissões pendentes
   ↓
3. Marca como "paga" (status → paid)
   ↓
4. Sistema envia email commission_paid ao afiliado
```

---

## Guia de Manutenção

### Alterar Taxa de Comissão Global

1. **Via Migration** (recomendado para produção):
```sql
ALTER TABLE affiliates ALTER COLUMN commission_rate SET DEFAULT 15.00;
```

2. **Para novos afiliados apenas**: A alteração acima só afeta novos cadastros.

3. **Para afiliados existentes**:
```sql
UPDATE affiliates SET commission_rate = 15.00 WHERE commission_rate = 10.00;
```

### Alterar Tempo de Expiração do Cookie

1. Edite `src/hooks/useAffiliateTracking.ts`:
```typescript
const EXPIRY_DAYS = 60; // Altere de 30 para 60 dias
```

2. Faça deploy da alteração.

### Adicionar Novo Tipo de Email

1. Edite `supabase/functions/send-affiliate-email/index.ts`
2. Adicione novo template no switch case
3. Atualize a Edge Function

### Configurar Cron Jobs

No Supabase Dashboard → Database → Extensions → pg_cron:

```sql
-- Verificar atividade diariamente às 9h
SELECT cron.schedule('check-affiliate-activity', '0 9 * * *', $$
  SELECT net.http_post(
    'https://seu-projeto.supabase.co/functions/v1/check-affiliate-activity',
    '{}',
    '{}'
  )
$$);

-- Relatório mensal no dia 1 às 10h
SELECT cron.schedule('monthly-affiliate-report', '0 10 1 * *', $$
  SELECT net.http_post(
    'https://seu-projeto.supabase.co/functions/v1/send-monthly-affiliate-report',
    '{}',
    '{}'
  )
$$);
```

---

## Troubleshooting

### Comissão não foi gerada

1. Verifique se o `affiliateCode` está presente no metadata do checkout
2. Confirme que o afiliado está com status `active`
3. Verifique se não é auto-indicação
4. Consulte logs da Edge Function `stripe-webhook`

### Click não foi registrado

1. Verifique se o usuário não é admin
2. Confirme que o código de afiliado existe e está ativo
3. Verifique se o sessionId já foi usado (deduplicação)

### Email não foi enviado

1. Verifique configuração SMTP em `/app/admin/smtp`
2. Consulte logs da Edge Function correspondente
3. Confirme que o email do afiliado está cadastrado

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useAffiliateTracking.ts` | Hook de rastreamento frontend |
| `src/pages/app/Afiliado.tsx` | Página do afiliado (dashboard) |
| `src/pages/app/AdminAffiliates.tsx` | Painel admin de afiliados |
| `src/components/AffiliateAnalyticsDashboard.tsx` | Dashboard de analytics |
| `src/components/AffiliatePerformanceCharts.tsx` | Gráficos de performance |
| `supabase/functions/stripe-webhook/index.ts` | Processamento de comissões |
| `supabase/functions/track-affiliate-click/index.ts` | Registro de cliques |
| `supabase/functions/send-affiliate-email/index.ts` | Emails transacionais |
| `supabase/functions/check-affiliate-activity/index.ts` | Verificação de inatividade |

---

*Documentação gerada em: Dezembro 2025*
*Versão: 1.0*
