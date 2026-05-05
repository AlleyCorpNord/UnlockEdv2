FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY yarn.lock* ./
RUN yarn install

COPY . .
RUN yarn install
RUN rm -f node_modules/vite/node_modules/rollup/dist/native.js || true

EXPOSE 5173
ENTRYPOINT ["yarn", "dev"]