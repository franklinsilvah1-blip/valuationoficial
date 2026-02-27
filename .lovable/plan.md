

## Causa Raiz Encontrada

A tabela `wallet_movements` no banco de dados está **sem PRIMARY KEY, sem DEFAULT no `id`, e todas as colunas são nullable**. Isso significa que:

1. Quando um registro é inserido sem `id`, ele fica com `id = NULL`
2. A query de delete (`.eq('id', id)`) **nunca consegue encontrar registros com id NULL** (em SQL, `NULL = NULL` é sempre `false`)
3. Existem 6 de 40 registros com `id` NULL no banco agora

**Evidência do banco:**

```text
total registros: 40
com id:          34
sem id (NULL):    6   ← estes nunca podem ser deletados
```

A coluna `id` deveria ter `PRIMARY KEY DEFAULT gen_random_uuid()` conforme a migration original, mas o schema real mostra `is_nullable: YES`, sem default, sem constraint de PK.

## Correções

### 1. Migration para corrigir a tabela `wallet_movements`

Novo arquivo: `supabase/migrations/<timestamp>_fix_wallet_movements_schema.sql`

```sql
-- Gerar UUIDs para registros que não têm id
UPDATE wallet_movements SET id = gen_random_uuid() WHERE id IS NULL;

-- Gerar timestamps para registros sem created_at
UPDATE wallet_movements SET created_at = now()::text WHERE created_at IS NULL;

-- Adicionar DEFAULT e NOT NULL na coluna id
ALTER TABLE wallet_movements 
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Adicionar PRIMARY KEY
ALTER TABLE wallet_movements ADD PRIMARY KEY (id);

-- Garantir NOT NULL nas colunas obrigatórias
ALTER TABLE wallet_movements ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN codigo_b3 SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN tipo_operacao SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN valor_por_acao SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN quantidade SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN data_operacao SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN created_at SET DEFAULT now()::text;

-- Recriar índices de performance
CREATE INDEX IF NOT EXISTS idx_wallet_movements_user_id ON wallet_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_movements_data_operacao ON wallet_movements(data_operacao);
```

### 2. Frontend: Gerar UUID no insert como fallback

Em `src/hooks/useWalletMovements.ts`, adicionar `crypto.randomUUID()` no insert para garantir que o `id` sempre esteja presente, mesmo que o default do banco falhe:

```ts
const { error } = await supabase
  .from('wallet_movements')
  .insert({
    id: crypto.randomUUID(),  // ← garantia de ID
    user_id: user.id,
    ...
  } as any);
```

### Resumo

| Alteração | Arquivo |
|-----------|---------|
| Corrigir schema: PK, defaults, NOT NULL | Nova migration SQL |
| Gerar UUID no insert como fallback | `src/hooks/useWalletMovements.ts` |

