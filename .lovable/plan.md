

## Diagnóstico Confirmado

### Causa raiz: `row_data` é coluna `text`, não `jsonb`

A coluna `sync_queue.row_data` é do tipo `text`. O Supabase client retorna strings para colunas `text`. Então quando o processador faz:

```typescript
const rowData = item.row_data; // ← STRING, não objeto
const tipo = normalizeAssetType(rowData.tipo); // ← undefined.toUpperCase() → CRASH
```

Isso explica o erro `Cannot read properties of undefined (reading 'toUpperCase')` em **todos os 150 itens** — nenhum foi processado.

Os dados estão corretos no banco (JSON válido armazenado como texto), mas o processador nunca os parseia.

### Correção

**Arquivo: `supabase/functions/process-sync-queue/index.ts`**

Na linha 349, adicionar `JSON.parse()`:

```typescript
// ANTES (bug):
const rowData = item.row_data;

// DEPOIS (fix):
const rowData = typeof item.row_data === 'string' 
  ? JSON.parse(item.row_data) 
  : item.row_data;
```

Isso é a única mudança necessária. Após o parse, `rowData.tipo`, `rowData.carteira`, etc., funcionarão corretamente.

### Proteção adicional (defensive coding)

Nas funções `normalizePlanType` e `normalizeAssetType`, adicionar guard para `null`/`undefined`:

```typescript
const normalizePlanType = (value: string): PlanType => {
  if (!value) return "START";
  const normalized = value.toUpperCase().trim();
  // ...
};

const normalizeAssetType = (tipo: string): AssetType => {
  if (!tipo) return "ACAO";
  const normalized = tipo.toUpperCase().trim();
  // ...
};
```

### Redeploy

Redeploy de `process-sync-queue` após a alteração.

### Resultado esperado

- Os 600 itens da fila serão parseados e processados corretamente.
- `sync_log` transicionará de QUEUED → IN_PROGRESS → SUCCESS.
- Métricas `updated`/`failed` refletirão valores reais.

