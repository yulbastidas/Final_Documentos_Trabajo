FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY frontend frontend
RUN npm run build -w frontend
USER node
WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "start"]
