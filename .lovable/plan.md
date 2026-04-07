

## Plano de Ajustes - Plataforma ValuAtion v06/04/2026

### Contexto

O documento lista 4 ajustes + 1 bug de build existente. Analisei todo o código envolvido.

---

### 1. Simplificar acesso: planos pagos veem tudo, FREE vê card resumido

**Situação atual**: A lógica em `assetAccessHelper.ts` e `fieldVisibility.ts` restringe campos baseado no cruzamento PLANO x PERFIL_DO_ATIVO (ex: START so ve START, PRO ve START+PRO).

**Mudança**: Qualquer plano pago (START, PRO, SPECIALIST) = card completo. Apenas FREE = card resumido.

**Arquivos**:
- `src/utils/assetAccessHelper.ts` — Simplificar: `plan !== "FREE"` → `cardType: "full"`
- `src/utils/fieldVisibility.ts` — `getFieldVisibility`: se nao e FREE, retorna `FULL_VISIBILITY`. Idem para `hasFullAccessToAsset`.

---

### 2. Atualizar filtro "Nota Especialista": remover "TOP PDY", adicionar "TOP GANHOS"

**Arquivos**:
- `src/utils/filterMappings.ts` — No array `NOTA_ESPECIALISTA_OPTIONS`: trocar `{ value: "Ativo TOP PDY", label: "Ativo TOP PDY" }` por `{ value: "Ativo TOP GANHOS", label: "Ativo TOP GANHOS" }`. Atualizar tambem o objeto `labels.nota_especialista`.
- `src/components/AssetCard.tsx` — Na funcao de estilo da badge (linha ~255): trocar `TOP PDY` por `TOP GANHOS` na condicao de estilo escuro.

---

### 3. Corrigir/ativar a funcao "Ordenar por"

**Situacao atual**: O select de ordenacao ja existe com varias opcoes, e a logica de sort no Supabase query tambem existe. A query faz `query.order("asset_analyses.roi2026", ...)` etc.

**Problema provavel**: Os campos sao armazenados como `text` no banco (nao `numeric`), entao a ordenacao e lexicografica (ex: "9%" > "51%"). Isso precisa de cast ou sort client-side.

**Mudanca solicitada**: Manter 3 opcoes de ordenacao conforme pedido:
- ROI 2026 (decrescente)
- ROI 2025 (decrescente)  
- ROI 2023/2025 (decrescente — campo agora renomeado para 2023A26)

Adicionar opcoes `roi2025` e `roi2023a2025` no select e na logica de query (ambas as queries, linhas ~198 e ~345). Para o sort funcionar corretamente com campos text, aplicar sort client-side convertendo para numero.

**Arquivos**:
- `src/pages/app/MercadoApp.tsx` — Adicionar opcoes no `<select>`, adicionar handlers de sort nas 2 queries, e adicionar sort client-side pos-fetch para corrigir ordenacao textual.

---

### 4. Renomear "ROI 2023A25" para "ROI 2023A26"

**Arquivos** (label de exibicao apenas, o campo do banco permanece `roi2023a2025`):
- `src/components/AssetCard.tsx` — Trocar todas as ocorrencias de `ROI 2023A25:` por `ROI 2023A26:`
- `src/pages/app/MercadoApp.tsx` — Se houver labels no select de ordenacao

---

### 5. Fix build error: `process.env` em ErrorBoundary

**Arquivo**: `src/components/ErrorBoundary.tsx` linha 76
- Trocar `process.env.NODE_ENV === "development"` por `import.meta.env.DEV` (Vite)

---

### Resumo de arquivos impactados

| Arquivo | Ajustes |
|---------|---------|
| `src/utils/assetAccessHelper.ts` | #1 - Simplificar acesso |
| `src/utils/fieldVisibility.ts` | #1 - Simplificar visibilidade |
| `src/utils/filterMappings.ts` | #2 - TOP PDY → TOP GANHOS |
| `src/components/AssetCard.tsx` | #2 badge style + #4 rename label |
| `src/pages/app/MercadoApp.tsx` | #3 sort options + #4 rename label |
| `src/components/ErrorBoundary.tsx` | #5 build fix |

