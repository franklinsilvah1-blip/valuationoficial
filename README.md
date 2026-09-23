# ValuAtion — valuationit.com.br

Plataforma de análise e comparação de ativos (ações, FIIs, BDRs, ETFs,
criptomoedas), com controle de acesso aos dados por plano de assinatura.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite 5 + React 18 + TypeScript + Tailwind + shadcn/ui |
| Roteamento | React Router 7 |
| Estado servidor | TanStack Query 5 |
| Banco / Auth | Supabase (PostgreSQL 17) |
| Backend serverless | Supabase Edge Functions (`supabase/functions/`) |
| Hospedagem do frontend | **Cloudflare Pages** — projeto `valuationoficial` |

Não há SSR: todo o HTML é gerado no cliente. Por isso **toda autorização de
dados vive no PostgreSQL** (RLS, views mascaradas e RPCs `SECURITY DEFINER`),
nunca na interface. Ver `RELATORIO_MATRIZ_ACESSO_MERCADO.md`.

## Deploy

```
GitHub (branch main)  →  Cloudflare Pages (projeto: valuationoficial)  →  valuationit.com.br
```

- **Branch de produção**: `main`
- **Projeto Cloudflare Pages**: `valuationoficial`
- **URL do Pages**: https://valuationoficial.pages.dev
- **Domínio público**: https://valuationit.com.br

O diretório publicado é `dist/`, gerado por `npm run build`.

> **Atenção — o mecanismo exato que dispara o build no Cloudflare Pages ainda
> não está documentado aqui.** Os deployments de Production aparecem no painel
> com origem "HostPanel Managed Deploy", e não existe no repositório nenhum
> `wrangler.toml`, GitHub Action ou script de deploy. Ou seja: o gatilho é
> externo ao repositório. Confirme no painel do Cloudflare antes de assumir que
> um `git push` publica.

### Desenvolvimento local

Requer Node.js e npm.

```sh
npm install
npm run dev        # http://localhost:8080
npm run build      # gera dist/
npm run lint
```

O projeto tem dívida técnica de lint conhecida (~800 ocorrências, na maioria
`@typescript-eslint/no-explicit-any`). Não rode `eslint --fix` de forma ampla.

### Banco de dados

Migrations em `supabase/migrations/`. O histórico local e o remoto divergem
(há versões remotas sem arquivo local), então `supabase db push` falha — as
migrations vêm sendo aplicadas manualmente pelo SQL Editor do Supabase.

Testes das regras de acesso: `supabase/tests/` (ver o README de lá).

## Documentação

| Arquivo | Conteúdo |
|---|---|
| `RELATORIO_MATRIZ_ACESSO_MERCADO.md` | Matriz de acesso por plano × perfil do ativo, rollout em duas fases, checklists |
| `RELATORIO_DEPLOY_E_VALIDACAO.md` | Histórico do deploy e validação do frontend |
| `supabase/tests/README.md` | Suíte de testes das migrations |
| `RELATORIO_SISTEMA_VALUATIONIT.md` | Visão geral do sistema |
