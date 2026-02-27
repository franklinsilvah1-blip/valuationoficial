

## Problema

A coluna `valor_por_acao` na tabela `wallet_movements` é do tipo `integer`, mas valores de ações são decimais (ex: R$ 5,19). O Postgres rejeita "5.19" como integer, causando o erro `invalid input syntax for type integer: "5.19"`.

A coluna `quantidade` também é `integer`, o que é correto para ações inteiras, mas pode falhar para frações.

## Correção

### 1. Migration: alterar tipo das colunas

```sql
ALTER TABLE public.wallet_movements 
  ALTER COLUMN valor_por_acao TYPE numeric USING valor_por_acao::numeric;

ALTER TABLE public.wallet_movements 
  ALTER COLUMN quantidade TYPE numeric USING quantidade::numeric;
```

Alterar ambas para `numeric` garante suporte a valores decimais. Dados existentes (inteiros) são convertidos automaticamente sem perda.

### 2. Atualizar types.ts

Atualizar o tipo gerado para refletir `number` em vez de `number` (já é number no TS, mas o schema precisa bater).

Nenhuma alteração no frontend é necessária -- o hook `useWalletMovements` já envia os valores como `number`.

