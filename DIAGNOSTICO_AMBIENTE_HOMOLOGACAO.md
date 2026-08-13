# Diagnóstico de Ambiente — ValuationIT

**Data:** 2026-07-31
**Escopo:** somente leitura. Nenhuma escrita, migration, deploy, alteração de dados/secrets ou configuração de Stripe foi executada durante este diagnóstico.

---

## 1. Confirmação de que o projeto vinculado é produção

Confirmado pelo responsável do projeto (dono do painel Supabase) e registrado aqui como fato operacional, não como inferência técnica:

- **Project ref:** `mbnj***vrg` (mascarado)
- **Nome no painel Supabase:** "ValuationIT Oficial"
- **Rótulo no painel Supabase:** `main` / `PRODUCTION`
- **Status observado via CLI:** `ACTIVE_HEALTHY`
- **Região:** `sa-east-1`
- **Vínculo no repositório:** único project_id referenciado em [supabase/config.toml](supabase/config.toml) e nas variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_PROJECT_ID` do `.env`

**Conclusão:** este é o **único** projeto Supabase existente para o ValuationIT e é **produção real**. Não existe hoje nenhum projeto Supabase separado de homologação, nem branch de homologação (Supabase Branching), nem ambiente de staging.

A evidência técnica (nome "Oficial", status ativo/saudável, único vínculo no repo) já apontava nessa direção antes mesmo da confirmação — por isso a execução foi interrompida na Fase 1 do pedido anterior sem aplicar nada.

---

## 2. O que ainda precisa ser validado em um ambiente real

Trabalho já concluído (revisão estática + teste em Postgres isolado via Docker, documentado em [RELATORIO_IMPLEMENTACAO_PLANOS.md](RELATORIO_IMPLEMENTACAO_PLANOS.md)) que **ainda não foi validado contra o schema real de produção**:

| Item | Por que não pode ser considerado validado ainda |
|---|---|
| Aplicação da migration `20260415120000_plan_model_v2.sql` | Só foi testada contra um schema "stub" reconstruído à mão em container Docker isolado — não é o histórico real de 111 migrations de produção. Diferenças de schema não previstas no stub (colunas extras, triggers, constraints reais) só aparecem ao rodar contra o banco de verdade. |
| Backfill de grandfathering (evidência de pagamento) | Testado só com 4 linhas sintéticas no Docker. O volume e a diversidade real de `profiles` em produção (planos legados, combinações de `plan_start_at`/`stripe_customer_id` não antecipadas) não foram auditados. |
| Fechamento de `asset_analyses` a `authenticated`/`anon` | A ausência de vazamento de campos premium foi validada só no schema stub. Precisa ser confirmada com uma chamada real (`curl` com anon key) contra o projeto de destino, comparando payload de usuário START vs PRO. |
| `assets_market_view` / `asset_analyses_gated` / `get_public_assets` | Não foram exercitadas com o volume real de ativos e análises hoje sincronizados via Google Sheets. |
| Regeneração de `src/integrations/supabase/types.ts` | Hoje está editado manualmente (não gerado). Precisa rodar `supabase gen types typescript` contra o projeto real após a migration ser aplicada em algum ambiente. |
| Resolução de plano Stripe (`planResolution.ts`) | Nunca foi exercitada contra um Customer/Subscription real do Stripe, nem em modo test nem live — só revisão estática de código. |
| Edge Functions atualizadas (`stripe-webhook`, `force-sync-subscription`, `payment-history`, `stripe-reports`, `update-client-plan`, `check-expiring-plans`, `send-welcome-email`, `send-push-notification`) | Nunca foram deployadas nem invocadas em nenhum ambiente real desde as alterações. |
| Fluxo de checkout mensal/trimestral novo | Nunca foi exercitado ponta a ponta (frontend → `create-checkout` → Stripe → webhook → `profiles.plan`). |
| Migração de usuários legados sem downgrade | A garantia "nenhum assinante pago é rebaixado" só foi comprovada em dados sintéticos, não nos dados reais de produção. |

Em resumo: **todo o trabalho de código está pronto e revisado, mas nenhuma parte foi exercitada contra um banco ou Stripe reais.** Aplicar diretamente em produção seria a primeira execução real da migration inteira.

---

## 3. Recursos necessários para criar uma homologação separada

- Uma conta/organização Supabase com permissão para criar novo projeto (a sessão de CLI já autenticada tem esse acesso — é uma conta de agência com múltiplos projetos de clientes diferentes; a criação deve ser feita dentro da organização correta do cliente, não em uma organização de terceiros).
- Plano Supabase que comporte um segundo projeto ativo (checar se a organização está no free tier — free tier tipicamente permite poucos projetos ativos simultâneos e pausa projetos inativos após ~7 dias sem uso).
- Uma conta Stripe em **modo test** (não custa nada — toda conta Stripe já tem modo test habilitado por padrão; só é preciso criar produtos/preços de teste equivalentes aos de produção).
- Domínio/subdomínio separado para o frontend de homologação (ex.: `homolog.valuationit...` ou um deploy de preview da Vercel/Netlify — a apurar conforme onde o frontend é hospedado hoje, não identificado neste diagnóstico pois não há `vercel.json`/`netlify.toml` no repo).
- Acesso de leitura ao schema de produção para poder exportar a estrutura (via `pg_dump --schema-only` ou `supabase db dump`), sem exportar dados de clientes.
- Tempo/API quota do Google Sheets se for necessário popular `assets`/`asset_analyses` de teste via sync real (alternativa: popular manualmente com poucos ativos fictícios, mais seguro).

---

## 4. Passo a passo para criar um novo projeto Supabase de homologação sem afetar produção

**Nenhum destes comandos foi executado. Requer autorização explícita antes de rodar o primeiro passo com efeito (criação do projeto).**

1. Confirmar a organização Supabase correta (a mesma organização de "ValuationIT Oficial": `ymjg***dsa`, mascarada) — criar o novo projeto na organização errada geraria um ambiente órfão sem relação de billing/gestão com o cliente.
2. Criar o projeto via painel Supabase (recomendado, controle visual total) **ou** via CLI:
   ```bash
   npx supabase projects create "ValuationIT Homologacao" --org-id <ORG_ID> --region sa-east-1 --db-password <SENHA_FORTE_GERADA>
   ```
   Nome sugerido explícito para nunca mais gerar ambiguidade: **"ValuationIT Homologação"** (com rótulo de ambiente no próprio nome, diferente do padrão atual que causou esta confusão).
3. Guardar o novo `project ref` retornado — este será o único identificador usado nas próximas fases.
4. **Não rodar `supabase link` no diretório principal do repositório de produção** — para evitar sobrescrever `supabase/config.toml` (que deve continuar apontando para produção). Usar uma cópia separada do repositório (ver item 6) ou `supabase link --project-ref <REF_HOMOLOG>` dentro dessa cópia isolada.
5. Confirmar no painel que o novo projeto está `ACTIVE_HEALTHY` antes de prosseguir para o próximo passo (cópia de schema).

---

## 5. Como copiar somente o schema e configurações necessárias, sem copiar dados pessoais de clientes

1. Exportar **apenas a estrutura** do banco de produção (sem dados):
   ```bash
   npx supabase db dump --linked --schema public -f schema_producao.sql
   ```
   (`--linked` usa o projeto atualmente linkado — que é produção; este comando é **somente leitura** em produção, não escreve nada lá. O arquivo gerado localmente é o que será aplicado em homologação.)
2. Revisar o `schema_producao.sql` gerado antes de aplicar em qualquer lugar, removendo/comentando qualquer `INSERT`/`COPY` de dados que porventura tenha sido incluído (o `--schema public` já deveria trazer só DDL, mas vale conferir).
3. Aplicar esse schema no projeto de homologação (recém-criado, vazio) via `supabase db push` **apontando explicitamente para o project-ref de homologação** — nunca reaproveitar uma sessão de terminal que acabou de rodar comando contra produção sem confirmar o ref antes.
4. Popular dados de teste **sintéticos**, não reais:
   - Criar 5-10 usuários de teste via signup normal do app apontando para homologação (emails tipo `teste-start@...`, `teste-pro@...`) — nunca copiar linhas de `profiles`/`auth.users` de produção.
   - Popular alguns `assets`/`asset_analyses` manualmente ou via um sync do Google Sheets apontando para uma planilha de teste (não a planilha real de produção), para não misturar dados comerciais reais com o ambiente de teste.
   - Se for necessário volume maior para testar performance, gerar dados sintéticos com um script simples, nunca com `pg_dump` de dados reais.
5. Copiar `app_config` apenas nas chaves não sensíveis necessárias para o app funcionar (ex.: `sales_whatsapp_number` pode ser um número de teste fictício, não o real).

---

## 6. Como configurar variáveis locais e Edge Functions para apontar exclusivamente para homologação

1. Criar uma **cópia separada** do diretório do repositório (ex.: clone em outra pasta, `valuationoficial-homolog/`) — evita qualquer risco de rodar um comando no diretório errado por engano.
2. Nessa cópia, editar `supabase/config.toml` trocando `project_id` para o ref de homologação.
3. Criar um `.env` local nessa cópia (nunca no repositório de produção) com:
   ```
   VITE_SUPABASE_URL=https://<ref-homolog>.supabase.co
   VITE_SUPABASE_PROJECT_ID=<ref-homolog>
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key-de-homolog>
   ```
4. Configurar os *secrets* de Edge Functions **no projeto de homologação**, via painel Supabase ou:
   ```bash
   npx supabase secrets set --project-ref <ref-homolog> STRIPE_SECRET_KEY=<chave-TEST-do-stripe>
   npx supabase secrets set --project-ref <ref-homolog> STRIPE_WEBHOOK_SECRET=<webhook-secret-de-teste>
   npx supabase secrets set --project-ref <ref-homolog> STRIPE_PRICE_PRO_MONTHLY=<price-id-test>
   ... (demais price IDs de teste)
   ```
   Sempre passando `--project-ref` explícito em cada comando (nunca depender de um "link" ambíguo).
5. Nunca reutilizar chaves/secrets de produção em homologação — em especial `STRIPE_SECRET_KEY` deve ser a chave que começa com `sk_test_...`, nunca `sk_live_...`.

---

## 7. Como realizar os testes da migration nesse novo ambiente

1. Com o CLI explicitamente apontando para o ref de homologação (`supabase link --project-ref <ref-homolog>` dentro da cópia isolada do repo), rodar:
   ```bash
   npx supabase migration list
   ```
   e confirmar visualmente que a única migration pendente é `20260415120000_plan_model_v2.sql` (as outras 110 já devem estar aplicadas, pois vieram do dump de schema).
2. Aplicar:
   ```bash
   npx supabase db push
   ```
3. Rodar os 12 cenários de teste de grandfathering (já desenhados e documentados em `RELATORIO_IMPLEMENTACAO_PLANOS.md`) contra dados sintéticos de homologação, e confirmar via SQL que `plan_migration_v2_review` só recebeu os casos realmente sem evidência.
4. Regenerar `types.ts` contra homologação:
   ```bash
   npx supabase gen types typescript --project-id <ref-homolog> --schema public > src/integrations/supabase/types.ts
   ```
   (fazer isso na cópia isolada; só levar o resultado para o repositório principal depois de revisado).
5. Deployar as Edge Functions alteradas só nesse projeto (`supabase functions deploy <nome> --project-ref <ref-homolog>`).
6. Rodar os 13 cenários funcionais e os testes de segurança por papel (anon/START/PRO/SPECIALIST/WEALTH/admin) contra a URL de homologação.
7. Rodar eventos de teste do Stripe (test mode) — checkout, cancelamento, renovação — usando cartões de teste do Stripe, nunca cartões reais.

---

## 8. Como confirmar visualmente e tecnicamente que nenhum comando está apontando para produção

- Antes de qualquer comando com efeito (`db push`, `functions deploy`, `secrets set`), rodar `cat supabase/config.toml` (ou equivalente) e conferir que o `project_id` impresso é o ref de homologação — nunca assumir de memória.
- Usar sempre a flag explícita `--project-ref <ref>` em vez de depender do "link" implícito quando o comando aceitar essa flag — reduz o risco de rodar contra o projeto errado por causa de um `link` esquecido de uma sessão anterior.
- Manter a cópia de homologação em uma pasta com nome visualmente distinto (`valuationoficial-homolog`) e, se possível, um prompt de terminal ou `.vscode/settings.json` com cor de barra de status diferente — reduz erro humano de digitar comando na janela errada.
- Antes de rodar `npx supabase db push`, o próprio CLI imprime o project ref de destino no prompt de confirmação — **ler essa linha antes de confirmar**, nunca aceitar automaticamente.
- Verificar no painel Supabase, na aba do projeto de homologação, que a contagem de linhas de `profiles` bate com o número de usuários de teste criados (não com o volume real de produção) — um número de usuários muito maior que o esperado é sinal de que algo foi aplicado no projeto errado.
- Conferir no painel Stripe que a chave usada está em **modo Test** (toggle "Test mode" visível no canto superior do dashboard Stripe) antes de qualquer teste de checkout.

---

## 9. Estimativa dos riscos de aplicar diretamente em produção sem homologação

| Risco | Severidade | Motivo |
|---|---|---|
| Migration falha no meio da execução por diferença de schema não prevista no stub | **Alta** | O stub Docker é uma reconstrução manual, não um dump real — divergências reais (constraints, triggers, colunas) só aparecem contra o banco de produção. Uma falha no meio de uma migration com múltiplos `ALTER`/`UPDATE` pode deixar o schema em estado intermediário. |
| Backfill de grandfathering promove ou deixa de promover usuários incorretamente | **Alta** | Só testado com 4 linhas sintéticas; produção pode ter combinações de `plan`/`plan_start_at`/`stripe_customer_id` não antecipadas no design da regra. Um erro aqui afeta cobrança/acesso de clientes pagantes reais, sem possibilidade de rollback automático (o comentário da própria migration documenta que o backfill físico não é 100% reversível). |
| Fechamento de `asset_analyses` quebra alguma função server-side ainda não identificada | **Média-Alta** | A auditoria de consumidores foi feita por leitura de código, não por execução real; uma function não identificada que dependa da policy antiga (`USING (true)`) pararia de funcionar silenciosamente em produção. |
| Edge Functions atualizadas (webhook, checkout) falham em produção com Stripe live | **Alta** | Nunca foram invocadas com um evento Stripe real. Um erro no `stripe-webhook` em produção pode deixar assinaturas pagas sem sincronizar o plano corretamente, gerando cobrança sem acesso liberado (dano direto ao cliente pagante e risco de reembolso/reclamação). |
| Impossibilidade de reverter rapidamente | **Alta** | Não existe hoje mecanismo de rollback automatizado; a função `backup-database` existe mas nunca foi testada como parte deste fluxo, e restaurar um backup em produção é uma operação de alto risco por si só. |
| Indisponibilidade percebida pelos usuários durante a aplicação | **Média** | `ALTER TYPE`, criação de views e mudança de policies em tabelas com tráfego real podem gerar locks breves; sem trânsito de teste prévio, o tempo de lock real é desconhecido. |

**Conclusão de risco:** aplicar esta migration diretamente em produção, sem nunca ter sido exercitada contra um ambiente real ou contra o Stripe, é uma operação de **alto risco** — o principal motivo não é a qualidade do código (que passou por 4 rodadas de revisão e testes sintéticos), mas a ausência total de validação em runtime real.

---

## 10. Alternativa mais segura caso não seja criado um ambiente de homologação

Caso a criação de um projeto Supabase de homologação não seja aprovada agora, a sequência abaixo reduz risco sem exigir um segundo projeto completo:

1. **Backup verificável antes de qualquer coisa** — confirmar que `backup-database`/`list-backups`/`restore-backup` funcionam de fato (testar um ciclo completo de backup + restore **fora do horário de pico**, ainda sem aplicar a migration), e só então prosseguir.
2. **Aplicar a migration em produção fora do horário de pico**, com uma janela de observação ativa (dashboard aberto, `supabase functions logs` acompanhando em tempo real).
3. **Aplicar em etapas menores** em vez de uma migration monolítica: primeiro só a parte estrutural (novo enum value, novas tabelas/colunas, sem tocar em policies), validar que nada quebrou por um período, depois aplicar a parte de policies/views (`asset_analyses`), validar de novo, só então o backfill de grandfathering por último (a parte de maior risco e menor reversibilidade).
4. **Testar o backfill primeiro em modo "somente leitura"**: rodar a lógica de classificação (evidenced/unevidenced) como uma `SELECT`/`INSERT INTO plan_migration_v2_review`-only (sem o `UPDATE` real) contra produção, revisar manualmente a contagem de usuários que seriam promovidos/preservados/sinalizados para revisão, e só rodar o `UPDATE` de fato depois dessa conferência humana.
5. **Manter o Stripe em modo test para a primeira rodada de smoke test em produção**: testar o fluxo de checkout com a chave test mesmo com o app apontando para o banco de produção (checkout de teste não gera cobrança real, e o profile atualizado pode ser de uma conta de teste dedicada dentro do banco de produção, isolada e removida depois).
6. Esta alternativa é estritamente **menos segura** que uma homologação real — não elimina os riscos listados na seção 9, apenas os reduz com observação humana ativa e reversão em etapas. A recomendação continua sendo criar o ambiente de homologação separado antes de aplicar em produção.

---

## Encerramento

Nenhuma escrita foi realizada em nenhum projeto Supabase durante este diagnóstico. Nenhum commit, push ou deploy foi feito. A execução permanece parada aguardando decisão sobre a criação (ou não) do ambiente de homologação, conforme instruído.
