
Objetivo: corrigir o fluxo para que (1) os 600 itens realmente persistam no banco e (2) o botão saia de “Sincronizando...” ao finalizar.

1) Corrigir persistência dos ativos/análises (edge function `process-sync-queue`)
- Ajustar o `upsert` de `asset_analyses` para usar o conflito real da tabela:
  - de `onConflict: "asset_id"`
  - para `onConflict: "asset_id,carteira"`
- Manter `row_data` com parse defensivo (já aplicado) e reforçar tratamento de erro por item com mensagem curta no `error_message`.
- Garantir que o contador final do `sync_log` use:
  - `updated = COMPLETED`
  - `failed = FAILED`
  - sem “sucesso falso” quando tudo falhar.

2) Corrigir conclusão do sync (remove travamento do botão)
- No bloco de finalização da mesma function, remover query inválida em `sync_queue`:
  - de `.select("status, metadata")`
  - para `.select("status")` (a coluna `metadata` não existe nessa tabela).
- Separar “finalização de `sync_logs`” de “envio de notificação”:
  - finalizar status (`SUCCESS`/`PARTIAL`/`FAILED`) e `completed_at` primeiro;
  - enviar notificação depois em bloco `try/catch` isolado (sem impedir conclusão).
- Manter release de lock ao final (`remaining === 0`) e fallback seguro em erro.

3) Ajustar UX de progresso no `AdminSync.tsx` (evitar leitura enganosa)
- `useQueueStats` deve retornar contadores separados:
  - `completedCount`, `failedCount`, `pendingCount`, `processingCount`.
- Trocar rótulo “Processados” por “Finalizados”.
- Exibir falhas explicitamente na UI (badge/card), para não parecer sucesso quando `failed > 0`.
- Manter botão desabilitado apenas por atividade real (lock/fila/log ativo), não por interpretação ambígua.

4) Estabilização pós-fix
- Aplicar limpeza única de resíduos (se houver logs presos antigos):
  - `force-sync-cleanup` para marcar órfãos e liberar lock.
- Redeploy obrigatório:
  - `process-sync-queue` (principal)
  - `sync-google-sheets` (somente se ajustar payload/telemetria)
- Validação operacional:
  - executar sync manual;
  - confirmar em `sync_logs`: transição até status terminal e `completed_at` preenchido;
  - confirmar em banco: `asset_analyses` atualizado (não só fila processada);
  - confirmar UI: barra 100% + botão liberado em seguida.

Seção técnica (resumo objetivo)
- Defeito crítico 1: chave de conflito incompatível com constraint real (`asset_id,carteira`) → falha de upsert em massa.
- Defeito crítico 2: select de coluna inexistente (`sync_queue.metadata`) no fluxo de conclusão → sync pode ficar em `IN_PROGRESS/QUEUED` mesmo com 100% da barra.
- Efeito visível: “600/600 processados” sem refletir ativos atualizados + botão preso em estado ativo.
