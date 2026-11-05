FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY frontend frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build -w frontend
RUN npm prune --omit=dev && chown -R node:node /app/frontend/.next
ENV NODE_ENV=production
USER node
WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "start"]
