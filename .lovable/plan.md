

## Diagnóstico

**Problema confirmado**: 963 análises para 601 ativos. A planilha tem 1 linha por ativo, mas o banco mantém análises duplicadas com `carteira` diferente (ex: GARE11 tem uma análise "SPECIALIST" e outra "FALE_C_ESPECIALISTA" de syncs anteriores). São 362 ativos com 2 análises cada.

**Causa raiz**: A constraint `UNIQUE(asset_id, carteira)` permite múltiplas análises por ativo quando o valor de `perfil_investidor` na planilha muda entre syncs. O correto é **1 análise por ativo** (constraint `UNIQUE(asset_id)` apenas).

**Impacto nas carteiras de clientes**: `wallet_items` referencia `asset_id`, não `analysis_id`, então as carteiras de clientes estão intactas. O problema é na exibição — filtros por `carteira` no Mercado podem mostrar dados duplicados ou inconsistentes.

## Correção

### 1. Migration: limpar duplicatas e corrigir constraint

- Deletar análises duplicadas mantendo apenas a mais recente (`updated_at DESC`) por `asset_id`
- Dropar constraints `UNIQUE(asset_id, carteira)` (existem duas: `asset_analyses_asset_carteira_unique` e `asset_analyses_asset_id_carteira_unique`)
- Criar nova constraint `UNIQUE(asset_id)` apenas

### 2. Edge function: `process-sync-queue/index.ts`

- Alterar `onConflict: "asset_id,carteira"` para `onConflict: "asset_id"`
- Isso garante que cada sync sobrescreve a análise existente do ativo, sem criar duplicata

### 3. Redeploy da edge function

### Dados de clientes

As carteiras (`wallet_items`, `wallet_simulator`, `wallet_movements`) referenciam `asset_id` diretamente — não são afetadas pela limpeza de `asset_analyses`. Ficam intactas.

