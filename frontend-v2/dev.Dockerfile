FROM node:22-alpine3.19
WORKDIR /app
RUN npm install yarn
COPY package.json yarn.lock ./
RUN rm -f package-lock.json && yarn install

COPY . .
EXPOSE 5173
ENTRYPOINT ["yarn", "dev"]
