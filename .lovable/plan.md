
Objetivo: corrigir definitivamente a sincronização Google Sheets em modo fila, eliminando o cenário em que a limpeza forçada “funciona” mas a sincronização nunca conclui.

Diagnóstico (baseado em logs + código)
1) Causa raiz principal:
- `sync-google-sheets` cria `sync_log` como `IN_PROGRESS`, mas logo após enfileirar altera para `QUEUED`.
- `process-sync-queue` só aceita processar quando o `sync_log` está `IN_PROGRESS`.
- Resultado: o processor encontra `QUEUED`, considera inválido, apaga itens da fila e encerra com 0 processados.
- Evidência no log: `Sync log is not IN_PROGRESS, cleaning queue items ... status: "QUEUED"`.

2) Efeito colateral:
- `sync_logs` recentes ficam em `QUEUED` com `total_rows=600`, sem `updated/failed`, e `sync_queue` fica vazia.
- Isso dá sensação de “iniciou mas não concluiu”.

3) Fragilidades adicionais encontradas:
- `process-sync-queue` incrementa `failed` duas vezes no catch do item (contagem incorreta).
- `monitor-sync-queue` tem regra de timeout de `IN_PROGRESS > 60s`, agressiva para lotes grandes.
- Filtros de “ativos órfãos” usando `.not("codigo_b3", "in", ...)` com string sem quoting robusto podem falhar em tickers especiais (risco funcional).

Arquitetura de correção (estado da sincronização)
```text
INÍCIO MANUAL/CRON
  -> sync-google-sheets cria sync_log = QUEUED
  -> popula sync_queue (PENDING)
  -> dispara process-sync-queue

process-sync-queue
  -> valida sync_log aceitando QUEUED ou IN_PROGRESS
  -> ao iniciar processamento real: muda QUEUED -> IN_PROGRESS
  -> processa lotes
  -> quando remaining = 0: fecha sync_log em SUCCESS/PARTIAL/FAILED
  -> limpa itens COMPLETED
```

Plano de implementação (arquivos e mudanças)
1) Corrigir máquina de estados entre funções (principal)
- Arquivo: `supabase/functions/process-sync-queue/index.ts`
- Ajustes:
  - Em `processQueueBatch`, aceitar `sync_log.status` em `['QUEUED', 'IN_PROGRESS']`.
  - Se status for `QUEUED`, promover para `IN_PROGRESS` antes do primeiro lote (com timestamp consistente).
  - Remover comportamento destrutivo de apagar fila quando status for `QUEUED`.
  - Manter limpeza destrutiva apenas para estados finais (`SUCCESS`, `FAILED`, `TIMEOUT`, etc.).
- Resultado esperado:
  - Não haverá mais descarte indevido da fila.

2) Padronizar criação/atualização de status no início da sync
- Arquivo: `supabase/functions/sync-google-sheets/index.ts`
- Ajustes:
  - Manter `QUEUED` após enfileirar (coerente com “aguardando processamento”).
  - Garantir metadata consistente (`items_queued`, `sheet_codigos_b3`, duplicatas) para finalização posterior.
  - Garantir que trigger do processor não falhe silenciosamente (log explícito com contexto).
- Resultado esperado:
  - Estado inicial claro e compatível com processor.

3) Corrigir contadores e integridade dos resultados
- Arquivo: `supabase/functions/process-sync-queue/index.ts`
- Ajustes:
  - Remover incremento duplicado de `failed` no bloco de erro por item.
  - Revisar atualização incremental de `sync_logs.updated/failed` para refletir exatamente o lote.
- Resultado esperado:
  - métricas reais no painel/admin e notificações corretas.

4) Endurecer finalização e desativação de órfãos
- Arquivo: `supabase/functions/process-sync-queue/index.ts`
- Ajustes:
  - Tornar filtro `NOT IN` de `codigo_b3` robusto (quote-safe), evitando quebra com strings/tickers não triviais.
  - Preservar metadata original + metadata de fechamento sem sobrescrever campos críticos.
- Resultado esperado:
  - fechamento confiável e limpeza de ativos órfãos sem efeito colateral.

5) Ajustar monitor para não matar sync saudável
- Arquivo: `supabase/functions/monitor-sync-queue/index.ts`
- Ajustes:
  - Substituir regra agressiva `IN_PROGRESS > 60s` por critério de “sem progresso real por janela maior” (ex.: 10+ min).
  - Considerar sinais de progresso (redução de PENDING, aumento de COMPLETED/FAILED) antes de forçar FAIL.
- Resultado esperado:
  - elimina falso positivo de travamento durante processamento legítimo de 600+ linhas.

6) Alinhamento do painel admin (observabilidade)
- Arquivo: `src/pages/app/AdminSync.tsx`
- Ajustes:
  - Considerar `QUEUED` como estado ativo no cálculo/status visual (além de `IN_PROGRESS`).
  - Exibir motivo quando fila for limpa por estado inválido (se ocorrer no futuro), para diagnóstico rápido.
- Resultado esperado:
  - painel reflete o estado real e evita “sumiço” da sincronização.

Plano de validação (fim-a-fim)
1) Teste funcional principal:
- Disparar “Sincronizar Agora” com ~600 linhas.
- Esperado:
  - `sync_log`: `QUEUED -> IN_PROGRESS -> SUCCESS/PARTIAL`.
  - `sync_queue`: PENDING reduz gradualmente até 0.
  - `updated/failed/total_rows` preenchidos corretamente.

2) Teste de robustez:
- Disparar 2 sincronizações seguidas rapidamente.
- Esperado:
  - segunda execução bloqueada com mensagem de fila/sync ativa sem corromper primeira.

3) Teste de recuperação:
- Executar “Forçar Limpeza” com fila órfã simulada.
- Esperado:
  - lock liberado + estado consistente + próxima sincronização conclui.

4) Teste de monitor:
- Com sync longa ativa, monitor não deve finalizar com timeout prematuro.

5) Verificação por logs/DB:
- Edge logs de `sync-google-sheets`, `process-sync-queue`, `monitor-sync-queue`.
- SQL: últimos `sync_logs` e contagem por status em `sync_queue`.

Riscos e mitigação
- Risco: alterar estado sem considerar fluxos antigos.
  - Mitigação: aceitar retrocompatibilidade (`QUEUED` e `IN_PROGRESS`) no processor.
- Risco: monitor continuar agressivo.
  - Mitigação: timeout por inatividade real, não apenas por duração.
- Risco: regressão em métricas do painel.
  - Mitigação: validação cruzada logs x DB x UI.

Seção técnica (explicação simples)
- Hoje o sistema enfileira corretamente, mas o processador “espera outro status” e por isso joga a fila fora.
- A correção é alinhar o “idioma de status” entre as funções.
- Depois disso, a sincronização vai de ponta a ponta: enfileira, processa, fecha log e atualiza painel.
