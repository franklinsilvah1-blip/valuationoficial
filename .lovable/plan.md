

## Plano: Gerar SQL para criar usuários na tabela `auth.users` a partir dos `profiles`

### Problema
A migração SQL trouxe os dados da tabela `profiles` (18 registros), mas a tabela `auth.users` está vazia. Sem os registros em `auth.users`, ninguém consegue fazer login.

### Abordagem
Criar uma Edge Function (ou usar o SQL Editor) que gera INSERTs na tabela `auth.users` com base nos dados de `profiles`. Porém, há uma limitação importante:

**Não é possível inserir diretamente na `auth.users` via SQL migration ou SDK do client** - o Supabase protege esse schema.

### Solução recomendada: Edge Function com Admin API

Criar uma Edge Function que usa a **Admin Auth API** (`supabase.auth.admin.createUser`) para recriar cada usuário com o **mesmo UUID** do profile, garantindo que os dados migrados continuem vinculados.

#### O que a Edge Function fará:
1. Ler todos os registros de `profiles` (id, email, name)
2. Para cada profile, chamar `supabase.auth.admin.createUser()` com:
   - `id` = profile.id (preserva o UUID original)
   - `email` = profile.email
   - `email_confirm` = true (marca como verificado)
   - `password` = uma senha temporária padrão (ex: `Valuation@2025`)
   - `user_metadata` = `{ name: profile.name }`
3. Retornar relatório de sucesso/erro

#### Detalhes técnicos:
- A função usará `SUPABASE_SERVICE_ROLE_KEY` (já configurada) para acesso admin
- O trigger `handle_new_user` tentará inserir um novo profile, mas como o `id` já existe, precisamos desabilitar temporariamente ou tratar o conflito
- Após a criação, os usuários poderão fazer login com a senha temporária e resetar via "Esqueci minha senha"

### Usuários que serão criados (18 total):

| Email | Nome | Plano |
|---|---|---|
| douglas@dradigital.com.br | Douglas | FREE |
| contato@dradigital.com.br | Douglas | FREE |
| franklinsilvah1@gmail.com | Franklin Silvah | SPECIALIST |
| franklin.silvah@gmail.com | FRANKLIN SILVA | PRO |
| + 14 outros | ... | ... |

### Arquivos a criar/modificar:
1. **`supabase/functions/migrate-users/index.ts`** — Edge Function que lê profiles e cria os usuários via Admin API

### Risco e mitigação:
- O trigger `handle_new_user` vai tentar criar um profile duplicado. Solução: alterar o trigger para usar `INSERT ... ON CONFLICT DO NOTHING`, ou desabilitar o trigger antes e reabilitar depois.

