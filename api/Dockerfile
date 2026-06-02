# Build + run API (Fastify + Prisma). Jeden stage — pewniejszy niż multi-stage,
# bo Prisma CLI (potrzebne do `db push` przy starcie) zostaje w obrazie.
FROM node:22-alpine
WORKDIR /app

# UWAGA: NODE_ENV ustawiamy DOPIERO po instalacji — inaczej npm pominąłby
# devDependencies (TypeScript, Prisma CLI), których potrzebujemy do buildu.
COPY package*.json ./
RUN npm ci
COPY . .

# PROD = PostgreSQL. Dev trzyma w schemacie sqlite; tu podmieniamy provider na
# postgresql (jeden schemat dla obu środowisk), generujemy klienta i kompilujemy TS.
RUN sed -i 's/provider = "sqlite".*/provider = "postgresql"/' prisma/schema.prisma \
  && npx prisma generate \
  && npm run build

ENV NODE_ENV=production
# Tworzymy/aktualizujemy tabele z aktualnego schematu (db push — bez migracji
# specyficznych dla SQLite), potem startujemy serwer.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/server.js"]
