

## Problema

Dois problemas distintos com URLs nos emails:

1. **Supabase Auth `site_url`** configurado como `localhost:3000` no projeto Supabase. Isso faz com que todos os links de verificação de email, reset de senha e magic link do Supabase Auth redirecionem para `localhost:3000` (como mostra o screenshot). Essa configuração precisa ser alterada no **Dashboard do Supabase > Authentication > URL Configuration > Site URL** para `https://valuationit.com.br`.

2. **Edge functions usando `req.headers.get("origin")`** como base de URL. Quando chamadas por cron, webhook ou contexto sem browser, o header `origin` pode ser `null` ou incorreto. Os fallbacks estão inconsistentes:
   - `create-checkout`: fallback para `clube-carteira-facil.lovable.app` (URL errada, projeto antigo)
   - `customer-portal`: fallback para `valuationit.com.br` (correto)
   - `send-welcome-email`: usa `origin` com fallback correto
   - `send-subscription-notification`: usa `origin` com fallback correto

### Correção

**Passo 1 (manual, obrigatório):** O usuário precisa ir no Supabase Dashboard > Authentication > URL Configuration e alterar:
- **Site URL**: `https://valuationit.com.br`
- **Redirect URLs**: adicionar `https://valuationit.com.br/**` e `https://valuationoficial.lovable.app/**`

**Passo 2 (código):** Criar constante `APP_URL` centralizada em `_shared/constants.ts` com valor `https://valuationit.com.br` e substituir em todas as edge functions:

- `supabase/functions/_shared/constants.ts` (novo): exportar `APP_URL = "https://valuationit.com.br"`
- `send-welcome-email/index.ts`: trocar `req.headers.get("origin") || "https://valuationit.com.br"` por import de `APP_URL`
- `send-subscription-notification/index.ts`: idem
- `create-checkout/index.ts`: trocar fallback `clube-carteira-facil.lovable.app` por `APP_URL`
- `customer-portal/index.ts`: trocar `req.headers.get("origin") || "https://valuationit.com.br"` por `APP_URL`
- `send-magic-link/index.ts`: confirmar que `redirectTo` usa `APP_URL`
- `send-password-recovery-request/index.ts`: confirmar que `redirectTo` usa `APP_URL`

Em todos os casos, **não usar mais `req.headers.get("origin")`** para construir URLs de email/redirect. Usar sempre a constante fixa `APP_URL`.

**Passo 3:** Redeploy de todas as edge functions alteradas.

