

## Problema

O hook `useWalletSimulator` não expõe estado de erro (`isError`, `error`) para a página Carteira. Se qualquer query falhar (sessão expirada, erro de rede, etc.), os dados retornam como arrays vazios e a página mostra "Você ainda não tem ativos na carteira" -- mesmo que o usuário tenha dados reais. O usuário pensa que perdeu seus dados quando na verdade é um erro silencioso.

Problema secundário: os campos `valor`, `roitrim`, `dy2025`, `roi2025` vêm da tabela `asset_analyses` como `text` e não são explicitamente convertidos para `number`, dependendo da coerção implícita do JavaScript.

## Correções

### 1. Expor estado de erro no hook `useWalletSimulator`

**Arquivo**: `src/hooks/useWalletSimulator.ts`

- Retornar `isError` e `error` das queries para que o componente possa exibir mensagens de erro
- Adicionar `retry: 2` nas queries para tentar novamente antes de falhar
- Converter explicitamente campos text para number com `Number()` no mapeamento dos wallet-items (linhas 165-184)

```ts
// Parsing explícito
preco_atual: Number(assetAnalysis?.valor) || 0,
roitrim: Number(assetAnalysis?.roitrim) || 0,
dy2025: assetAnalysis?.dy2025 ? Number(assetAnalysis.dy2025) : undefined,
roi2025: assetAnalysis?.roi2025 ? Number(assetAnalysis.roi2025) : undefined,
```

Retornar do hook:
```ts
return {
  // ... existing
  isError: walletError || favoritesError || itemsError,
  error: walletErrorObj || favoritesErrorObj || itemsErrorObj,
};
```

### 2. Mostrar estado de erro na página Carteira

**Arquivo**: `src/pages/app/Carteira.tsx`

- Desestruturar `isError` e `error` do hook
- Adicionar bloco de erro acima do empty state, com botão "Tentar novamente" que invalida as queries
- Isso evita que o usuário pense que perdeu dados quando na verdade houve erro de conexão

```tsx
if (isError) {
  return (
    <AppLayout title="Minha Carteira">
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-destructive mb-4">
            Erro ao carregar carteira. Verifique sua conexão.
          </p>
          <Button onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
```

### 3. Adicionar `staleTime` nas queries do wallet

Evitar re-fetches desnecessários que podem falhar em conexões instáveis:

```ts
staleTime: 2 * 60 * 1000,  // 2 minutos
gcTime: 5 * 60 * 1000,     // 5 minutos
retry: 2,
```

## Resumo técnico

| Alteração | Arquivo |
|-----------|---------|
| Expor isError/error, parsing Number(), retry | `src/hooks/useWalletSimulator.ts` |
| Mostrar erro com botão retry | `src/pages/app/Carteira.tsx` |

