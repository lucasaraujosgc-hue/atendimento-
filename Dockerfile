# Estágio 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copia arquivos de dependência
COPY package.json package-lock.json ./
RUN npm ci

# Copia código fonte
COPY . .

# Gera build da aplicação
RUN npm run build

# Estágio 2: Produção
FROM node:22-alpine AS runner

WORKDIR /app

# Variável de ambiente para garantir modo produção
ENV NODE_ENV=production

# Copia arquivos necessários do estágio de build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/db/schema.ts ./src/db/schema.ts

# Instala apenas dependências de produção
RUN npm ci --omit=dev

# Expõe a porta 3000 (Obrigatório)
EXPOSE 3000

# Inicia o servidor em modo produção
CMD ["npm", "run", "start"]
