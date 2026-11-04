FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY backend backend
RUN npm run build -w backend
USER node
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
