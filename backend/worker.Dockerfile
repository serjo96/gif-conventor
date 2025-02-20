FROM node:18-alpine

WORKDIR /app

# Install ffmpeg
RUN apk add --no-cache ffmpeg

# Add tini for proper signal handling
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

COPY package*.json yarn.lock ./
RUN yarn install

COPY . .
RUN yarn build

# Remove debug flag for production
CMD ["node", "-r", "tsconfig-paths/register", "dist/worker.js"] 