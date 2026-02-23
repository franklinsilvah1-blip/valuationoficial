# Sistema de Backup e Restauração para Projetos Lovable

Guia conceitual para implementar backup automático de banco de dados e versionamento de código em qualquer projeto Lovable, usando GitHub como armazenamento.

---

## 1. Visão Geral

### Arquitetura

O sistema é composto por:

- **7 Edge Functions** — lógica de backup, listagem, download, restauração (banco e código) e verificação de status
- **1 Página Admin** — painel React com cards de status, configuração e tabelas de histórico
- **3 Tabelas de suporte** — controle de acesso (`user_roles`), auditoria (`admin_audit_log`) e configurações (`app_config`)
- **1 Função SQL** — `get_all_table_names()` para descoberta dinâmica de tabelas
- **1 Repositório GitHub privado** — armazena os JSONs de backup (separado do repo de código)

### Fluxos

```
BACKUP:   DB → Edge Function → GitHub API → repo-privado/backup/YYYY-MM-DD/{critical,full}/*.json
RESTORE:  GitHub → Edge Function → upsert no banco (com ON CONFLICT)
CÓDIGO:   GitHub commits → listar últimos 30 dias → restaurar apontando branch para commit anterior
```

---

## 2. Pré-requisitos

Antes de pedir ao Lovable para implementar, configure manualmente:

| Item | Ação |
|------|------|
| **Repositório GitHub** | Criar repo **privado** dedicado a backups (ex: `meu-projeto-backups`). Não usar o repo do código. |
| **Personal Access Token** | Gerar PAT clássico em GitHub → Settings → Developer Settings → Tokens (classic) com permissão `repo`. |
| **Secrets no projeto** | Adicionar 3 secrets via Lovable: `GITHUB_BACKUP_TOKEN` (o PAT), `GITHUB_BACKUP_REPO` (formato `usuario/repo`), `CRON_SECRET` (string aleatória para proteger cron jobs). |

---

## 3. Componentes do Sistema (Edge Functions)

Cada função deve verificar autenticação e permissão de admin antes de executar.

| Função | Responsabilidade |
|--------|-----------------|
| **backup-database** | Lê todas as tabelas do banco via `get_all_table_names()`, serializa em JSON, oculta campos sensíveis e envia para o GitHub. Suporta dois modos: `critical` (tabelas essenciais) e `full` (todas). Gera um `summary.json` com contagem de registros. |
| **list-backups** | Lista os diretórios de data dentro de `backup/` no GitHub e retorna o `summary.json` de cada um. |
| **download-backup** | Recebe `date` e `type` (critical/full), busca os JSONs no GitHub, decodifica o Base64 e retorna o conteúdo. |
| **restore-backup** | Recebe os dados de um backup e faz upsert (INSERT ... ON CONFLICT) em cada tabela, respeitando a ordem de dependências (tabelas-pai primeiro). Registra a ação no audit log. |
| **check-github-status** | Verifica se `GITHUB_BACKUP_TOKEN` e `GITHUB_BACKUP_REPO` estão configurados e se o token tem acesso ao repositório. Retorna status de conexão, visibilidade e branch padrão. |
| **list-code-versions** | Lista os commits dos últimos 30 dias do repositório de **código** (não o de backups) via GitHub API. |
| **restore-code-version** | Recebe um SHA de commit, cria um novo commit apontando para a tree daquele SHA e atualiza a ref da branch. Efetivamente "reverte" o código. Registra no audit log. |

---

## 4. Tabelas de Suporte

O Lovable deve criar estas tabelas caso não existam no projeto:

| Tabela | Propósito | Campos-chave |
|--------|-----------|--------------|
| **user_roles** | Definir quem é admin | `user_id`, `role` (enum: user, admin, editor, moderator) |
| **admin_audit_log** | Registrar ações sensíveis | `user_id`, `action`, `metadata` (JSONB), `created_at` |
| **app_config** | Configurações do sistema | `key`, `value` (ex: `cron_secret`, `admin_email`) |

**Função SQL necessária:**

`get_all_table_names()` — retorna todas as tabelas do schema `public` consultando `pg_tables`. Usada pela função de backup para descobrir dinamicamente quais tabelas exportar.

---

## 5. Página Admin

O painel deve conter:

### Cards superiores (grid 2x2)
1. **Status GitHub** — Indicador visual (verde/vermelho) mostrando se a conexão está ativa, nome do repo, visibilidade e última atualização
2. **Configurações** — Frequência do backup automático (ex: diário 03:00 UTC), dias de retenção, botão para testar conexão
3. **Backup Crítico** — Botão para gerar backup das tabelas essenciais, com indicador de progresso
4. **Backup Completo** — Botão para gerar backup de todas as tabelas

### Tabelas inferiores
- **Histórico de Backups** — Lista de backups por data com contagem de registros, botões de download e exclusão
- **Versões do Código** — Lista de commits recentes com SHA, data, mensagem e botão de restauração (com confirmação)

### Comportamentos
- Todas as ações destrutivas (restaurar, excluir) devem ter diálogo de confirmação
- Filtro por data na listagem de versões de código
- Paginação (10 itens por página)

---

## 6. Pontos de Personalização

O Lovable deve adaptar automaticamente para cada projeto:

| Conceito | O que é | Como adaptar |
|----------|---------|--------------|
| **CRITICAL_TABLES** | Lista de tabelas essenciais para backup rápido | Analisar o schema e incluir tabelas com dados de usuários, configurações e dados financeiros |
| **REDACTED_FIELDS** | Campos sensíveis cujos valores são substituídos por `[REDACTED]` no backup | Identificar campos com nomes como `password`, `secret`, `token`, `api_key`, `smtp_password` |
| **SKIP_TABLES** | Tabelas ignoradas na restauração para evitar conflitos | Tipicamente: `user_roles`, `admin_audit_log` e tabelas de logs/cache |
| **Cron Job** | Agendamento do backup automático | Configurar no `config.toml` usando o `CRON_SECRET` para autenticação |

---

## 7. Master Prompt

Cole este prompt no Lovable do outro projeto, anexando este documento como referência:

---

**Prompt:**

> Preciso implementar um sistema completo de backup e restauração para este projeto. O documento anexado (`BACKUP_SYSTEM_DOCS.md`) descreve a arquitetura conceitual.
>
> **O que você deve fazer:**
>
> 1. **Analisar o schema atual** deste projeto para identificar:
>    - Todas as tabelas existentes
>    - Quais são críticas (dados de usuários, configurações, financeiro)
>    - Quais campos são sensíveis e devem ser ocultados no backup
>    - Quais tabelas devem ser ignoradas na restauração
>
> 2. **Criar as tabelas de suporte** (se não existirem): `user_roles`, `admin_audit_log`, `app_config` e a função `get_all_table_names()`
>
> 3. **Criar 7 edge functions**: `backup-database`, `list-backups`, `download-backup`, `restore-backup`, `check-github-status`, `list-code-versions`, `restore-code-version`. Todas devem:
>    - Verificar autenticação e permissão admin
>    - Usar os secrets `GITHUB_BACKUP_TOKEN` e `GITHUB_BACKUP_REPO`
>    - Seguir o padrão CORS compartilhado
>    - Ter `verify_jwt = false` no config.toml
>
> 4. **Criar a página admin** `/app/admin/backups` com o layout descrito abaixo:
>
>    **Cabeçalho:**
>    - Título "Backups do Banco de Dados"
>    - Subtítulo "Gerencie backups manuais e automáticos salvos no GitHub"
>
>    **4 Cards superiores (grid 2x2, OBRIGATÓRIOS):**
>    - **Conexão GitHub** (esq): badge verde/vermelho "Conectado"/"Desconectado", nome do repo, visibilidade, branch, link "Abrir Repositório". Busca status via `check-github-status`
>    - **Configurações da Rotina** (dir): toggle "Backup diário (03:00 UTC)", campo numérico "Retenção (dias)" (padrão 30), botão "Salvar Configurações"
>    - **Backup Crítico** (esq): descrição das tabelas essenciais, botão "Gerar Backup Crítico" com loading spinner
>    - **Backup Completo** (dir): descrição (todas as tabelas com redação de dados sensíveis), botão "Gerar Backup Completo" com loading spinner
>
>    **Seção "Backups Disponíveis"** (abaixo dos cards):
>    - Tabela agrupada por data com colunas: Data | Crítico | Completo | Duração | Download | Restaurar
>      - Coluna Crítico/Completo: badge com "X tabelas · Y reg." ou traço "—"
>      - Coluna Download: ícone + texto "Crítico"/"Completo" como link
>      - Coluna Restaurar: ícone + texto em vermelho como link
>      - Botão "Atualizar" no header do card
>
>    **Seção "Versões do Código-Fonte"** (abaixo dos backups):
>    - Tabela com colunas: Data (dd/mm/aaaa, HH:mm) | Mensagem | Autor | Ação
>      - Badge "atual" no primeiro commit
>      - Coluna Ação: texto "Restaurar" em vermelho ou traço "—" para o commit atual
>      - Filtro por data (date picker) + botão "Atualizar" no header
>      - **NÃO** incluir coluna SHA
>      - Paginação (10 por página)
>    - Confirmação para todas as ações destrutivas (restaurar banco e código)
>
> Adapte tudo ao schema específico deste projeto. Use o documento anexado como referência da arquitetura.

---

## Notas Finais

- O repositório de backups deve ser **separado** do repositório de código para evitar poluição de commits e sincronizações indesejadas
- Backups são armazenados como JSONs individuais por tabela, organizados em `backup/YYYY-MM-DD/{critical,full}/`
- A restauração usa upsert (ON CONFLICT) para evitar duplicatas
- Todas as ações de restauração (banco e código) são registradas no `admin_audit_log`
- O sistema de retenção deve limpar backups com mais de X dias automaticamente
