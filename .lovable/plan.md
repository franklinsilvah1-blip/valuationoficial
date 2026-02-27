

## Problema

O `e.preventDefault()` impede o fechamento automático do dialog, mas o `onOpenChange` ainda é disparado pelo Radix, limpando `deleteId` antes de `handleDelete` executar. O padrão correto (confirmado por casos similares) é usar `e.stopPropagation()` para impedir a propagação do evento, e passar o ID diretamente em vez de depender do state.

## Correção

**Arquivo**: `src/pages/app/RMC.tsx`

### 1. Alterar `handleDelete` para receber o ID como parâmetro

```tsx
const handleDelete = async (id: string) => {
  await deleteMovement(id);
  setDeleteId(null);
};
```

### 2. Alterar o `AlertDialogAction` para usar `stopPropagation` e passar o ID

```tsx
<AlertDialogAction
  onClick={(e) => {
    e.stopPropagation();
    if (deleteId) {
      handleDelete(deleteId);
    }
  }}
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
>
  Excluir
</AlertDialogAction>
```

Duas mudanças-chave:
- `e.stopPropagation()` em vez de `e.preventDefault()` — impede o evento de subir para handlers pai que fecham o dialog prematuramente
- ID passado como argumento direto — elimina a dependência do state que pode ser limpo pela race condition

