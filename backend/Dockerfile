FROM node:18-alpine

WORKDIR /app

# Install ffmpeg and curl for healthcheck
RUN apk add --no-cache ffmpeg curl

# Add tini for proper signal handling
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# Копируем только файлы зависимостей
COPY package*.json yarn.lock ./
RUN yarn install

# Копируем остальные файлы
COPY . .

# Build TypeScript
RUN yarn build

EXPOSE 3000

# Use development command for hot-reload
CMD ["yarn", "dev"]
