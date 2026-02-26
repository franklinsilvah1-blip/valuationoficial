

## Diagnóstico Confirmado (3 problemas raiz)

### Bug 1: Botão travado em "Sincronizando..." após Forçar Limpeza
**Causa**: `force-sync-cleanup` só limpa logs com status `IN_PROGRESS` (linha 84), mas todos os 5 logs recentes estão em `QUEUED`. Após a limpeza, os logs QUEUED persistem → `useSyncStatus` os encontra → `isActive: true` → botão permanece desabilitado.

**Correção**: `force-sync-cleanup/index.ts` — limpar logs em QUEUED **e** IN_PROGRESS.
```
.in('status', ['IN_PROGRESS', 'QUEUED'])
```

### Bug 2: `process-sync-queue` nunca executa (sem logs)
**Causa**: O `finally` block (linha 1009-1011) **sempre** chama `releaseSyncLock()`, mesmo quando `skipLock=true`. Isso libera o lock imediatamente e pode causar conflitos. Além disso, a auto-continuação via `fetch()` no finally pode falhar silenciosamente.

**Correção**: `process-sync-queue/index.ts` — só liberar lock no `finally` quando `skipLock === false`. Quando `skipLock=true`, o lock deve ser liberado apenas ao finalizar o sync (remaining=0) ou em erro.

```typescript
} finally {
  // Só liberar lock se NÃO foi herdado (chamada via cron)
  if (!skipLock) {
    await releaseSyncLock(supabaseClient);
  }
}
```

E na finalização bem-sucedida (remaining=0), sempre liberar:
```typescript
if (result.remaining === 0) {
  await releaseSyncLock(supabaseClient);
}
```

### Bug 3: Hero image carregando na página admin
**Causa**: `ResourceHints.tsx` faz prefetch da rota `/` (homepage) a partir de qualquer página, o que faz o Vite carregar `Index.tsx` com o import do `hero-background.webp`.

**Correção**: `ResourceHints.tsx` — remover rotas admin do prefetch e limitar o prefetch apenas a rotas públicas quando o usuário está em área pública. Adicionar guard para não prefetchar `/` quando já está em `/app/*`.

---

## Plano de Implementação

### 1. `supabase/functions/force-sync-cleanup/index.ts`
- Linha 84: Trocar `.eq('status', 'IN_PROGRESS')` por `.in('status', ['IN_PROGRESS', 'QUEUED'])`
- Linha 99: Idem para o update
- Mensagens de log: atualizar para mencionar QUEUED + IN_PROGRESS

### 2. `supabase/functions/process-sync-queue/index.ts`
- Linhas 1008-1011 (finally block): Condicionar `releaseSyncLock` a `!skipLock`
- Após a finalização do sync (remaining=0, status SUCCESS no bloco ~linha 732-960): Garantir chamada explícita a `releaseSyncLock`
- Mover `skipLock` para escopo acessível pelo `finally` (já está — variável `let skipLock` na linha 548)

### 3. `src/components/ResourceHints.tsx`
- Adicionar guard: se `currentPath` começa com `/app/`, não fazer prefetch de rotas públicas como `/`
- Isso evita carregar o bundle da homepage (com hero-background.webp) em páginas admin

### 4. Deploy
- Redeploy das 3 edge functions: `force-sync-cleanup`, `process-sync-queue`, `sync-google-sheets`

---

## Fluxo Esperado Após Correção

1. Admin clica "Forçar Limpeza" → limpa logs QUEUED e IN_PROGRESS → botão "Sincronizar Agora" fica disponível
2. Admin clica "Sincronizar Agora" → `sync-google-sheets` cria log QUEUED, popula fila, triggera `process-sync-queue` com `skipLock=true`
3. `process-sync-queue` promove QUEUED→IN_PROGRESS, processa batch, auto-continua com `skipLock=true`
4. Ao finalizar (remaining=0), libera lock e marca log como SUCCESS
5. Na página admin, nenhum carregamento de hero-background.webp

