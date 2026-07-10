FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_CULQI_PUBLIC_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL
ENV NEXT_PUBLIC_CULQI_PUBLIC_KEY=$NEXT_PUBLIC_CULQI_PUBLIC_KEY
# Versionar el service worker con el timestamp del build: cada deploy
# dispara el banner "Nueva versión disponible" en los clientes
RUN sed -i "s/const SW_VERSION = \"[^\"]*\"/const SW_VERSION = \"$(date +%Y%m%d%H%M%S)\"/" public/sw.js
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs
COPY --from=builder /app/public      ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
