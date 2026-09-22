# Testes da matriz de acesso ao Mercado

Estes testes executam as migrations `20260922120000` (FASE A) e `20260922130000`
(FASE B) num **PostgreSQL de verdade**, compilado para WebAssembly
([PGlite](https://github.com/electric-sql/pglite)) — sem Docker, sem servidor,
sem tocar em nenhum banco real.

Eles existem porque "o SQL passa no parser" não prova regra de negócio. Aqui a
matriz de permissão é verificada caso a caso, com `SET ROLE anon` de verdade.

## Como rodar

```bash
npm install --no-save @electric-sql/pglite
node supabase/tests/01-matriz-de-acesso.mjs
node supabase/tests/02-rollout-e-desempenho.mjs
node supabase/tests/03-superficie-anon.mjs
```

Cada script sai com código 0 se tudo passou e 1 se algo falhou.

> `@electric-sql/pglite` é instalado com `--no-save` de propósito: é ferramenta
> de teste, não dependência da aplicação, e esta rodada não alterou
> `package.json` nem o lockfile.

## O que cada suíte cobre

### 01 — matriz de acesso (62 casos)

- **Nível do usuário**: START, PRO, SPECIALIST, WEALTH, admin, PRO vencido,
  `plan_end_at` ilegível, plano desconhecido, plano nulo, legados
  (`FREE`/`TESTE`/`FALE_C_ESPECIALISTA`) e anônimo.
- **Matriz de campos** em `assets_market_view` para cada combinação de plano ×
  PERFIL do ativo, incluindo a preservação de TENDÊNCIA TRIM para o PRO em
  ativo SPECIALIST.
- **Top 20**: ordenação por ROI 2026, exclusão de ROI ilegível e de ativo
  inativo, colunas expostas, `recomendacao` mascarada para anônimo.
- **Busca pública restrita ao Top 20**: ticker de dentro encontra, ticker de
  fora não; busca parcial e por nome não escapam; curingas `%` e `_` não
  enumeram.
- `normalize_asset_profile` e `safe_parse_numeric` (fail-safe).

### 02 — rollout e desempenho (25 casos)

- **Preflight da FASE A** aborta com dependência ausente e com ordem de coluna
  divergente, sem criar nada.
- **Atomicidade**: erro no meio da migration → ROLLBACK automático.
- **FASE B**: aborta sem a FASE A; remove os privilégios certos; preserva os de
  `authenticated`; é idempotente; funciona mesmo sem `asset_highlights`.
- **Desempenho**: `EXPLAIN ANALYZE` confirma que
  `current_user_market_level()` vira InitPlan e roda **6 vezes por query**
  (`loops=1` em cada), com 30 ou com 330 linhas — não uma vez por linha/campo.

### 03 — superfície do papel `anon` (21 casos)

Faz `SET ROLE anon` e tenta, uma a uma, todas as rotas conhecidas. Documenta o
estado **antes** (anon enumerava tudo) e prova o estado **depois**: a única
coisa que `anon` consegue executar é `get_public_market_assets`, limitada ao
Top 20 e a 5 colunas, com `recomendacao` nula.

## Limites destes testes

- Usam **stubs** para o que é do Supabase: `auth.uid()`, `profiles`,
  `has_role()`, `app_role` e os papéis `anon`/`authenticated`. A lógica das
  migrations roda sem alteração, mas o comportamento do GoTrue/PostgREST em si
  não é testado aqui.
- Os dados são sintéticos (30 ativos com ROI decrescente e perfis alternados),
  escolhidos para tornar o ranking previsível. Não substituem a verificação
  contra a base real — veja o checklist em
  `RELATORIO_MATRIZ_ACESSO_MERCADO.md`.
- Não testam RLS de `profiles` nem nada fora do escopo de Mercado.
