

## Tela de Obrigado para Mensurar Conversao de Cadastro

### Objetivo
Criar uma pagina de "Obrigado" dedicada em `/cadastro/obrigado` que serve como URL de conversao para o analista de trafego pago rastrear no Meta Ads, Google Ads, etc. Essa pagina sera exibida apos qualquer cadastro (gratis ou antes do checkout pago).

### Como funciona para o analista de trafego
- **URL de conversao**: `https://valuationit.com.br/cadastro/obrigado`
- O analista configura essa URL como "pagina de conversao" no Meta Pixel (evento PageView nessa URL) ou Google Ads
- A pagina dispara automaticamente eventos de conversao: `CompleteRegistration` (Meta Pixel) e `sign_up_complete` (GTM)
- Parametros UTM sao preservados na URL para atribuicao de campanha

### Mudancas

**1. Criar `src/pages/CadastroObrigado.tsx`**

Nova pagina com:
- Design alinhado ao estilo da plataforma (logo, checkmark verde animado)
- Disparo automatico de eventos de conversao ao carregar:
  - Meta Pixel: `fbq('track', 'CompleteRegistration')`
  - GTM: `pushGTMEvent({ event: 'sign_up_complete' })`
  - Google Ads: evento via dataLayer
- Parametros UTM da URL exibidos como dados para debug (opcionalmente)
- Botao principal "Acessar a Plataforma" levando ao `/app/dashboard`
- Botoes secundarios para explorar mercado e blog
- Texto adequado: "Sua conta foi criada com sucesso!" (sem pedir para criar conta novamente)

**2. Atualizar `src/components/SignupForm.tsx`**

- Alterar o redirecionamento apos cadastro FREE: de `/app/dashboard` para `/cadastro/obrigado`
- Preservar UTM params na URL de redirecionamento (utm_source, utm_medium, utm_campaign)
- Para planos pagos: redirecionar para `/cadastro/obrigado` brevemente antes do checkout, ou manter o fluxo atual de checkout direto (o `/assinatura-sucesso` ja existe como pagina pos-pagamento)

**3. Atualizar `src/App.tsx`**

- Adicionar rota `/cadastro/obrigado` apontando para `CadastroObrigado`

**4. Atualizar `src/pages/LandingPageObrigado.tsx`**

- Redirecionar `/lp/obrigado` para `/cadastro/obrigado` ou atualizar o conteudo para refletir que a conta ja foi criada (remover "Crie sua conta gratis")

### Eventos disparados na pagina (para o analista configurar)

```text
Ao carregar /cadastro/obrigado:
  - Meta Pixel: CompleteRegistration (content_name: plano, value: 0)
  - GTM dataLayer: sign_up_complete (plan: FREE/START/PRO/SPECIALIST)
  - Google Analytics: conversao de cadastro via GTM
```

### Resultado
- O analista de trafego configura `https://valuationit.com.br/cadastro/obrigado` como URL de conversao
- Toda conversao de cadastro (gratis ou pago) passa por essa pagina
- Eventos de pixel e GTM sao disparados automaticamente
- UTMs sao preservados para atribuicao correta de campanha
