FROM node:24-alpine3.24
RUN apk -U upgrade \
    && rm -rf /var/cache/apk/*
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY backend backend
COPY infra/docker/backend-entrypoint.sh /usr/local/bin/securedocs-entrypoint
RUN npm run build -w backend
RUN npm prune --omit=dev \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && mkdir -p /var/lib/securedocs/documents \
    && chown -R node:node /app/backend /var/lib/securedocs
RUN chmod 0555 /usr/local/bin/securedocs-entrypoint
ENV NODE_ENV=production
USER node
WORKDIR /app/backend
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/securedocs-entrypoint"]
CMD ["node", "dist/main.js"]
