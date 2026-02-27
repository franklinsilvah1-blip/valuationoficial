
## Problema

O `AlertDialogAction` do Radix UI fecha o dialog automaticamente ao clicar, disparando `onOpenChange(() => setDeleteId(null))` que limpa o `deleteId` **antes** de `handleDelete` conseguir usá-lo. Resultado: `handleDelete` roda com `deleteId` já `null`, e nada é deletado.

## Correção

Em `src/pages/app/RMC.tsx`:

1. **`handleDelete`**: Capturar o `deleteId` em variável local antes de limpar o state, garantindo que o ID esteja disponível independente do timing do Radix.

```tsx
const handleDelete = async () => {
  const id = deleteId;
  setDeleteId(null);
  if (id) {
    await deleteMovement(id);
  }
};
```

Isso resolve a race condition porque o valor é capturado sincronamente antes de qualquer setState.
