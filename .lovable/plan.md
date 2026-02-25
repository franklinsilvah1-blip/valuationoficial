

## Diagnóstico Completo

### Problema Real (confirmado pela DB)
Os 5 sync_logs mais recentes estão **todos em status QUEUED** com `updated=null`, `failed=null` e `sync_queue` **completamente vazia**. Isso confirma que:

1. `sync-google-sheets` funciona corretamente: busca 600 linhas, popula a fila, define status QUEUED
2. `process-sync-queue` **não processou nada** -- deletou a fila inteira

A causa raiz é que as edge functions da correção anterior **podem não ter sido deployadas corretamente**, ou há um bug adicional: `sync-google-sheets` define `completed_at` no status QUEUED (linha 920), o que faz o `useSyncStatus` no frontend detectar um "processo travado" e a fila aparecer como vazia.

### Bugs Identificados (3 problemas)

**Bug 1 -- `completed_at` definido prematuramente (sync-google-sheets, linha 920)**
Quando `sync-google-sheets` muda o status para QUEUED, também define `completed_at`. Isso é semanticamente incorreto: o sync não terminou, apenas enfileirou. Consequências:
- O frontend `useSyncStatus` encontra um log QUEUED mas antigo → marca como "travado"
- O monitor pode considerar esse sync como finalizado

**Bug 2 -- Lock liberado antes do processor iniciar (sync-google-sheets, linhas 944-948)**  
`sync-google-sheets` libera o lock logo após enfileirar e ANTES de o `process-sync-queue` realmente iniciar. Quando `process-sync-queue` tenta adquirir o lock novamente, pode haver uma janela onde outro sync é disparado, ou a UI mostra "sistema livre" prematuramente.

**Bug 3 -- `useSyncStatus` mostra "travado" para sync QUEUED legítimo (AdminSync.tsx, linhas 228-234)**
A detecção de `isStuck` usa apenas tempo desde `started_at > 5 min`. Para um sync QUEUED que acabou de ser criado (~1 segundo), isso é OK. Mas como `completed_at` é preenchido, o sync fica "entre estados": QUEUED com completed_at, sem fila ativa → parece morto.

### Plano de Correção

#### 1. `supabase/functions/sync-google-sheets/index.ts`
- **Remover `completed_at`** do update para QUEUED (linha 920). O `completed_at` só deve ser definido quando o processamento realmente terminar (pelo `process-sync-queue`)
- Manter o lock **ativo** até que `process-sync-queue` o adquira, em vez de liberá-lo prematuramente. Ou, melhor: o processo atual de liberar lock + trigger está OK, mas o lock deve ser adquirido pelo processor de forma coordenada

#### 2. `supabase/functions/process-sync-queue/index.ts`  
- Garantir que o código aceita QUEUED (já está correto no arquivo)
- **Remover a necessidade de lock no processor** para chamadas internas (quando chamado pelo sync-google-sheets via trigger). O lock já foi liberado pelo sync-google-sheets, então o processor deve funcionar sem ele para a primeira chamada
- OU: não liberar o lock no sync-google-sheets e deixar o processor herdar o lock

**Solução escolhida**: O processor NÃO deve tentar adquirir lock quando chamado como trigger do sync-google-sheets. Adicionar um parâmetro `skipLock` no body da chamada interna para pular a aquisição de lock quando é uma chamada sequencial.

#### 3. `supabase/functions/monitor-sync-queue/index.ts`
- Adicionar QUEUED sem `completed_at` como estado monitorável separado (QUEUED com itens pendentes = ativo, QUEUED sem itens = órfão a finalizar)
- O monitor já está com timeout de 10 min, manter

#### 4. `src/pages/app/AdminSync.tsx`
- Ajustar `useSyncStatus`: não marcar como `isStuck` se o sync está em QUEUED e há itens na fila (sync_queue com PENDING > 0)
- Corrigir a detecção para considerar que QUEUED é um estado transitório normal

### Detalhes Técnicos das Mudanças

**sync-google-sheets (linhas 913-948)**:
```text
- Remover completed_at do update QUEUED
- NÃO liberar lock (deixar para o processor)
- Trigger do processor: adicionar { skipLock: true } no body
```

**process-sync-queue (handler principal)**:
```text
- Aceitar skipLock no body do request
- Se skipLock=true, pular acquireSyncLock() e pular releaseSyncLock() no finally
- Se skipLock=false (chamada cron), adquirir lock normalmente
- No final do processamento completo (remaining=0), sempre liberar lock
```

**AdminSync.tsx (useSyncStatus)**:
```text
- isStuck: considerar travado apenas se QUEUED/IN_PROGRESS > 5 min
  E sync_queue está vazia para aquele sync_log
- Se há itens PENDING na fila, NÃO é stuck (está processando)
```

### Redeploy
Após as alterações, forçar o redeploy das 3 edge functions para garantir que o código novo esteja ativo.

