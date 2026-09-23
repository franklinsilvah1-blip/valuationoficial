# Relatório de Deploy e Validação — rodada de 2026-09-22

Complemento operacional de `RELATORIO_MATRIZ_ACESSO_MERCADO.md` (que cobre a
parte técnica: auditoria, matriz de acesso, migrations e testes).

> ## ⚠️ CORREÇÃO DE DIAGNÓSTICO
>
> **A versão anterior deste relatório concluía que o deploy era feito pelo
> Lovable. Isso estava ERRADO.**
>
> O destino correto é **Cloudflare Pages**, projeto **`valuationoficial`**.
> Lovable não faz mais parte da arquitetura da ValuAtion.
>
> A conclusão errada veio de tomar o `README.md` (boilerplate gerado pelo
> Lovable) como descrição do fluxo real, em vez de verificar o host de fato.
> A lição: o README descrevia a **origem histórica** do projeto, não o seu
> pipeline atual.

---

## 1. Estado de cada camada

| Camada | Estado | Evidência |
|---|---|---|
| **Banco — FASE A** | ✅ aplicada e validada | `POST /rpc/get_public_market_assets` → HTTP 200, 20 linhas |
| **Banco — FASE B** | ⛔ **não aplicada** (proposital) | aguardando decisão |
| **Código — GitHub** | ✅ `e32029d` em `origin/main` | confirmado via API |
| **Build — Cloudflare Pages** | ✅ **`e32029d` construído e no ar** | `valuationoficial.pages.dev` serve `index-DEzt2vo-.js` |
| **Domínio — valuationit.com.br** | ❌ **NÃO aponta para o Pages** | serve `index-47saO7A6.js`, build antigo |

**O frontend novo existe, está publicado e foi validado — mas no endereço do
Pages, não no domínio.**

---

## 2. Fluxo de deploy real

```
GitHub (main)  →  [gatilho externo]  →  Cloudflare Pages (valuationoficial)  →  *.pages.dev
                                                                                     ⇣
                                                          valuationit.com.br  ✗ (não ligado)
```

### 2.1 O que foi encontrado no repositório

| Procurado | Resultado |
|---|---|
| `wrangler.toml` / `.json` / `.jsonc` | **não existe** |
| `.github/workflows/` | **não existe** |
| `CLOUDFLARE_API_TOKEN` / `ACCOUNT_ID` | **ausentes** do repo e do ambiente |
| Script de deploy / `pages deploy` | **nenhum** |
| String "HostPanel" | **nenhuma ocorrência no repositório** |
| `public/_redirects` e `public/_headers` | **presentes** — convenção Cloudflare Pages ✅ |

**Conclusão:** o gatilho do build é **externo ao repositório**. Ele é
configurado no painel do Cloudflare (integração com GitHub) ou disparado por um
serviço de terceiro via API — o texto "HostPanel Managed Deploy" não vem de
nenhum arquivo versionado. **Não foi possível determinar a origem exata a
partir do repositório.**

### 2.2 Push ≠ deploy garantido

Não foi possível confirmar por medição se `git push` dispara o build, porque o
push de `e32029d` e a publicação ocorreram próximos no tempo. O que é fato:
`e32029d` **está** construído no Pages.

### 2.3 Sem acesso à API do Cloudflare

Não há `CLOUDFLARE_API_TOKEN` no ambiente nem `wrangler` instalado/autenticado.
Portanto **não pude auditar pelo painel**: Production branch, histórico de
deployments, build command, variáveis de ambiente, custom domains e o ID do
deployment correspondente a `e32029d` permanecem **não verificados**.

Tudo abaixo foi obtido por sondagem pública (HTTP/DNS), não pela API.

---

## 3. Por que o domínio não mostra o site novo

### 3.1 Bundles divergentes

| Host | Bundle | Versão |
|---|---|---|
| `valuationoficial.pages.dev` | `index-DEzt2vo-.js` (2.814.964 B) | ✅ `e32029d` |
| `valuationoficial-biy.pages.dev` | `index-DEzt2vo-.js` | ✅ `e32029d` |
| **`valuationit.com.br`** | `index-47saO7A6.js` (2.806.385 B) | ❌ build antigo |

### 3.2 DNS

```
valuationit.com.br        → A  185.158.133.1        (registro único, fora da faixa do Pages)
valuationoficial.pages.dev → A  172.66.44.138, 172.66.47.118   (Cloudflare)
```

### 3.3 Headers provam origens diferentes

| Header | `valuationit.com.br` | `valuationoficial.pages.dev` |
|---|---|---|
| CSP de `public/_headers` | **ausente** | **presente** ✅ |
| `permissions-policy` | ausente | presente ✅ |
| `x-frame-options` | ausente | presente ✅ |
| `ETag` / `Access-Control-Allow-Origin` | ausentes | presentes ✅ |
| `x-deployment-id` | **presente** | ausente |
| `Transfer-Encoding` | `chunked` | `Content-Length` |

O domínio está **proxied pelo Cloudflare** (`Server: cloudflare`, `CF-RAY`),
mas a origem **não é o Pages** — é outro host, que serve um build antigo e
**não aplica o `public/_headers`**.

### 3.4 ⚠️ Efeito colateral de segurança, hoje, em produção

Como o domínio não passa pelo Pages, **o site público está sem o CSP, sem
`X-Frame-Options`, sem `permissions-policy` e sem `X-XSS-Protection`** — todos
definidos em `public/_headers` e aplicados apenas no Pages. Isso é
independente desta rodada e persiste enquanto o domínio não for movido.

---

## 4. Validação do frontend novo (em `valuationoficial.pages.dev`)

Executada integralmente. **Tudo passou.**

### 4.1 Home

| Item | Resultado |
|---|---|
| `h1` | "Os melhores ativos globais estão aqui!" ✅ |
| Acima da busca | "Encontre e compare ativos" ✅ |
| Seção | "Melhores ativos do ano" ✅ |
| Linhas | **20** ✅ |
| Colunas | Código B3 · Tipo de Ativo · ROI 2026 · Recomendação TRIM — **exatamente 4** ✅ |
| Recomendação TRIM | bloqueada (valor `null` vindo do servidor) ✅ |
| Usuários | **500+** ✅ |

### 4.2 Network — apenas a porta nova

Única chamada de mercado durante toda a navegação pública:

```
POST /rest/v1/rpc/get_public_market_assets   → HTTP 200
```

**Nenhuma** chamada a `/rest/v1/assets`, `/rest/v1/assets_market_view`,
`/rest/v1/asset_analyses`, `/rest/v1/asset_analyses_gated` ou
`/rpc/get_public_assets`. Confirmado também por inspeção do bundle: essas
strings têm **0 ocorrências** no JS publicado.

### 4.3 Payload anônimo

```json
{
  "id": "2438056c-7dbc-4a8f-bc9f-7adcee4b0baf",
  "codigo_b3": "MUTC34",
  "tipo": "BDR",
  "roi2026": "201.4",
  "recomendacao": null
}
```

Chaves: **exatamente** `id, codigo_b3, tipo, roi2026, recomendacao`.
`recomendacao` = `null` em todas as linhas.
**Nenhum campo premium** (`taxa_semanal`, `roitrim`, `carteira`,
`nota_especialista`, `tendencia`, `nome`, `perfil_investidor`).

### 4.4 Mercado público

| Item | Resultado |
|---|---|
| `h1` | "Mercado" ✅ |
| Texto | "Encontre e compare os melhores ativos globais recomendados pelos nossos especialistas de investimentos" ✅ |
| Tabela | 20 linhas, as mesmas 4 colunas ✅ |
| Endpoint | `POST /rpc/get_public_market_assets` ✅ |

### 4.5 Busca pública — o teste decisivo

| Termo | Linhas da API | Esperado |
|---|---|---|
| `MUTC34` (dentro do Top 20) | **1** (encontrou) | ✅ |
| **`AALR3`** (existe na base, fora do Top 20) | **0** | ✅ |
| `%` | **0** | ✅ |
| `_` | **0** | ✅ |
| (sem busca) | **20** | ✅ |

Sem bypass de LIKE, sem enumeração fora do Top 20.

### 4.6 Consultoria

| Viewport | Título | Linhas | Overflow |
|---|---|---|---|
| Desktop | "Consultoria de Investimentos" | 1 | não |
| 375px | idem, 24px | **1** | **não** ✅ |
| 320px | idem | 2 (degradação prevista) | **não** ✅ |

Subtítulo exato: "Aprenda a investir como um especialista ou contrate a
Valuation para gerir seus investimentos" ✅

Home a 320px: sem overflow, 20 linhas na tabela ✅

### 4.7 Console

Únicos erros: **CSP bloqueando `analytics.google.com` e `ad.doubleclick.net`**
— o CSP libera `www.google-analytics.com`, mas o GTM tenta esses outros dois
domínios. É **pré-existente** e sem relação com esta rodada.

**Zero** erros de Supabase, RLS, `permission denied`, PostgREST, função SQL,
401/403/404/500 ou payload premium indevido.

---

## 5. ❌ Não validado — áreas autenticadas

**Não tenho credenciais de teste** para START, PRO, SPECIALIST, WEALTH ou
Admin, e conforme instruído **não alterei nenhum cliente real** para viabilizar
teste.

Continuam **pendentes de validação em ambiente real**:

- `/app/mercado` — carregamento, lista, busca, filtros, paginação
- START — 5 campos premium `null` + tendência bloqueada (conferir no Network)
- PRO — ativo START/PRO liberado, ativo SPECIALIST com os 5 campos `null` e
  **Tendência TRIM visível**
- SPECIALIST / WEALTH — acesso integral
- `/app/carteira` — favoritos, adicionar/remover, contadores
- Carteira TRIM (PRO)
- Admin — planos, ativos, telas de sync
- Assinatura — preços preservados
- Login / cadastro / Blog

Essas regras estão cobertas por **218 testes automatizados** contra PostgreSQL
real (`supabase/tests/`), mas isso não substitui a verificação com usuários
reais.

---

## 6. Remoção do Lovable

### 6.1 Classificação das ocorrências

| Categoria | Ocorrência | Ação |
|---|---|---|
| **A — dependência real** | `lovable-tagger` em `devDependencies` + import em `vite.config.ts` | **removido** |
| **A — config operacional** | `https://ai.gateway.lovable.dev` no CSP (`index.html`, `public/_headers`) | **removido** (nada no código o chamava) |
| **B — documentação errada** | `README.md` inteiro (boilerplate: "Open in Lovable", "Publish through Lovable", link `lovable.dev/projects/...`, "Live app: valuationoficial.lovable.app") | **reescrito** para Cloudflare Pages |
| **D — artefato** | `.lovable/plan.md` (ticket antigo de banner) | **removido** |
| **C — texto enganoso ao admin** | `AdminBackups.tsx`: "O Lovable sincronizará automaticamente" | **corrigido** |

### 6.2 Verificação da remoção

- `vite.config.ts`, `package.json`, `package-lock.json`, `README.md`,
  `index.html`, `public/_headers`: **0 ocorrências** de "lovable"
- `lovable-tagger` fora do `package-lock.json`: **0 ocorrências**
- Bundle de produção **byte-idêntico** antes e depois (2.815.018 B) — prova que
  o plugin era só de desenvolvimento e não afetava o artefato publicado
- `npm run build` ✅ · `npm run build:dev` ✅ (o modo onde o tagger rodava) ·
  typecheck ✅ · lint **800 (baseline)** ✅

### 6.3 ⚠️ Pendências sinalizadas, NÃO alteradas

Respeitei a instrução de não mexer no Supabase. Estes são **bugs reais** que
precisam da sua decisão:

| Arquivo | Problema | Impacto |
|---|---|---|
| `supabase/functions/capture-lead/index.ts:139` | E-mail de captação envia lead para `https://valuationit.lovable.app/auth` | **URL morta em e-mail para cliente** |
| `supabase/functions/send-sync-notification/index.ts:216` | Link do painel montado como `https://${projectRef}.lovable.app/app/admin/sync` | Link quebrado em notificação interna |

Corrigi-los exige **redeploy das Edge Functions**.

### 6.4 Categoria E — deixados intactos de propósito

- `backup/**/admin_audit_log.json` — dados históricos de auditoria
- `ADMIN_NOTIFICATIONS_SETUP.md`, `WEBHOOK_IMPLEMENTATION_SUMMARY.md`,
  `BACKUP_SYSTEM_DOCS.md`, `MIGRATION_GUIDE.md` — documentação histórica; citam
  o Lovable como ferramenta de origem, não como pipeline de deploy
- `valuationit-main/valuationit-main/` — pasta duplicada, artefato de
  import/export, **não referenciada pelo build**. Remover é seguro mas é uma
  exclusão grande — deixo para sua aprovação
- Histórico Git — **não reescrito**, conforme instruído

---

## 7. Plano para o domínio (NÃO executado)

Nada de DNS foi alterado. Proposta para revisão:

1. **Antes de tudo**, no painel do Cloudflare Pages → projeto `valuationoficial`
   → Custom domains: verificar se `valuationit.com.br` já está listado.
2. Se **não** estiver: adicionar como Custom Domain. O Cloudflare cria/ajusta o
   registro DNS automaticamente quando o domínio está na mesma conta.
3. Se **estiver**: o problema é o registro A `185.158.133.1` precedendo o Pages
   — identificar o que responde nesse IP e remover/ajustar o registro.
4. Validar em `valuationit.com.br` os mesmos itens da seção 4.
5. Conferir que o CSP e os demais headers passam a ser aplicados (seção 3.4).

**Downtime esperado: nenhum** — o Pages já serve o conteúdo correto; trata-se
de repontar o domínio para uma origem que já está pronta e testada.

Antes de executar, é preciso saber **o que é `185.158.133.1`** e se algo
depende dele (e-mail, subdomínios, outro serviço).

---

## 8. Ações executadas nesta sessão

| Ação | Estado |
|---|---|
| Commit `e32029d` | criado e enviado a `origin/main` (sessão anterior) |
| Limpeza do Lovable | **feita localmente, NÃO commitada** |
| FASE B | **não aplicada** |
| Migrations | **não alteradas** |
| DNS / domínio | **não alterados** |
| Edge Functions | **não alteradas** |
| Projeto Cloudflare | **não alterado** |

---

## 9. Conclusão

# FASE B BLOQUEADA

**Não por defeito.** O frontend novo foi validado com sucesso e todos os testes
de segurança pública passaram. O bloqueio tem duas causas:

1. **O domínio `valuationit.com.br` ainda serve o build antigo.** A FASE B
   fecha `public.assets`, que o build antigo usa — aplicá-la agora agravaria a
   quebra que já existe em `/mercado` no domínio.
2. **As áreas autenticadas não foram validadas** por falta de credenciais de
   teste.

### Destravamento

1. Repontar `valuationit.com.br` para o Pages (seção 7)
2. Revalidar a seção 4 no domínio
3. Validar as áreas autenticadas com contas de teste (seção 5)
4. Só então aplicar a FASE B
