FROM node:24-trixie-slim
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY frontend frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build -w frontend
RUN npm prune --omit=dev \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && chown -R node:node /app/frontend/.next
ENV NODE_ENV=production
USER node
WORKDIR /app/frontend
EXPOSE 3000
CMD ["node", "../node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
