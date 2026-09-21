# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npx typeorm migration:run -d dist/data-source.js && node dist/main"]
