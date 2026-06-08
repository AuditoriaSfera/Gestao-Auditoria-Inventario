# Setup da Plataforma Sfera Multifranquias

## Pré-requisitos

- Node.js 18+ (https://nodejs.org)
- PostgreSQL 15+ rodando localmente ou remoto
- Redis 7+ (para filas de importação)

## Instalação

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Editar .env com suas credenciais do banco
```

### 3. Criar o banco de dados no PostgreSQL
```sql
CREATE DATABASE sfera_platform;
```

### 4. Aplicar as migrations
```bash
npm run db:migrate
```

### 5. Popular o banco com dados iniciais
```bash
npm run db:seed
```

### 6. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```

A plataforma estará disponível em: http://localhost:3000

### 7. (Opcional) Iniciar o worker de importações
Em um terminal separado:
```bash
npm run worker:dev
```

---

## Credenciais iniciais (demo)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@sfera.com.br | Sfera@2024 |
| Auditoria | auditoria@sfera.com.br | Sfera@2024 |
| Supervisor SP | supervisor.sp@sfera.com.br | Sfera@2024 |
| Gerente Loja 001 | gerente.001@sfera.com.br | Sfera@2024 |
| Inventário | inventario@sfera.com.br | Sfera@2024 |
| Diretoria | diretoria@sfera.com.br | Sfera@2024 |

---

## Como criar um novo módulo

1. Crie a pasta `src/modules/{nome-do-modulo}/`
2. Crie `router.ts` com os endpoints tRPC do módulo
3. Crie `service.ts` com a lógica de negócio e fórmulas
4. Registre o router em `src/server/trpc/root.ts`
5. Crie as tabelas no schema `prisma/schema/schema.prisma`
6. Execute `npm run db:migrate`
7. Crie as páginas em `src/app/(platform)/modules/{nome}/`
8. Adicione o módulo ao menu em `src/components/layout/sidebar.tsx`

---

## Como cadastrar um novo layout de importação

1. Acesse Admin → Layouts de Importação
2. Clique em "Novo Layout"
3. Defina o módulo, nome e descrição
4. Configure as colunas: campo, nome na planilha, tipo, obrigatoriedade
5. Publique a versão 1

Ou via seed/migration, adicione o layout em `prisma/seed/index.ts`.

---

## Como configurar permissões

1. Acesse Admin → Perfis e Permissões
2. Selecione o perfil
3. Marque os módulos e ações desejadas
4. Salve

Para criar um novo perfil:
1. Admin → Perfis → Novo Perfil
2. Defina nome, label e permissões
3. Vincule ao usuário em Admin → Usuários

---

## Estrutura do banco

O banco segue as seguintes regras:
- **Soft delete**: coluna `deleted_at` em todas as entidades principais
- **Timestamps**: `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`
- **Histórico**: tabelas `activity_history` (funcional) e `audit_logs` (técnico)
- **Importações**: fluxo staging → validação → publicação, nunca direto ao dado oficial

---

## Fórmulas críticas

Todas as fórmulas estão documentadas em `docs/formulas/` e implementadas nos services do backend.

Principais:
- KPI de inventário: `docs/formulas/inventory-kpi.md`
- Custo de auditoria: `docs/formulas/audit-cost.md`
- SLA: `docs/formulas/sla.md`

---

## Variáveis de ambiente obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL |
| `AUTH_SECRET` | Segredo JWT (32+ chars) |
| `NEXTAUTH_URL` | URL base da aplicação |
| `REDIS_URL` | URL do Redis |

---

## Observabilidade

- Logs estruturados via `pino` (JSON em produção, colorido em dev)
- Nível configurável via `LOG_LEVEL` (trace/debug/info/warn/error)
- Trilha de auditoria técnica em `audit_logs`
- Histórico funcional em `activity_history`
- Preparado para OpenTelemetry futuro
