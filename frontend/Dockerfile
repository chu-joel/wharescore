# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args become env vars for the build
ARG NEXT_PUBLIC_LINZ_API_KEY=""
ENV NEXT_PUBLIC_LINZ_API_KEY=$NEXT_PUBLIC_LINZ_API_KEY

# In Docker, nginx handles routing — disable Next.js rewrites
ENV NEXT_PUBLIC_USE_PROXY=false

RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1000 appuser && adduser -D -u 1000 -G appuser appuser

# Copy built output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
