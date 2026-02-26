
Diagnóstico confirmado (com base nos logs e schema atual):
- A falha em massa NÃO está no `asset_analyses`.
- O erro `there is no unique or exclusion constraint matching the ON CONFLICT specification` vem do upsert em `assets` com `onConflict: "codigo_b3"`.
- A tabela `assets` hoje só tem `PRIMARY KEY (id)` e não tem `UNIQUE (codigo_b3)`, então o `upsert` quebra em todos os itens.
- Resultado observado: 600 itens processados com falha e `error_message` igual para todos na fila.

Plano de correção (estrutura completa de sincronização):

1) Corrigir schema para suportar upsert de ativos
- Criar migration apenas de schema para:
  - `ALTER TABLE public.assets ALTER COLUMN codigo_b3 SET NOT NULL`
  - `ALTER TABLE public.assets ADD CONSTRAINT assets_codigo_b3_unique UNIQUE (codigo_b3)`
- Antes da migration, validar duplicidade/valor vazio em `assets.codigo_b3`; se houver, limpar dados existentes e só então aplicar constraint.

2) Melhorar diagnóstico de falha no processamento (edge function)
- Arquivo: `supabase/functions/process-sync-queue/index.ts`
- Separar erros por etapa com mensagens explícitas:
  - `ASSET_UPSERT_ERROR: ...`
  - `ANALYSIS_UPSERT_ERROR: ...`
  - `ROW_PARSE_ERROR: ...`
- Persistir `error_message` curto e legível em `sync_queue`.
- No fechamento da sync, agregar top motivos de falha (ex.: contagem por `error_message`) e salvar em `sync_logs.metadata` para consumo da UI.

3) Garantir finalização de sync mesmo quando tudo falhar
- Em `process-sync-queue`, reforçar finalização terminal quando `remaining=0` (inclusive cenário 100% FAILED), sempre preenchendo:
  - `status` final (`FAILED`/`PARTIAL`/`SUCCESS`)
  - `completed_at`
  - `updated` e `failed`
- Garantir que lock seja liberado em qualquer estado terminal.

4) Tornar monitor responsável por “fechar órfãos sem pendências”
- Arquivo: `supabase/functions/monitor-sync-queue/index.ts`
- Se `sync_log` estiver `IN_PROGRESS/QUEUED` e não houver `PENDING/PROCESSING`, finalizar automaticamente com base na fila (`COMPLETED` vs `FAILED`) em vez de apenas “continuar”.
- Isso evita botão preso quando o processador não reentra para o passo final.

5) Mostrar motivo da falha no painel admin
- Arquivo: `src/pages/app/AdminSync.tsx`
- Adicionar bloco “Motivos de falha da última sincronização” com:
  - Top erros agregados (mensagem + quantidade)
  - Exemplo de linhas (`row_index`) afetadas
  - Sync log ID e timestamp
- Exibir status final claro (`Falhou`, `Parcial`, `Sucesso`) e não apenas progresso numérico.

6) Validação pós-correção
- Executar: `force-sync-cleanup` (uma vez) para limpar estado anterior.
- Rodar nova sincronização manual.
- Confirmar:
  - `assets` e `asset_analyses` atualizados
  - `sync_queue` sem itens presos
  - `sync_logs` com status terminal e `completed_at`
  - UI exibindo o motivo real de falha quando ocorrer.

Seção técnica (objetiva):
- Causa raiz primária: ausência de `UNIQUE (codigo_b3)` em `assets` para suportar `upsert(..., { onConflict: "codigo_b3" })`.
- Causa secundária operacional: fluxo permite ficar sem finalização terminal em alguns cenários, mantendo percepção de processo “rodando”.
- Correção definitiva combina: constraint correta + finalização robusta + observabilidade de erro no Admin.
