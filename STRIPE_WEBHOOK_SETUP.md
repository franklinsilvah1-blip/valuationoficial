# Configuração do Stripe Webhook

## 📋 Instruções de Configuração

### 1. Acessar o Stripe Dashboard

1. Acesse [https://dashboard.stripe.com/](https://dashboard.stripe.com/)
2. Faça login na sua conta Stripe
3. **IMPORTANTE**: Certifique-se de estar no ambiente correto (Test/Live)

### 2. Criar o Webhook Endpoint

1. No menu lateral, clique em **"Developers"**
2. Clique em **"Webhooks"**
3. Clique no botão **"Add endpoint"**

### 3. Configurar o Endpoint

**URL do Webhook:**
```
https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/stripe-webhook
```

**Selecionar os seguintes eventos:**

- ✅ `checkout.session.completed` - Quando o pagamento é concluído
- ✅ `customer.subscription.created` - Quando uma nova assinatura é criada
- ✅ `customer.subscription.updated` - Quando uma assinatura é atualizada (upgrade/downgrade)
- ✅ `customer.subscription.deleted` - Quando uma assinatura é cancelada
- ✅ `invoice.payment_succeeded` - Quando um pagamento recorrente é bem-sucedido
- ✅ `invoice.payment_failed` - Quando um pagamento falha

### 4. Obter o Signing Secret

Após criar o webhook:

1. Clique no webhook que você acabou de criar
2. Na seção **"Signing secret"**, clique em **"Reveal"**
3. Copie o secret (começa com `whsec_...`)
4. **Este secret já foi configurado no sistema** quando você foi solicitado a adicionar o `STRIPE_WEBHOOK_SECRET`

### 5. Testar o Webhook (Opcional)

Você pode testar o webhook usando o Stripe CLI:

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Encaminhar eventos para o endpoint local (desenvolvimento)
stripe listen --forward-to https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/stripe-webhook

# Enviar evento de teste
stripe trigger checkout.session.completed
```

## 🔍 Verificando se está Funcionando

### Logs do Webhook

1. No Stripe Dashboard → Developers → Webhooks
2. Clique no seu webhook
3. Vá na aba **"Attempts"** ou **"Event log"**
4. Você verá todos os eventos enviados e o status (Success/Failed)

### Logs no Sistema

Os logs detalhados do webhook podem ser vistos em:
- **Supabase Edge Function Logs** para a função `stripe-webhook`
- Todos os logs começam com `[STRIPE-WEBHOOK]`

### Teste Real

1. Faça uma compra de teste no ambiente de teste do Stripe
2. Use um cartão de teste: `4242 4242 4242 4242`
3. Após o pagamento, verifique:
   - ✅ O plano do usuário foi atualizado no perfil
   - ✅ Email de boas-vindas foi enviado (se aplicável)
   - ✅ Logs mostram processamento bem-sucedido

## 🎯 Eventos Processados

| Evento | O que faz | Quando ocorre |
|--------|-----------|---------------|
| `checkout.session.completed` | Ativa a assinatura inicial | Primeiro pagamento concluído |
| `customer.subscription.updated` | Atualiza dados da assinatura | Upgrade, downgrade, renovação |
| `customer.subscription.deleted` | Define usuário como FREE | Cancelamento |
| `invoice.payment_succeeded` | Renova período da assinatura | Pagamento recorrente bem-sucedido |
| `invoice.payment_failed` | Loga falha (não muda plano) | Falha no pagamento recorrente |

## 🚨 Troubleshooting

### Webhook não está sendo chamado
- Verifique se a URL está correta
- Confirme que os eventos estão selecionados
- Verifique se o endpoint está ativo no Stripe

### Webhook retorna erro 400
- Provavelmente o `STRIPE_WEBHOOK_SECRET` está incorreto
- Revele o secret no Stripe e compare com o configurado

### Webhook retorna erro 500
- Veja os logs da edge function `stripe-webhook`
- Pode ser erro de conexão com Supabase ou Stripe

### Usuário pagou mas não foi atualizado
1. Verifique os logs do webhook no Stripe
2. Se o webhook falhou, use a página **Admin → Sincronização Stripe**
3. Clique em "Sincronizar" no usuário específico

## ✅ Vantagens do Webhook vs Polling

| Aspecto | Webhook | Polling (antigo) |
|---------|---------|------------------|
| **Velocidade** | Instantâneo (< 1s) | 1-60 segundos |
| **Confiabilidade** | 99.9% | Depende de timing |
| **Uso de recursos** | Mínimo | Alto (requests constantes) |
| **Custo** | Baixo | Médio/Alto |
| **Complexidade** | Baixa (event-driven) | Alta (precisa polling) |

## 📝 Notas Importantes

- ⚠️ **Não compartilhe o Webhook Secret** - é sensível como uma senha
- 🔒 A edge function valida automaticamente a assinatura do webhook
- 📊 Todos os eventos são logados para auditoria
- 🔄 O sistema mantém fallback via `check-subscription` para segurança
- 🛠️ Admins podem sincronizar manualmente via painel admin se necessário

## 🎉 Pronto!

Após configurar o webhook:
1. ✅ Assinaturas serão ativadas **instantaneamente** após pagamento
2. ✅ Renovações automáticas funcionarão perfeitamente
3. ✅ Cancelamentos serão processados em tempo real
4. ✅ Sistema mais confiável e rápido
