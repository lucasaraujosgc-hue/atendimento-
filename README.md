# Multi Atendimento WhatsApp SaaS

Sistema web completo de multiatendimento via WhatsApp para escritórios de contabilidade e empresas, permitindo que vários colaboradores conversem com clientes em uma única plataforma centralizada.

## 🚀 Funcionalidades

- **Múltiplos Atendentes**: Vários usuários atendendo pelo mesmo número de WhatsApp.
- **Painel de Controle (Dashboard)**: Métricas em tempo real de SLA e atendimento.
- **Caixa de Entrada Unificada**: Visualização de tickets estilo Kanban / Lista.
- **Perfis de Acesso**: Administrador, Supervisor, Atendente.
- **Respostas Rápidas**: Templates de mensagens pré-cadastradas.
- **Histórico e Auditoria**: Registro completo de conversas.
- **Tempo Real**: Atualizações instantâneas via Socket.IO.
- **Transferência**: Repasse de chamados entre departamentos/atendentes.

## 🛠️ Stack Tecnológica

**Frontend:** React 19, TypeScript, Vite, TailwindCSS, React Router, React Query, Lucide Icons, Shadcn/UI (opcional).
**Backend:** Node.js, Express, TypeScript, Socket.IO.
**Banco de Dados:** PostgreSQL (via Drizzle ORM).
**Segurança:** JWT, Bcrypt, Helmet, CORS.

## 📦 Estrutura do Projeto

O projeto adota uma estrutura de monorepo simplificado:

```
/
├── src/
│   ├── components/    # Componentes React reutilizáveis
│   ├── pages/         # Telas da aplicação (Login, Chat, Dashboard)
│   ├── db/            # Schema do Drizzle e conexão (PostgreSQL)
│   ├── main.tsx       # Entrypoint Frontend
│   └── App.tsx        # Rotas Frontend
├── server.ts          # Entrypoint Backend (Express + Vite Middleware)
├── docker-compose.yml # Orquestração local / EasyPanel
├── Dockerfile         # Imagem para Produção
├── drizzle.config.ts  # Configuração Drizzle
└── package.json       # Dependências e Scripts
```

## ⚙️ Variáveis de Ambiente

Renomeie ou crie um arquivo `.env` baseado no `.env.example`:

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
JWT_SECRET="sua-chave-secreta"
ADMIN_NAME="Administrador"
ADMIN_EMAIL="admin@empresa.com.br"
ADMIN_PASSWORD="senha_segura"
```

O usuário administrador será automaticamente injetado/verificado no banco de dados quando o sistema for iniciado pela primeira vez, facilitando o acesso inicial.

## 🐳 Instalação e Deploy (Docker / EasyPanel)

A aplicação foi desenhada para rodar de forma simples e escalável.

### Rodando Localmente com Docker Compose

Para uso e testes locais com banco de dados embutido:

1. Clone o repositório.
2. Certifique-se de que o Docker e Docker Compose estão instalados.
3. Execute na raiz do projeto:

```bash
docker compose up -d --build
```

A aplicação estará disponível em `http://localhost:3000`.

### Deploy no EasyPanel

1. Crie um novo projeto no seu EasyPanel.
2. Adicione uma aplicação do tipo "App" (ou via Docker Compose nativo).
3. Conecte seu repositório Github (ou utilize a aba "Source" e cole seu código).
4. Em **Build Method**, selecione **Dockerfile**.
5. Configure as **Environment Variables** listadas acima. (Para o DB, você pode instanciar um Postgres via EasyPanel).
6. Clique em **Deploy**.

## 🛡️ Migrations e Seeds

Para rodar as migrations manualmente (após configurar a variável `DATABASE_URL`):

```bash
npm run db:push
```

Para visualizar o banco via painel do Drizzle:

```bash
npm run db:studio
```
