FROM node:22-alpine as deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:22-alpine as builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV production

ENV NEXT_PUBLIC_PORT=APP_NEXT_PUBLIC_PORT
ENV NEXT_PUBLIC_BASE_URL=APP_NEXT_PUBLIC_BASE_URL

RUN yarn build

FROM node:22-bullseye as runner
WORKDIR /app
ENV NODE_ENV=production

# Install ImageMagick and dependencies
RUN apt update && apt install -y imagemagick libopenjp2-7 ghostscript

COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/css ./css
COPY --from=builder /app/i18n ./i18n
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

RUN chmod +x /app/entrypoint.sh

RUN groupadd -g 1001 nodejs
RUN useradd -m -u 1001 -g nodejs -s /bin/bash nextjs
RUN chown -R nextjs:nodejs /app/.next

USER nextjs

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["yarn", "start"]