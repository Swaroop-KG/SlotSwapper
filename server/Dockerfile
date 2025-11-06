# Server - production Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install only production deps first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

# Copy source
COPY src ./src
COPY .env.example ./
ENV NODE_ENV=production

EXPOSE 4000
CMD ["node", "src/index.js"]
