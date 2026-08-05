FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install

COPY apps/backend apps/backend
RUN npm run build --workspace=apps/backend

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
