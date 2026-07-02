FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /app
COPY --from=builder /app ./

EXPOSE 3000

CMD ["npm", "run", "start"]
