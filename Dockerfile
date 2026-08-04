# syntax=docker/dockerfile:1

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=development
ENV PORT=3000
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/ticket_app?schema=public

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig*.json ./
COPY src ./src
COPY nest-cli.json ./

RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]
