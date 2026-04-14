

## Plano de Ajustes - ValuAtion v11/04/2026

### 1. Alterar banner FREE na tela Mercado

**Arquivo**: `src/pages/app/MercadoApp.tsx` (linhas 770-807)

Substituir o conteudo do card FREE:
- **Titulo**: "Ativos em Destaque" (manter)
- **Texto**: "Acesse os melhores ativos globais recomendados por Especialistas." (substituir o texto atual)
- **Badges**: Trocar as 4 badges atuais (TOP TRIM, TOP DY, Analises Completas, Recomendacoes Exclusivas) por 3 checkmarks:
  - ✓ Ativos TOP ANO
  - ✓ Ativos TOP TRIM  
  - ✓ Ativos TOP GANHOS
- **Botao**: Simplificar para "Fazer upgrade plano" (remover o texto em 2 linhas "Fazer Upgrade para ver ativos em destaque")

### 2. Remover secao "Ativos TOP em Destaque" para planos pagos

**Arquivo**: `src/pages/app/MercadoApp.tsx` (linhas 809-838)

Remover completamente o bloco condicional `{userPlan !== "FREE" && topAssets && ...}` que renderiza os cards TOP TRIM/TOP DY em destaque. Isso inclui remover tambem a query `topAssets` (linhas ~140-270) que busca esses dados, ja que nao sera mais usada.

### 3. Confirmar que a ordenacao esta funcionando

A logica de sort client-side ja existe com `sortResultsClientSide` e `parseNumericText` (linhas 25-51). As opcoes ROI 2026, ROI 2025 e ROI 2023A26 ja estao no select (linhas 762-764). A funcao aplica sort numerico corretamente. Vou verificar se ha algum bug impedindo o funcionamento e corrigir se necessario.

---

### Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/app/MercadoApp.tsx` | Banner FREE + remover secao TOP destaque + validar sort |

