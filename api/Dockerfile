# Build + run API (Fastify + Prisma). Multi-stage, żeby obraz był chudy.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
# Migracje odpalamy przy starcie, potem startujemy serwer.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
